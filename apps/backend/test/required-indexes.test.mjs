/* global fetch, AbortSignal */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import process from 'node:process';
import { setTimeout, clearTimeout } from 'node:timers';
import { fileURLToPath, URL } from 'node:url';
import net from 'node:net';
import { after, before, test } from 'node:test';
import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { inspectRequiredIndexes, provisionRequiredIndexes, requiredIndexes } from '../src/db/required-indexes.ts';

let memory;
let client;
const backendDir = fileURLToPath(new URL('..', import.meta.url));
const cliPath = fileURLToPath(new URL('../src/db/index-command.ts', import.meta.url));
const serverPath = fileURLToPath(new URL('../src/server.ts', import.meta.url));
const children = new Set();

function childEnv(dbName, port = 0) {
  const systemEnv = Object.fromEntries(Object.entries(process.env)
    .filter(([key]) => ['path', 'systemroot', 'temp', 'tmp'].includes(key.toLowerCase())));
  return {
    ...systemEnv,
    NODE_ENV: 'production',
    MONGO_URI: memory.getUri(),
    DB_NAME: dbName,
    PORT: String(port),
    API_URL: 'http://127.0.0.1:5000/api/v1',
    JWT_SECRET: 'test-only-index-jwt-secret',
    REFRESH_RETRY_KEY: '1'.repeat(64),
    VERIFICATION_EMAIL_KEY: '2'.repeat(64),
    EMAIL_FROM: 'test@example.invalid',
    EMAIL_HOST: '127.0.0.1',
    EMAIL_PORT: '9',
    EMAIL_USER: 'test-only-user',
    EMAIL_PASS: 'test-only-password',
  };
}

function startChild(entry, args, env) {
  const child = spawn(process.execPath, ['--import', 'tsx', entry, ...args], {
    cwd: backendDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.add(child);
  let output = '';
  let timedOut = false;
  const append = (chunk) => { output = (output + chunk.toString()).slice(-32_000); };
  child.stdout.on('data', append);
  child.stderr.on('data', append);
  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill('SIGKILL');
  }, 60_000);
  const exit = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal }));
  }).finally(() => {
    clearTimeout(timeout);
    children.delete(child);
  });
  return {
    child,
    exit,
    get output() { return output; },
    get timedOut() { return timedOut; },
    async stop() {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
      await exit;
    },
  };
}

async function runCli(dbName, mode) {
  const processHandle = startChild(cliPath, [mode], childEnv(dbName));
  const result = await processHandle.exit;
  assert.equal(processHandle.timedOut, false, processHandle.output);
  return { ...result, output: processHandle.output };
}

