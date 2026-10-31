/* global fetch, console */
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import process from 'node:process';
import { after, before, beforeEach, test, mock } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import express from 'express';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  MAX_PASSWORD_BYTES,
  loginBodySchema,
  registerUserBodySchema,
  utf8ByteLength,
} from '@opensell/shared';

Object.assign(process.env, {
  NODE_ENV: 'production',
  MONGO_URI: 'mongodb://127.0.0.1:27017',
  DB_NAME: 'opensell_auth_routes_test',
  JWT_SECRET: 'test-only-jwt-secret',
  EMAIL_FROM: 'test@example.invalid',
  EMAIL_HOST: '127.0.0.1',
  EMAIL_USER: 'test',
  EMAIL_PASS: 'test',
  VERIFICATION_EMAIL_KEY: '1'.repeat(64),
  REFRESH_RETRY_KEY: '2'.repeat(64),
});

const sent = [];
let rejectFor = new Set();
let holdFor = null;
mock.method(nodemailer, 'createTransport', () => ({
  sendMail: async (message) => {
    sent.push(message);
    if (holdFor?.email === message.to) {
      holdFor.started();
      await holdFor.promise;
    }
    if (rejectFor.has(message.to)) throw new Error('mock SMTP failure');
    return { accepted: [message.to] };
  },
}));

const [{ default: app }, { User }, { AuthRateLimit }, { RefreshToken }, { ConsumedRefreshToken }] = await Promise.all([
  import('../src/app.ts'),
  import('../src/models/user.model.ts'),
  import('../src/models/auth-rate-limit.model.ts'),
  import('../src/models/refresh-token.model.ts'),
  import('../src/models/consumed-refresh-token.model.ts'),
]);
const { processNextVerificationEmail, requestVerificationEmail, startVerificationEmailWorker } =
  await import('../src/services/verification-email.service.ts');
const { hashToken } = await import('../src/utils/hash-token.ts');
const { decryptVerificationToken } = await import('../src/utils/verification-email-crypto.ts');
const { createRequestLogger } = await import('../src/middleware/logger.ts');
const { authRouter } = await import('../src/routes/auth.routes.ts');
const { default: errorHandler } = await import('../src/middleware/error-handler.ts');

let db;
let server;
let baseUrl;
before(async () => {
  db = await MongoMemoryServer.create();
  await mongoose.connect(db.getUri(), { dbName: 'opensell_auth_routes_test' });
  await User.init();
  await AuthRateLimit.init();
  await RefreshToken.init();
  await ConsumedRefreshToken.init();
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  await AuthRateLimit.deleteMany({});
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await mongoose.disconnect();
  if (db) await db.stop();
  mock.restoreAll();
});

