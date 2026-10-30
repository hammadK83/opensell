/* global fetch */
import assert from 'node:assert/strict';
import process from 'node:process';
import { after, before, beforeEach, mock, test } from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

Object.assign(process.env, {
  NODE_ENV: 'production',
  MONGO_URI: 'mongodb://127.0.0.1:27017',
  DB_NAME: 'opensell_rate_limit_test',
  JWT_SECRET: 'test-only-jwt-secret',
  EMAIL_FROM: 'test@example.invalid',
  EMAIL_HOST: '127.0.0.1',
  EMAIL_USER: 'test',
  EMAIL_PASS: 'test',
  VERIFICATION_EMAIL_KEY: '1'.repeat(64),
  REFRESH_RETRY_KEY: '2'.repeat(64),
});

const [{ default: app }, { AuthRateLimit }, { User }] = await Promise.all([
  import('../src/app.ts'),
  import('../src/models/auth-rate-limit.model.ts'),
  import('../src/models/user.model.ts'),
]);

let mongo;
let server;
let baseUrl;
let clockMs = 1_800_000_000_000;
before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: 'opensell_rate_limit_test' });
  await AuthRateLimit.init();
  mock.method(Date, 'now', () => clockMs);
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  clockMs = 1_800_000_000_000;
  app.set('trust proxy', 0);
  await AuthRateLimit.deleteMany({});
});

after(async () => {
  mock.restoreAll();
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

async function request(path, { method = 'POST', body, headers = {} } = {}) {
  const response = await fetch(`${baseUrl}/api/v1/auth/${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, retryAfter: response.headers.get('retry-after'), body: await response.json() };
}

test('register, verify, refresh, and resend reject over-limit requests before validation', async () => {
  const cases = [
    { path: 'register', body: {}, limit: 5, windowSeconds: 3600 },
    { path: 'verify-email?token=bad', method: 'GET', limit: 20, windowSeconds: 900 },
    { path: 'refresh', body: {}, limit: 30, windowSeconds: 900 },
    { path: 'resend-verification', body: {}, limit: 10, windowSeconds: 900 },
  ];
  for (const item of cases) {
    for (let i = 0; i < item.limit; i += 1) {
      assert.equal((await request(item.path, item)).status, 400, item.path);
    }
    const blocked = await request(item.path, item);
    assert.equal(blocked.status, 429, item.path);
    assert.equal(blocked.retryAfter, String(item.windowSeconds));
    assert.deepEqual(blocked.body, {
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please try again later.',
    });
    if (item.path === 'register') {
      const valid = await request('register', {
        body: { name: 'Ada Seller', email: 'blocked@example.invalid', password: 'StrongPass1!', provider: 'local' },
      });
      assert.equal(valid.status, 429);
      assert.equal(await User.countDocuments({ email: 'blocked@example.invalid' }), 0);
    }
  }
});

test('login limits normalize account email while keeping unrelated accounts available', async () => {
  for (let i = 0; i < 10; i += 1) {
    const email = i % 2 ? 'SELLER@example.invalid' : 'seller@example.invalid';
    assert.equal((await request('login', { body: { email, password: 'wrong' } })).status, 401);
  }
  const blocked = await request('login', { body: { email: 'seller@example.invalid', password: 'wrong' } });
  assert.equal(blocked.status, 429);
  assert.equal(blocked.retryAfter, '900');
  assert.equal((await request('login', { body: { email: 'buyer@example.invalid', password: 'wrong' } })).status, 401);
  const keys = (await AuthRateLimit.find()).map((row) => row.id);
  assert.equal(keys.some((key) => key.includes('seller@example.invalid')), false);
});

test('login IP limit bounds malformed requests before account validation', async () => {
  for (let i = 0; i < 30; i += 1) {
    assert.equal((await request('login', { body: {} })).status, 400);
  }
  assert.equal((await request('login', { body: {} })).status, 429);
});

test('a new window restores access while old counters remain until TTL cleanup', async () => {
  for (let i = 0; i < 10; i += 1) {
    assert.equal((await request('resend-verification', { body: { email: 'unknown@example.invalid' } })).status, 200);
  }
  assert.equal((await request('resend-verification', { body: { email: 'unknown@example.invalid' } })).status, 429);
  clockMs += 900_000;
  assert.equal((await request('resend-verification', { body: { email: 'unknown@example.invalid' } })).status, 200);
  assert.equal(await AuthRateLimit.countDocuments(), 2);
  const indexes = await AuthRateLimit.collection.indexes();
  assert.ok(indexes.some((index) => index.key.expiresAt === 1 && index.expireAfterSeconds === 0));
});

test('parallel requests cannot exceed the shared resend threshold', async () => {
  const results = await Promise.all(Array.from({ length: 12 }, () =>
    request('resend-verification', { body: { email: 'unknown@example.invalid' } })));
  assert.equal(results.filter((result) => result.status === 200).length, 10);
  assert.equal(results.filter((result) => result.status === 429).length, 2);
  assert.equal((await AuthRateLimit.findOne()).count, 12);
});

test('a counter write failure prevents registration work', async () => {
  const write = mock.method(AuthRateLimit, 'findOneAndUpdate', async () => {
    throw new Error('test database write failure');
  });
  try {
    const result = await request('register', {
      body: { name: 'Ada Seller', email: 'blocked@example.invalid', password: 'StrongPass1!', provider: 'local' },
    });
    assert.equal(result.status, 500);
    assert.equal(await User.countDocuments({ email: 'blocked@example.invalid' }), 0);
  } finally {
    write.mock.restore();
  }
});

test('forwarded IP headers cannot evade the default direct-connection limit', async () => {
  for (let i = 0; i < 5; i += 1) {
    assert.equal((await request('register', {
      body: {}, headers: { 'x-forwarded-for': `198.51.100.${i + 1}` },
    })).status, 400);
  }
  assert.equal((await request('register', {
    body: {}, headers: { 'x-forwarded-for': '198.51.100.99' },
  })).status, 429);
});

test('a configured single proxy uses the client address from its last forwarded hop', async () => {
  app.set('trust proxy', 1);
  try {
    for (let i = 0; i < 5; i += 1) {
      assert.equal((await request('register', {
        body: {}, headers: { 'x-forwarded-for': i % 2 ? '198.51.100.10:1234' : '198.51.100.10' },
      })).status, 400);
    }
    assert.equal((await request('register', {
      body: {}, headers: { 'x-forwarded-for': '203.0.113.99, 198.51.100.10' },
    })).status, 429);
    assert.equal((await request('register', {
      body: {}, headers: { 'x-forwarded-for': '198.51.100.11' },
    })).status, 400);
  } finally {
    app.set('trust proxy', 0);
  }
});