async function unusedPort() {
  const listener = net.createServer();
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const port = listener.address().port;
  await new Promise((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function waitForListening(handle) {
  while (!handle.output.includes('Server running on port')) {
    if (handle.child.exitCode !== null || handle.child.signalCode !== null) {
      assert.fail(`backend exited before listening: ${handle.output}`);
    }
    assert.equal(handle.timedOut, false, handle.output);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

before(async () => {
  memory = await MongoMemoryServer.create();
  client = new MongoClient(memory.getUri());
  await client.connect();
});

after(async () => {
  await Promise.all([...children].map(async (child) => {
    child.kill('SIGKILL');
    await once(child, 'close').catch(() => {});
  }));
  await client?.close();
  await memory?.stop();
});

test('production-style empty database can be provisioned and checked repeatedly', async () => {
  const db = client.db('fresh_indexes');
  assert.ok((await inspectRequiredIndexes(db)).every((item) => item.status === 'missing'));
  assert.ok((await provisionRequiredIndexes(db)).every((item) => item.status === 'ready'));
  assert.ok((await provisionRequiredIndexes(db)).every((item) => item.status === 'ready'));

  for (const spec of requiredIndexes) {
    const indexes = await db.collection(spec.collection).listIndexes().toArray();
    const actual = indexes.find((item) => item.name === spec.options.name);
    assert.ok(actual, `${spec.collection}.${spec.options.name}`);
    assert.deepEqual(actual.key, spec.key);
    assert.equal(Boolean(actual.unique), Boolean(spec.options.unique));
    assert.equal(Boolean(actual.sparse), Boolean(spec.options.sparse));
    assert.equal(actual.expireAfterSeconds, spec.options.expireAfterSeconds);
  }

  const writes = await Promise.allSettled([
    db.collection('users').insertOne({ email: 'same@example.invalid' }),
    db.collection('users').insertOne({ email: 'same@example.invalid' }),
  ]);
  assert.equal(writes.filter((item) => item.status === 'fulfilled').length, 1);
  assert.equal(writes.filter((item) => item.status === 'rejected').length, 1);

  await db.collection('refreshtokens').insertMany(Array.from({ length: 100 }, (_, index) => ({
    refreshToken: `hash-${index}`,
    expiresAt: new Date('2099-01-01'),
  })));
  const plan = await db.collection('refreshtokens')
    .find({ refreshToken: 'hash-50' })
    .hint('refreshToken_1')
    .explain('executionStats');
  const usesLookupIndex = (node) => {
    if (!node || typeof node !== 'object') return false;
    if (node.indexName === 'refreshToken_1') return true;
    return Object.values(node).some(usesLookupIndex);
  };
  assert.ok(usesLookupIndex(plan.queryPlanner.winningPlan), 'hashed token lookup should support refreshToken_1');
  assert.equal(plan.executionStats.nReturned, 1);
  assert.ok(plan.executionStats.totalKeysExamined > 0);
});

test('duplicate email data fails before creating any required index', async () => {
  const db = client.db('duplicate_indexes');
  await db.collection('users').insertMany([
    { email: 'duplicate@example.invalid' },
    { email: 'duplicate@example.invalid' },
  ]);
  await assert.rejects(provisionRequiredIndexes(db), /Duplicate user emails/);
  assert.ok((await inspectRequiredIndexes(db)).every((item) => item.status === 'missing'));
  assert.equal(await db.collection('users').countDocuments({ email: 'duplicate@example.invalid' }), 2);
});

test('incompatible existing index fails without changing data or other indexes', async () => {
  const db = client.db('conflicting_indexes');
  await db.collection('users').createIndex({ email: 1 });
  const status = await inspectRequiredIndexes(db);
  assert.equal(status.find((item) => item.name === 'email_1').status, 'conflict');
  await assert.rejects(provisionRequiredIndexes(db), /Incompatible indexes/);
  assert.equal((await db.collection('users').listIndexes().toArray()).length, 2);
  assert.equal((await inspectRequiredIndexes(db)).filter((item) => item.status === 'ready').length, 0);
});

for (const order of ['incompatible-first', 'compatible-first']) {
  test(`compatible email index wins over incompatible same-key index (${order})`, async () => {
    const db = client.db(`mixed_indexes_${order.replace('-', '_')}`);
    const collection = db.collection('users');
    await collection.insertOne({ email: `existing-${order}@example.invalid` });
    const indexes = order === 'incompatible-first'
      ? [{ name: 'email_lookup' }, { name: 'email_unique', unique: true }]
      : [{ name: 'email_unique', unique: true }, { name: 'email_lookup' }];
    for (const options of indexes) await collection.createIndex({ email: 1 }, options);
    assert.equal((await inspectRequiredIndexes(db)).find((item) => item.name === 'email_1').status, 'ready');
    await provisionRequiredIndexes(db);
    const before = await collection.listIndexes().toArray();
    const document = await collection.findOne({ email: `existing-${order}@example.invalid` });
    await provisionRequiredIndexes(db);
    assert.deepEqual(await collection.listIndexes().toArray(), before);
    assert.deepEqual(await collection.findOne({ _id: document._id }), document);
    assert.equal(before.some((index) => index.name === 'email_1'), false);
  });
}

test('compatible nondefault index name is accepted without replacement', async () => {
  const db = client.db('named_compatible_index');
  await db.collection('users').createIndex({ email: 1 }, { name: 'accounts_email_unique', unique: true });
  assert.equal((await inspectRequiredIndexes(db)).find((item) => item.name === 'email_1').status, 'ready');
  await provisionRequiredIndexes(db);
  const indexes = await db.collection('users').listIndexes().toArray();
  assert.ok(indexes.some((item) => item.name === 'accounts_email_unique'));
  assert.equal(indexes.some((item) => item.name === 'email_1'), false);
});

test('incompatible alternative with no compatible index remains a conflict', async () => {
  const db = client.db('named_incompatible_index');
  await db.collection('users').createIndex({ email: 1 }, { name: 'email_partial', unique: true, partialFilterExpression: { active: true } });
  assert.equal((await inspectRequiredIndexes(db)).find((item) => item.name === 'email_1').status, 'conflict');
  await assert.rejects(provisionRequiredIndexes(db), /Incompatible indexes/);
});

test('CLI check, apply, and repeat runs use the isolated database without changing data', async () => {
  const dbName = 'index_cli_fresh';
  const db = client.db(dbName);
  const missing = await runCli(dbName, '--check');
  assert.equal(missing.code, 1, missing.output);
  assert.match(missing.output, /missing: users\.email_1/);
  assert.deepEqual(await db.listCollections({}, { nameOnly: true }).toArray(), []);
  const applied = await runCli(dbName, '--apply');
  assert.equal(applied.code, 0, applied.output);
  assert.match(applied.output, /ready: users\.email_1/);
  assert.ok((await inspectRequiredIndexes(db)).every((item) => item.status === 'ready'));
  await db.collection('users').insertOne({ email: 'preserve@example.invalid' });
  const before = await db.collection('users').listIndexes().toArray();
  const check = await runCli(dbName, '--check');
  assert.equal(check.code, 0, check.output);
  const repeat = await runCli(dbName, '--apply');
  assert.equal(repeat.code, 0, repeat.output);
  assert.deepEqual(await db.collection('users').listIndexes().toArray(), before);
  assert.equal(await db.collection('users').countDocuments({ email: 'preserve@example.invalid' }), 1);
});

test('CLI conflicts and duplicate data fail without destructive changes', async () => {
  const conflictName = 'index_cli_conflict';
  const conflict = client.db(conflictName);
  await conflict.collection('users').createIndex({ email: 1 }, { name: 'email_lookup' });
  const original = await conflict.collection('users').listIndexes().toArray();
  const checked = await runCli(conflictName, '--check');
  assert.equal(checked.code, 1, checked.output);
  assert.match(checked.output, /conflict: users\.email_1/);
  const applied = await runCli(conflictName, '--apply');
  assert.equal(applied.code, 1, applied.output);
  assert.match(applied.output, /Incompatible indexes/);
  assert.deepEqual(await conflict.collection('users').listIndexes().toArray(), original);

  const duplicateName = 'index_cli_duplicates';
  const duplicate = client.db(duplicateName);
  await duplicate.collection('users').insertMany([{ email: 'same@example.invalid' }, { email: 'same@example.invalid' }]);
  const failed = await runCli(duplicateName, '--apply');
  assert.equal(failed.code, 1, failed.output);
  assert.match(failed.output, /Duplicate user emails/);
  assert.equal(await duplicate.collection('users').countDocuments({ email: 'same@example.invalid' }), 2);
  assert.ok((await inspectRequiredIndexes(duplicate)).every((item) => item.status === 'missing'));
});

test('production startup refuses missing and incompatible indexes before listening', async () => {
  for (const dbName of ['index_start_missing', 'index_start_conflict']) {
    const db = client.db(dbName);
    if (dbName.endsWith('conflict')) await db.collection('users').createIndex({ email: 1 }, { name: 'email_lookup' });
    const port = await unusedPort();
    const handle = startChild(serverPath, [], childEnv(dbName, port));
    try {
      const result = await handle.exit;
      assert.equal(handle.timedOut, false, handle.output);
      assert.equal(result.code, 1, handle.output);
      assert.match(handle.output, /Required database indexes are missing or incompatible/);
      assert.doesNotMatch(handle.output, /Server running on port/);
      await assert.rejects(fetch(`http://127.0.0.1:${port}/api/v1/missing`, { signal: AbortSignal.timeout(1_000) }));
      if (dbName.endsWith('missing')) {
        assert.deepEqual(await db.listCollections({}, { nameOnly: true }).toArray(), []);
      } else {
        assert.equal((await db.collection('users').listIndexes().toArray()).length, 2);
      }
    } finally {
      await handle.stop();
    }
  }
});

test('production startup serves requests with provisioned indexes', async () => {
  const dbName = 'index_start_ready';
  const db = client.db(dbName);
  await db.collection('users').createIndex({ email: 1 }, { name: 'email_lookup' });
  await db.collection('users').createIndex({ email: 1 }, { name: 'email_unique', unique: true });
  await provisionRequiredIndexes(db);
  const before = await db.collection('users').listIndexes().toArray();
  const port = await unusedPort();
  const handle = startChild(serverPath, [], childEnv(dbName, port));
  try {
    await waitForListening(handle);
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/missing`, { signal: AbortSignal.timeout(2_000) });
    assert.equal(response.status, 404);
    assert.deepEqual(await db.collection('users').listIndexes().toArray(), before);
  } finally {
    await handle.stop();
  }
});