async function post(path, body) {
  const response = await fetch(`${baseUrl}/api/v1/auth/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

function tokenFrom(message) {
  return message.html.match(/verify-email\?token=([a-f0-9]{80})/)?.[1];
}

const password = 'StrongPass1!';
const registration = (email) => ({ name: 'Ada Seller', email, password, provider: 'local' });

async function createRefreshSession(email) {
  await User.create({ name: 'Ada Seller', email, password, provider: 'local', isVerified: true });
  const login = await post('login', { email, password });
  assert.equal(login.status, 200);
  return login.body.data.refreshToken;
}

test('refresh rotation recovers a lost response only with the matching retry key', async () => {
  const original = await createRefreshSession('refresh-retry@example.invalid');
  const retryKey = 'ab'.repeat(32);
  const first = await post('refresh', { refreshToken: original, retryKey });
  assert.equal(first.status, 200);
  const successor = first.body.data.refreshToken;
  assert.notEqual(successor, original);
  const record = await RefreshToken.findOne({ previousTokenHash: hashToken(original) });
  assert.ok(record);
  assert.equal(record.refreshToken, hashToken(successor));
  assert.equal(JSON.stringify(record).includes(successor), false);
  const recovered = await post('refresh', { refreshToken: original, retryKey });
  assert.equal(recovered.status, 200);
  assert.equal(recovered.body.data.refreshToken, successor);
  assert.equal((await RefreshToken.findById(record._id)).usageCount, 1);
});

test('an expired matching retry revokes an otherwise active session', async () => {
  const original = await createRefreshSession('refresh-expired-retry@example.invalid');
  const retryKey = 'cd'.repeat(32);
  const first = await post('refresh', { refreshToken: original, retryKey });
  assert.equal(first.status, 200);
  const successor = first.body.data.refreshToken;
  const session = await RefreshToken.findOne({ refreshToken: hashToken(successor) });
  assert.ok(session);
  assert.equal((await post('refresh', { refreshToken: original, retryKey })).body.data.refreshToken, successor);
  assert.equal(session.isValid, true);
  assert.ok(session.expiresAt > new Date());
  const consumed = await ConsumedRefreshToken.findById(hashToken(original));
  assert.ok(consumed);
  assert.ok(consumed.originalExpiresAt > new Date());
  assert.ok(consumed.expiresAt > new Date());

  await RefreshToken.updateOne({ _id: session._id }, { $set: { retryUntil: new Date(0) } });
  const beforeReplay = await RefreshToken.findById(session._id);
  assert.equal(beforeReplay.isValid, true);
  assert.equal(beforeReplay.refreshToken, hashToken(successor));
  assert.ok(beforeReplay.retryUntil < new Date());
  assert.equal((await post('refresh', { refreshToken: original, retryKey })).status, 401);
  const revoked = await RefreshToken.findById(session._id);
  assert.equal(revoked.isValid, false);
  assert.ok(revoked.revokedAt);
  assert.equal((await post('refresh', { refreshToken: successor, retryKey: 'ef'.repeat(32) })).status, 401);
});

test('concurrent refreshes produce one successor and rollback on generation or write failure', async () => {
  const original = await createRefreshSession('refresh-concurrent@example.invalid');
  const retryKey = '11'.repeat(32);
  const results = await Promise.all(Array.from({ length: 4 }, () =>
    post('refresh', { refreshToken: original, retryKey })));
  assert.ok(results.every((result) => result.status === 200));
  assert.equal(new Set(results.map((result) => result.body.data.refreshToken)).size, 1);
  assert.equal((await RefreshToken.findOne({ previousTokenHash: hashToken(original) })).usageCount, 1);

  const current = results[0].body.data.refreshToken;
  const sign = mock.method(jwt, 'sign', () => { throw new Error('test JWT generation failure'); });
  try {
    assert.equal((await post('refresh', { refreshToken: current, retryKey: '22'.repeat(32) })).status, 500);
  } finally { sign.mock.restore(); }
  assert.ok(await RefreshToken.findOne({ refreshToken: hashToken(current) }));

  const write = mock.method(RefreshToken, 'findOneAndUpdate', async () => {
    throw new Error('test successor write failure');
  });
  try {
    assert.equal((await post('refresh', { refreshToken: current, retryKey: '22'.repeat(32) })).status, 500);
  } finally { write.mock.restore(); }
  assert.ok(await RefreshToken.findOne({ refreshToken: hashToken(current) }));
  await ConsumedRefreshToken.updateOne({ _id: hashToken(current) }, {
    $set: { expiresAt: new Date(0) },
  });
  assert.equal((await post('refresh', { refreshToken: current, retryKey: '22'.repeat(32) })).status, 200);
  assert.ok((await ConsumedRefreshToken.findById(hashToken(current))).expiresAt > new Date());
});

test('logout with a lost response token revokes its rotated successor', async () => {
  const original = await createRefreshSession('refresh-logout@example.invalid');
  const retryKey = '33'.repeat(32);
  const rotated = await post('refresh', { refreshToken: original, retryKey });
  assert.equal(rotated.status, 200);
  assert.equal((await post('logout', { refreshToken: original })).status, 200);
  assert.equal((await post('refresh', {
    refreshToken: rotated.body.data.refreshToken, retryKey: '44'.repeat(32),
  })).status, 401);
  assert.equal((await post('refresh', { refreshToken: original, retryKey })).status, 401);
});

test('existing clients can rotate without a retry key, then use the new retry protocol', async () => {
  const original = await createRefreshSession('refresh-legacy-client@example.invalid');
  const legacy = await post('refresh', { refreshToken: original });
  assert.equal(legacy.status, 200);
  const retryKey = '55'.repeat(32);
  const upgraded = await post('refresh', {
    refreshToken: legacy.body.data.refreshToken, retryKey,
  });
  assert.equal(upgraded.status, 200);
  const recovery = await post('refresh', {
    refreshToken: legacy.body.data.refreshToken, retryKey,
  });
  assert.equal(recovery.body.data.refreshToken, upgraded.body.data.refreshToken);
  assert.equal((await post('refresh', { refreshToken: original })).status, 401);
  assert.equal((await post('refresh', {
    refreshToken: upgraded.body.data.refreshToken, retryKey: '66'.repeat(32),
  })).status, 401);
});

test('a replay revokes only its own session and logs no credentials', async () => {
  const email = 'refresh-replay@example.invalid';
  const original = await createRefreshSession(email);
  const independent = (await post('login', { email, password })).body.data.refreshToken;
  const retryKey = '66'.repeat(32);
  const first = await post('refresh', { refreshToken: original, retryKey });
  const successor = first.body.data.refreshToken;
  assert.equal((await post('refresh', { refreshToken: original, retryKey })).body.data.refreshToken, successor);
  const warnings = [];
  const warning = mock.method(console, 'warn', (...args) => { warnings.push(args); });
  try {
    assert.equal((await post('refresh', { refreshToken: original, retryKey: '77'.repeat(32) })).status, 401);
  } finally { warning.mock.restore(); }
  assert.equal(warnings.length, 1);
  assert.equal(JSON.stringify(warnings).includes(original), false);
  assert.equal(JSON.stringify(warnings).includes(retryKey), false);
  assert.equal(JSON.stringify(warnings).includes(successor), false);
  assert.equal((await post('refresh', { refreshToken: successor, retryKey: '88'.repeat(32) })).status, 401);
  assert.equal((await post('refresh', { refreshToken: independent, retryKey: '99'.repeat(32) })).status, 200);
});

test('an ancestor replay revokes the latest successor, but expired and unknown tokens do not', async () => {
  const original = await createRefreshSession('refresh-ancestor@example.invalid');
  const first = (await post('refresh', { refreshToken: original, retryKey: 'aa'.repeat(32) })).body.data.refreshToken;
  const second = (await post('refresh', { refreshToken: first, retryKey: 'bb'.repeat(32) })).body.data.refreshToken;
  assert.equal((await post('refresh', { refreshToken: 'unknown-token', retryKey: 'cc'.repeat(32) })).status, 401);
  assert.equal((await post('refresh', { refreshToken: original, retryKey: 'aa'.repeat(32) })).status, 401);
  assert.equal((await post('refresh', { refreshToken: second, retryKey: 'dd'.repeat(32) })).status, 401);

  const expiredOriginal = await createRefreshSession('refresh-expired-replay@example.invalid');
  const valid = (await post('refresh', {
    refreshToken: expiredOriginal, retryKey: 'ee'.repeat(32),
  })).body.data.refreshToken;
  await ConsumedRefreshToken.updateOne({ _id: hashToken(expiredOriginal) }, {
    $set: { originalExpiresAt: new Date(0) },
  });
  assert.equal((await post('refresh', { refreshToken: expiredOriginal, retryKey: 'ff'.repeat(32) })).status, 401);
  assert.equal((await post('refresh', { refreshToken: valid, retryKey: '11'.repeat(32) })).status, 200);

  const retentionOriginal = await createRefreshSession('refresh-retention@example.invalid');
  const retentionSuccessor = (await post('refresh', {
    refreshToken: retentionOriginal, retryKey: '20'.repeat(32),
  })).body.data.refreshToken;
  await ConsumedRefreshToken.updateOne({ _id: hashToken(retentionOriginal) }, {
    $set: { expiresAt: new Date(0) },
  });
  assert.equal((await post('refresh', {
    refreshToken: retentionOriginal, retryKey: '21'.repeat(32),
  })).status, 401);
  assert.equal((await post('refresh', {
    refreshToken: retentionSuccessor, retryKey: '22'.repeat(32),
  })).status, 200);
});

test('a consumed-token write failure leaves the original token usable', async () => {
  const original = await createRefreshSession('refresh-ledger-error@example.invalid');
  const write = mock.method(ConsumedRefreshToken, 'updateOne', async () => {
    throw new Error('test consumed-token write failure');
  });
  try {
    assert.equal((await post('refresh', { refreshToken: original, retryKey: '12'.repeat(32) })).status, 500);
  } finally { write.mock.restore(); }
  assert.ok(await RefreshToken.findOne({ refreshToken: hashToken(original), isValid: true }));
  assert.equal((await post('refresh', { refreshToken: original, retryKey: '12'.repeat(32) })).status, 200);
});

test('simultaneous replay and rotation cannot leave an active successor', async () => {
  const original = await createRefreshSession('refresh-replay-race@example.invalid');
  const current = (await post('refresh', {
    refreshToken: original, retryKey: '13'.repeat(32),
  })).body.data.refreshToken;
  const [rotation, replay] = await Promise.all([
    post('refresh', { refreshToken: current, retryKey: '14'.repeat(32) }),
    post('refresh', { refreshToken: original, retryKey: '15'.repeat(32) }),
  ]);
  assert.equal(replay.status, 401);
  assert.ok([200, 401].includes(rotation.status));
  const latest = rotation.status === 200 ? rotation.body.data.refreshToken : current;
  assert.equal((await post('refresh', { refreshToken: latest, retryKey: '16'.repeat(32) })).status, 401);
});

test('revocation wins against a rotation paused before its atomic update', async () => {
  const original = await createRefreshSession('refresh-revocation-wins@example.invalid');
  const current = (await post('refresh', {
    refreshToken: original, retryKey: '17'.repeat(32),
  })).body.data.refreshToken;
  let entered;
  let release;
  const paused = new Promise((resolve) => { entered = resolve; });
  const gate = new Promise((resolve) => { release = resolve; });
  const update = RefreshToken.findOneAndUpdate.bind(RefreshToken);
  const hold = mock.method(RefreshToken, 'findOneAndUpdate', async (...args) => {
    if (args[0]?.refreshToken === hashToken(current)) {
      entered();
      await gate;
    }
    return update(...args);
  });
  let rotation;
  try {
    rotation = post('refresh', { refreshToken: current, retryKey: '18'.repeat(32) });
    await paused;
    assert.equal((await post('refresh', { refreshToken: original, retryKey: '19'.repeat(32) })).status, 401);
    release();
    assert.equal((await rotation).status, 401);
    assert.equal((await post('refresh', { refreshToken: current, retryKey: '18'.repeat(32) })).status, 401);
  } finally {
    release();
    if (rotation) await Promise.allSettled([rotation]);
    hold.mock.restore();
  }
});

test('new passwords enforce the bcrypt UTF-8 boundary without restricting legacy login', async () => {
  const ascii71 = `Aa1!${'a'.repeat(67)}`;
  const ascii72 = `${ascii71}a`;
  const ascii73 = `${ascii72}a`;
  const multibyte72 = `Aa1!${'é'.repeat(34)}`;
  const multibyte73 = `${multibyte72}a`;

  assert.equal(utf8ByteLength(ascii71), 71);
  assert.equal(utf8ByteLength(ascii72), MAX_PASSWORD_BYTES);
  assert.equal(utf8ByteLength(ascii73), 73);
  assert.equal(utf8ByteLength(multibyte72), MAX_PASSWORD_BYTES);
  assert.equal(utf8ByteLength(multibyte73), 73);
  for (const accepted of [ascii71, ascii72, multibyte72]) {
    assert.equal(registerUserBodySchema.parse({
      name: 'Ada Seller', email: 'boundary@example.invalid', password: accepted, provider: 'local',
    }).password, accepted);
  }
  for (const rejected of [ascii73, multibyte73]) {
    assert.throws(() => registerUserBodySchema.parse({
      name: 'Ada Seller', email: 'boundary@example.invalid', password: rejected, provider: 'local',
    }), /72 UTF-8 bytes/);
  }

  const rejectedEmail = 'too-long@example.invalid';
  assert.equal((await post('register', {
    name: 'Ada Seller', email: rejectedEmail, password: multibyte73, provider: 'local',
  })).status, 400);
  assert.equal(await User.countDocuments({ email: rejectedEmail }), 0);
  await assert.rejects(
    new User({ name: 'Ada Seller', email: 'model-boundary@example.invalid', password: ascii73,
      provider: 'local' }).validate(),
    /72 UTF-8 bytes/,
  );

  // Bcrypt ignores suffixes beyond byte 72; this is why new passwords stop at the boundary.
  const legacyHash = await bcrypt.hash(`${ascii72}x`, 4);
  assert.equal(await bcrypt.compare(`${ascii72}y`, legacyHash), true);
  const legacyEmail = 'legacy-long-password@example.invalid';
  await User.collection.insertOne({
    name: 'Legacy User', email: legacyEmail, password: legacyHash, provider: 'local',
    isVerified: true, createdAt: new Date(), updatedAt: new Date(),
  });
  assert.equal(loginBodySchema.parse({ email: legacyEmail, password: `${ascii72}x` }).password.length, 73);
  assert.equal((await post('login', { email: legacyEmail, password: `${ascii72}x` })).status, 200);
});

test('boundary passwords survive model hashing and registration, while over-limit writes fail', async () => {
  const ascii71 = `Aa1!${'a'.repeat(67)}`;
  const ascii72 = `${ascii71}a`;
  const multibyte72 = `Aa1!${'é'.repeat(34)}`;
  const threeByte72 = `Aa1!${'€'.repeat(22)}aa`;
  const fourByte72 = `Aa1!${'😀'.repeat(17)}`;
  const allowed = [ascii71, ascii72, multibyte72, threeByte72, fourByte72];

  for (const [index, candidate] of allowed.entries()) {
    assert.equal(utf8ByteLength(candidate), Buffer.byteLength(candidate, 'utf8'));
    assert.ok(Buffer.byteLength(candidate, 'utf8') <= MAX_PASSWORD_BYTES);
    const email = `saved-boundary-${index}@example.invalid`;
    await User.create({ name: 'Ada Seller', email, password: candidate,
      provider: 'local', isVerified: true });
    const saved = await User.findOne({ email }).select('+password');
    assert.ok(saved);
    assert.notEqual(saved.password, candidate);
    assert.equal(await saved.comparePassword(candidate), true);
    assert.equal(await saved.comparePassword(`B${candidate.slice(1)}`), false);
  }

  const registrationEmail = 'registered-boundary@example.invalid';
  assert.equal((await post('register', {
    name: 'Ada Seller', email: registrationEmail, password: fourByte72, provider: 'local',
  })).status, 201);
  await User.updateOne({ email: registrationEmail }, {
    $set: { isVerified: true },
    $unset: { verificationEmailJob: 1, verificationToken: 1, pendingVerificationToken: 1 },
  });
  assert.equal((await post('login', { email: registrationEmail, password: fourByte72 })).status, 200);

  const overLimit = [
    `${ascii72}a`,
    `${multibyte72}a`,
    `${threeByte72}a`,
    `${fourByte72}a`,
  ];
  for (const [index, candidate] of overLimit.entries()) {
    const email = `rejected-boundary-${index}@example.invalid`;
    assert.equal(utf8ByteLength(candidate), Buffer.byteLength(candidate, 'utf8'));
    assert.equal(Buffer.byteLength(candidate, 'utf8'), 73);
    await assert.rejects(
      User.create({ name: 'Ada Seller', email, password: candidate, provider: 'local' }),
      /72 UTF-8 bytes/,
    );
    assert.equal(await User.countDocuments({ email }), 0);
  }
});

test('registration queues atomically, survives a lost response, and verifies after worker delivery', async () => {
  const email = 'queued@example.invalid';
  const created = await post('register', registration(email));
  assert.equal(created.status, 201);
  assert.equal(created.body.data.verificationEmailDelivery, 'queued');
  assert.equal(sent.length, 0);
  assert.equal(await User.countDocuments({ email }), 1);
  const savedJob = (await User.findOne({ email })).verificationEmailJob;
  assert.ok(savedJob);
  assert.equal(JSON.stringify(savedJob).includes(decryptVerificationToken(savedJob)), false);
  assert.equal((await post('register', registration(email))).status, 409);
  assert.equal((await post('login', { email, password })).status, 401);
  // The client can recover even if it never received the successful registration response.
  assert.equal((await post('resend-verification', { email })).status, 200);
  assert.equal(await processNextVerificationEmail(), true);
  const token = tokenFrom(sent.at(-1));
  assert.equal((await User.findOne({ email })).verificationToken, hashToken(token));
  assert.equal((await fetch(`${baseUrl}/api/v1/auth/verify-email?token=${token}`)).status, 200);
  assert.equal((await post('login', { email, password })).status, 200);
});

test('SMTP failure retries the same encrypted link without invalidating an older delivered link', async () => {
  const email = 'retry@example.invalid';
  await post('register', registration(email));
  await processNextVerificationEmail();
  const original = tokenFrom(sent.at(-1));
  assert.equal((await post('resend-verification', { email })).status, 200);
  rejectFor.add(email);
  await processNextVerificationEmail();
  const firstAttempt = tokenFrom(sent.at(-1));
  assert.notEqual(firstAttempt, original);
  assert.equal((await User.findOne({ email })).verificationToken, hashToken(original));
  await User.updateOne({ email }, { $set: { 'verificationEmailJob.nextAttemptAt': new Date(0) } });
  await processNextVerificationEmail();
  assert.equal(tokenFrom(sent.at(-1)), firstAttempt);
  rejectFor.delete(email);
  assert.equal((await fetch(`${baseUrl}/api/v1/auth/verify-email?token=${original}`)).status, 200);
  assert.equal((await User.findOne({ email })).verificationEmailJob, undefined);
});

test('five failed deliveries stop automatic retries until manual resend restarts the same link', async () => {
  const email = 'manual-retry@example.invalid';
  await post('register', registration(email));
  rejectFor.add(email);
  const attempts = [];
  for (let i = 0; i < 5; i += 1) {
    assert.equal(await processNextVerificationEmail(), true);
    attempts.push(tokenFrom(sent.at(-1)));
    await User.updateOne({ email }, { $set: { 'verificationEmailJob.nextAttemptAt': new Date(0) } });
  }
  assert.equal(new Set(attempts).size, 1);
  assert.equal((await User.findOne({ email })).verificationEmailJob.attempts, 5);
  assert.equal(await processNextVerificationEmail(), false);

  await User.updateOne({ email }, { $set: { verificationResendAfter: new Date(0) } });
  assert.equal((await post('resend-verification', { email })).status, 200);
  const resumed = (await User.findOne({ email })).verificationEmailJob;
  assert.equal(resumed.attempts, 0);
  assert.equal(decryptVerificationToken(resumed), attempts[0]);
  rejectFor.delete(email);
  assert.equal(await processNextVerificationEmail(), true);
  assert.equal(tokenFrom(sent.at(-1)), attempts[0]);
  assert.equal((await fetch(`${baseUrl}/api/v1/auth/verify-email?token=${attempts[0]}`)).status, 200);
  assert.equal((await post('login', { email, password })).status, 200);
});

test('expired leases consume the five-attempt budget and manual resend cannot reset a live send', async () => {
  const email = 'lease-budget@example.invalid';
  await post('register', registration(email));
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  const workers = [];
  holdFor = { email, started: () => {}, promise: held };
  try {
    for (let i = 1; i <= 5; i += 1) {
      let started;
      const entered = new Promise((resolve) => { started = resolve; });
      holdFor.started = started;
      workers.push(processNextVerificationEmail());
      await entered;
      assert.equal((await User.findOne({ email })).verificationEmailJob.attempts, i);
      if (i < 5) {
        await User.updateOne({ email }, { $set: { 'verificationEmailJob.leaseUntil': new Date(0) } });
      }
    }
    const token = tokenFrom(sent.at(-1));
    assert.equal(new Set(sent.filter((message) => message.to === email).map(tokenFrom)).size, 1);
    assert.equal(await processNextVerificationEmail(), false);
    await User.updateOne({ email }, { $set: { verificationResendAfter: new Date(0) } });
    await requestVerificationEmail(email);
    assert.equal((await User.findOne({ email })).verificationEmailJob.attempts, 5);
    assert.equal((await User.findOne({ email })).verificationEmailJob.leaseUntil > new Date(), true);

    // Once the final lease is abandoned, manual resend may restart the same link.
    await User.updateOne({ email }, { $set: { 'verificationEmailJob.leaseUntil': new Date(0) } });
    await requestVerificationEmail(email);
    const restarted = (await User.findOne({ email })).verificationEmailJob;
    assert.equal(restarted.attempts, 0);
    assert.equal(decryptVerificationToken(restarted), token);
    rejectFor.add(email);
    holdFor = null;
    release();
    await Promise.all(workers);
    assert.equal((await User.findOne({ email })).verificationEmailJob.attempts, 0);
    rejectFor.delete(email);
    assert.equal(await processNextVerificationEmail(), true);
    assert.equal(tokenFrom(sent.at(-1)), token);
    assert.equal((await fetch(`${baseUrl}/api/v1/auth/verify-email?token=${token}`)).status, 200);
    assert.equal((await post('login', { email, password })).status, 200);
  } finally {
    holdFor = null;
    release();
    await Promise.allSettled(workers);
    rejectFor.delete(email);
  }
});

test('simultaneous worker claims reserve one attempt for a single job', async () => {
  const email = 'parallel-claims@example.invalid';
  await post('register', registration(email));
  let release;
  let started;
  const entered = new Promise((resolve) => { started = resolve; });
  holdFor = { email, started, promise: new Promise((resolve) => { release = resolve; }) };
  try {
    const claims = Array.from({ length: 8 }, () => processNextVerificationEmail());
    await entered;
    assert.equal((await User.findOne({ email })).verificationEmailJob.attempts, 1);
    assert.equal(sent.filter((message) => message.to === email).length, 1);
    assert.equal(await processNextVerificationEmail(), false);
    release();
    await Promise.all(claims);
    assert.equal((await User.findOne({ email })).verificationEmailJob, undefined);
  } finally {
    holdFor = null;
    release();
  }
});

test('successful replacement retires the old link only after SMTP accepts the new one', async () => {
  const email = 'replacement@example.invalid';
  await post('register', registration(email));
  await processNextVerificationEmail();
  const original = tokenFrom(sent.at(-1));
  await requestVerificationEmail(email);
  const pending = (await User.findOne({ email })).pendingVerificationToken;
  assert.equal((await User.findOne({ email })).verificationToken, hashToken(original));
  await processNextVerificationEmail();
  const replacement = tokenFrom(sent.at(-1));
  assert.equal(hashToken(replacement), pending);
  assert.equal((await fetch(`${baseUrl}/api/v1/auth/verify-email?token=${original}`)).status, 401);
  assert.equal((await fetch(`${baseUrl}/api/v1/auth/verify-email?token=${replacement}`)).status, 200);
});

test('concurrent resend requests create only one pending replacement', async () => {
  const email = 'two-requests@example.invalid';
  await post('register', registration(email));
  await processNextVerificationEmail();
  const original = tokenFrom(sent.at(-1));
  const [first, second] = await Promise.all([
    post('resend-verification', { email }),
    post('resend-verification', { email }),
  ]);
  assert.deepEqual(first.body, second.body);
  const user = await User.findOne({ email });
  assert.equal(user.verificationToken, hashToken(original));
  assert.equal(user.pendingVerificationToken, user.verificationEmailJob.tokenHash);
  assert.equal(sent.filter((message) => message.to === email).length, 1);
  await processNextVerificationEmail();
  assert.equal(sent.filter((message) => message.to === email).length, 2);
});

test('unknown, verified, eligible, and cooling-down resends all finish without waiting for SMTP', async () => {
  const email = 'privacy@example.invalid';
  await post('register', registration(email));
  await processNextVerificationEmail();
  let release;
  let started;
  const startedPromise = new Promise((resolve) => { started = resolve; });
  holdFor = { email, started, promise: new Promise((resolve) => { release = resolve; }) };
  const eligible = await post('resend-verification', { email });
  const working = processNextVerificationEmail();
  await startedPromise;
  const [unknown, cooling, verified] = await Promise.all([
    post('resend-verification', { email: 'unknown@example.invalid' }),
    post('resend-verification', { email }),
    post('resend-verification', { email: 'queued@example.invalid' }),
  ]);
  assert.deepEqual(eligible.body, unknown.body);
  assert.deepEqual(eligible.body, cooling.body);
  assert.deepEqual(eligible.body, verified.body);
  const pendingBefore = (await User.findOne({ email })).pendingVerificationToken;
  await User.updateOne({ email }, { $set: { verificationResendAfter: new Date(0) } });
  await post('resend-verification', { email });
  assert.equal((await User.findOne({ email })).pendingVerificationToken, pendingBefore);
  release();
  await working;
  holdFor = null;
});

async function testOverlappingFailures(email, completeSecondFirst) {
  await post('register', registration(email));
  await processNextVerificationEmail();
  const original = tokenFrom(sent.at(-1));
  await requestVerificationEmail(email);
  rejectFor.add(email);
  let releaseA;
  let startedA;
  const promiseA = new Promise((resolve) => { startedA = resolve; });
  holdFor = { email, started: startedA, promise: new Promise((resolve) => { releaseA = resolve; }) };
  const a = processNextVerificationEmail();
  await promiseA;
  await User.updateOne({ email }, { $set: { 'verificationEmailJob.leaseUntil': new Date(0) } });
  let releaseB;
  let startedB;
  const promiseB = new Promise((resolve) => { startedB = resolve; });
  holdFor = { email, started: startedB, promise: new Promise((resolve) => { releaseB = resolve; }) };
  const b = processNextVerificationEmail();
  await promiseB;
  holdFor = null;
  if (completeSecondFirst) {
    releaseB(); await b; releaseA(); await a;
  } else {
    releaseA(); await a; releaseB(); await b;
  }
  rejectFor.delete(email);
  const user = await User.findOne({ email });
  assert.equal(user.verificationToken, hashToken(original));
  assert.ok(user.verificationEmailJob);
  await User.updateOne({ email }, { $set: { 'verificationEmailJob.nextAttemptAt': new Date(0) } });
  await processNextVerificationEmail();
  assert.equal((await User.findOne({ email })).verificationEmailJob, undefined);
}

test('overlapping failed sends preserve the last delivered link in either completion order', async () => {
  await testOverlappingFailures('race-a@example.invalid', false);
  await testOverlappingFailures('race-b@example.invalid', true);
});

test('expired lease after a simulated restart retries the same link', async () => {
  const email = 'restart@example.invalid';
  await post('register', registration(email));
  const originalJob = (await User.findOne({ email })).verificationEmailJob;
  await User.updateOne({ email }, { $set: {
    'verificationEmailJob.leaseId': 'abandoned-process',
    'verificationEmailJob.leaseUntil': new Date(0),
  } });
  await processNextVerificationEmail();
  const token = tokenFrom(sent.at(-1));
  assert.equal(hashToken(token), originalJob.tokenHash);
  assert.equal((await fetch(`${baseUrl}/api/v1/auth/verify-email?token=${token}`)).status, 200);
});

test('a pending link remains usable while SMTP is still processing it', async () => {
  const email = 'verify-pending@example.invalid';
  await post('register', registration(email));
  let release;
  let started;
  const startedPromise = new Promise((resolve) => { started = resolve; });
  holdFor = { email, started, promise: new Promise((resolve) => { release = resolve; }) };
  const sending = processNextVerificationEmail();
  await startedPromise;
  const token = tokenFrom(sent.at(-1));
  assert.equal((await fetch(`${baseUrl}/api/v1/auth/verify-email?token=${token}`)).status, 200);
  release();
  await sending;
  holdFor = null;
  const user = await User.findOne({ email });
  assert.equal(user.isVerified, true);
  assert.equal(user.verificationEmailJob, undefined);
  assert.equal(user.verificationToken, undefined);
});

test('late SMTP acceptance after a lease expires cannot corrupt a newer completion', async () => {
  const email = 'late-accept@example.invalid';
  await post('register', registration(email));
  let release;
  let started;
  const startedPromise = new Promise((resolve) => { started = resolve; });
  holdFor = { email, started, promise: new Promise((resolve) => { release = resolve; }) };
  const stale = processNextVerificationEmail();
  await startedPromise;
  const firstToken = tokenFrom(sent.at(-1));
  await User.updateOne({ email }, { $set: { 'verificationEmailJob.leaseUntil': new Date(0) } });
  holdFor = null;
  await processNextVerificationEmail();
  assert.equal(tokenFrom(sent.at(-1)), firstToken);
  release();
  await stale;
  assert.equal((await User.findOne({ email })).verificationToken, hashToken(firstToken));
  assert.equal((await fetch(`${baseUrl}/api/v1/auth/verify-email?token=${firstToken}`)).status, 200);
});

test('a stalled SMTP send does not stop the worker delivering another account email', async () => {
  const slowEmail = 'slow-worker@example.invalid';
  const fastEmail = 'fast-worker@example.invalid';
  await post('register', registration(slowEmail));
  let release;
  let started;
  const startedPromise = new Promise((resolve) => { started = resolve; });
  holdFor = { email: slowEmail, started, promise: new Promise((resolve) => { release = resolve; }) };
  const worker = startVerificationEmailWorker();
  try {
    await startedPromise;
    await post('register', registration(fastEmail));
    let delivered = false;
    for (let i = 0; i < 40; i += 1) {
      delivered = Boolean((await User.findOne({ email: fastEmail })).verificationToken);
      if (delivered) break;
      await delay(100);
    }
    assert.equal(delivered, true);
    assert.ok((await User.findOne({ email: slowEmail })).verificationEmailJob);
  } finally {
    release();
    holdFor = null;
    await worker.stop();
  }
});

test('resend is throttled by client address regardless of account existence', async () => {
  let limited;
  for (let i = 0; i < 12; i += 1) {
    limited = await post('resend-verification', { email: `unknown${i}@example.invalid` });
    if (limited.status === 429) break;
  }
  assert.equal(limited.status, 429);
  assert.equal(limited.body.code, 'RATE_LIMITED');
});

test('verification expires at the 24-hour boundary and a consumed link cannot be reused', async () => {
  let clockMs = 1_800_000_000_000;
  const clock = mock.method(Date, 'now', () => clockMs);
  try {
    const activeEmail = 'expiry-active@example.invalid';
    await post('register', registration(activeEmail));
    await processNextVerificationEmail();
    const active = tokenFrom(sent.at(-1));
    const activeUser = await User.findOne({ email: activeEmail });
    assert.equal(activeUser.verificationTokenExpiresAt.getTime(), clockMs + 86_400_000);
    clockMs += 86_400_000 - 1;
    assert.equal((await fetch(`${baseUrl}/api/v1/auth/verify-email?token=${active}`)).status, 200);
    assert.equal((await fetch(`${baseUrl}/api/v1/auth/verify-email?token=${active}`)).status, 401);

    clockMs = 1_800_000_000_000;
    const expiredEmail = 'expiry-boundary@example.invalid';
    await post('register', registration(expiredEmail));
    await processNextVerificationEmail();
    const expired = tokenFrom(sent.at(-1));
    clockMs += 86_400_000;
    assert.equal((await fetch(`${baseUrl}/api/v1/auth/verify-email?token=${expired}`)).status, 401);
    assert.equal((await User.findOne({ email: expiredEmail })).isVerified, false);
  } finally { clock.mock.restore(); }
});

test('expired queued and legacy links recover through resend without mailing expired credentials', async () => {
  let clockMs = 1_810_000_000_000;
  const clock = mock.method(Date, 'now', () => clockMs);
  try {
    const queuedEmail = 'expired-queued@example.invalid';
    await post('register', registration(queuedEmail));
    const stale = await User.findOne({ email: queuedEmail });
    const staleHash = stale.pendingVerificationToken;
    clockMs += 86_400_000;
    assert.equal(await processNextVerificationEmail(), false);
    assert.equal(sent.filter((message) => message.to === queuedEmail).length, 0);
    assert.equal((await post('resend-verification', { email: queuedEmail })).status, 200);
    const fresh = await User.findOne({ email: queuedEmail });
    assert.notEqual(fresh.pendingVerificationToken, staleHash);
    await processNextVerificationEmail();
    const token = tokenFrom(sent.at(-1));
    assert.equal((await fetch(`${baseUrl}/api/v1/auth/verify-email?token=${token}`)).status, 200);

    const legacyEmail = 'legacy-link@example.invalid';
    const legacyToken = 'a'.repeat(80);
    await User.create({ name: 'Legacy', email: legacyEmail, password,
      provider: 'local', verificationToken: hashToken(legacyToken) });
    assert.equal((await fetch(`${baseUrl}/api/v1/auth/verify-email?token=${legacyToken}`)).status, 401);
    assert.equal((await post('resend-verification', { email: legacyEmail })).status, 200);
    await processNextVerificationEmail();
    assert.equal((await fetch(`${baseUrl}/api/v1/auth/verify-email?token=${legacyToken}`)).status, 401);
    assert.equal((await fetch(`${baseUrl}/api/v1/auth/verify-email?token=${tokenFrom(sent.at(-1))}`)).status, 200);
  } finally { clock.mock.restore(); }
});

test('only one concurrent verification succeeds and replacement preserves then retires the old link', async () => {
  const email = 'expiry-replace@example.invalid';
  await post('register', registration(email));
  await processNextVerificationEmail();
  const oldToken = tokenFrom(sent.at(-1));
  await requestVerificationEmail(email);
  rejectFor.add(email);
  try {
    await processNextVerificationEmail();
    assert.equal((await User.findOne({ email })).verificationToken, hashToken(oldToken));
    rejectFor.delete(email);
    await User.updateOne({ email }, { $set: { 'verificationEmailJob.nextAttemptAt': new Date(0) } });
    await processNextVerificationEmail();
    const current = tokenFrom(sent.at(-1));
    assert.equal((await fetch(`${baseUrl}/api/v1/auth/verify-email?token=${oldToken}`)).status, 401);
    const attempts = await Promise.all(Array.from({ length: 2 }, () =>
      fetch(`${baseUrl}/api/v1/auth/verify-email?token=${current}`)));
    assert.deepEqual(attempts.map((response) => response.status).sort(), [200, 401]);
  } finally { rejectFor.delete(email); }
});

test('development and production access and error logs redact encoded and repeated verification tokens', async () => {
  for (const mode of ['development', 'production']) {
    const lines = [];
    const capturedErrors = [];
    const logError = mock.method(console, 'error', (...args) => capturedErrors.push(args));
    const loggedApp = express();
    loggedApp.use(createRequestLogger(mode, { write: (line) => lines.push(line) }));
    const observed = [];
    const nested = express.Router();
    nested.get('/probe', (req, res) => {
      observed.push(req.query.token);
      res.status(req.query.fail ? 401 : 200).end();
    });
    const mounted = express.Router();
    mounted.use('/nested', nested);
    loggedApp.use('/api/v1/auth', mounted);
    loggedApp.get('/api/v1/auth/verify-email', (req, _res, next) => {
      if (req.query.fail) return next(new Error(`failed URL: ${req.originalUrl}`));
      return next();
    });
    loggedApp.use('/api/v1/auth', authRouter);
    loggedApp.use(errorHandler);
    const loggedServer = loggedApp.listen(0, '127.0.0.1');
    await new Promise((resolve) => loggedServer.once('listening', resolve));
    const origin = `http://127.0.0.1:${loggedServer.address().port}`;
    try {
      const email = `redacted-${mode}@example.invalid`;
      await post('register', registration(email));
      await processNextVerificationEmail();
      const token = tokenFrom(sent.at(-1));
      const badToken = 'b'.repeat(80);
      const referer = `${origin}/api/v1/auth/verify-email?token=${badToken}`;
      assert.equal((await fetch(`${origin}/api/v1/auth/nested/probe?%74oken=${token}`)).status, 200);
      assert.equal((await fetch(`${origin}/api/v1/auth/nested/probe?token=${badToken}&%74oken=${token}&fail=1`)).status, 401);
      assert.equal(observed[0], token);
      assert.deepEqual(observed[1], [badToken, token]);
      const success = await fetch(`${origin}/api/v1/auth/verify-email?%74oken=${token}`, {
        headers: { referer },
      });
      assert.equal(success.status, 200);
      const failure = await fetch(`${origin}/api/v1/auth/verify-email?token=${badToken}&%74oken=${token}`, {
        headers: { referer },
      });
      assert.equal(failure.status, 400);
      const rejected = await fetch(`${origin}/api/v1/auth/verify-email?token=${badToken}`, {
        headers: { referer },
      });
      assert.equal(rejected.status, 401);
      const unexpected = await fetch(`${origin}/api/v1/auth/verify-email?token=${badToken}&fail=1`, {
        headers: { referer },
      });
      assert.equal(unexpected.status, 500);
      await delay(10);
      const output = [...lines, ...capturedErrors.map((args) => args.join(' '))].join('\n');
      assert.ok(lines.length >= 6);
      assert.equal(lines.filter((line) => line.includes('/api/v1/auth/nested/probe?')).length, 2);
      assert.equal(lines.filter((line) => line.includes('/api/v1/auth/verify-email?')).length, 4);
      assert.ok(capturedErrors.length >= 2);
      assert.equal(output.includes(token), false);
      assert.equal(output.includes(badToken), false);
      assert.match(output, /REDACTED/);
    } finally {
      await new Promise((resolve, reject) => loggedServer.close((error) => error ? reject(error) : resolve()));
      logError.mock.restore();
    }
  }
});
