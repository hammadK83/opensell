/* global fetch */
import assert from 'node:assert/strict';
import process from 'node:process';
import { after, before, test, mock } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import { MongoMemoryServer } from 'mongodb-memory-server';

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

const [{ default: app }, { User }] = await Promise.all([
  import('../src/app.ts'),
  import('../src/models/user.model.ts'),
]);
const { processNextVerificationEmail, requestVerificationEmail, startVerificationEmailWorker } =
  await import('../src/services/verification-email.service.ts');
const { hashToken } = await import('../src/utils/hash-token.ts');
const { decryptVerificationToken } = await import('../src/utils/verification-email-crypto.ts');

let db;
let server;
let baseUrl;
before(async () => {
  db = await MongoMemoryServer.create();
  await mongoose.connect(db.getUri(), { dbName: 'opensell_auth_routes_test' });
  await User.init();
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
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
