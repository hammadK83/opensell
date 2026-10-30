/* global fetch */
import assert from 'node:assert/strict';
import process from 'node:process';
import { after, before, mock, test } from 'node:test';
import jwt from 'jsonwebtoken';

// The app validates its environment during import; this suite never opens a database.
Object.assign(process.env, {
  NODE_ENV: 'production',
  MONGO_URI: 'mongodb://127.0.0.1:27017',
  DB_NAME: 'opensell_user_routes_test',
  JWT_SECRET: 'test-only-jwt-secret',
  EMAIL_FROM: 'test@example.invalid',
  EMAIL_HOST: '127.0.0.1',
  EMAIL_USER: 'test',
  EMAIL_PASS: 'test',
  VERIFICATION_EMAIL_KEY: '1'.repeat(64),
  REFRESH_RETRY_KEY: '2'.repeat(64),
});

const [{ default: app }, { User }, { env }] = await Promise.all([
  import('../src/app.ts'),
  import('../src/models/user.model.ts'),
  import('../src/config/env.ts'),
]);

const users = [
  new User({
    _id: '507f1f77bcf86cd799439011',
    name: 'Ada Seller',
    email: 'ada@example.invalid',
    profileImage: 'https://example.invalid/ada.png',
    isVerified: true,
    password: 'private-password-hash',
    verificationToken: 'private-verification-hash',
    createdAt: new Date('2026-01-02T00:00:00.000Z'),
    updatedAt: new Date('2026-02-03T00:00:00.000Z'),
  }),
  new User({
    _id: '507f1f77bcf86cd799439012',
    name: 'Ben Buyer',
    email: 'ben@example.invalid',
    isVerified: true,
    password: 'another-private-password-hash',
    createdAt: new Date('2026-03-04T00:00:00.000Z'),
    updatedAt: new Date('2026-04-05T00:00:00.000Z'),
  }),
];

let server;
let baseUrl;

before(async () => {
  mock.method(User, 'findById', (id) => ({
    select: (fields) => {
      assert.equal(fields, 'name profileImage createdAt');
      return Promise.resolve(users.find((user) => user.id === id) ?? null);
    },
  }));
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  mock.restoreAll();
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

function tokenFor(user) {
  return jwt.sign({
    id: user.id,
    name: user.name,
    email: user.email,
    profileImage: user.profileImage,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }, env.JWT_SECRET, { expiresIn: '15m' });
}

async function get(path, user) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: user ? { Authorization: `Bearer ${tokenFor(user)}` } : {},
  });
  return { status: response.status, body: await response.json() };
}

test('own account stays private to its authenticated owner', async () => {
  const response = await get('/api/v1/users/me', users[0]);
  assert.equal(response.status, 200);
  assert.equal(response.body.data.user.id, users[0].id);
  assert.equal(response.body.data.user.email, users[0].email);
  assert.notEqual(response.body.data.user.email, users[1].email);
});

test('individual profiles reject unauthenticated clients and the directory is unavailable', async () => {
  const profile = await get(`/api/v1/users/${users[0].id}`);
  const directory = await get('/api/v1/users', users[0]);
  const anonymousDirectory = await get('/api/v1/users');
  assert.equal(profile.status, 401);
  assert.equal(directory.status, 404);
  assert.equal(anonymousDirectory.status, 404);
});

test('individual profiles expose only public fields to another signed-in user', async () => {
  const profile = await get(`/api/v1/users/${users[0].id}`, users[1]);
  assert.equal(profile.status, 200);
  assert.equal(profile.body.data.user.name, users[0].name);
  assert.equal(profile.body.data.user.createdAt, users[0].createdAt.toISOString());
  assert.equal(profile.body.data.user.id, users[0].id);
  assert.equal(profile.body.data.user.profileImage, users[0].profileImage);
  assert.deepEqual(Object.keys(profile.body.data.user).sort(), [
    'createdAt', 'id', 'name', 'profileImage',
  ]);
  assert.equal(Object.hasOwn(profile.body.data.user, 'email'), false);
  assert.equal(Object.hasOwn(profile.body.data.user, 'updatedAt'), false);
  assert.equal(Object.hasOwn(profile.body.data.user, 'password'), false);
  assert.equal(Object.hasOwn(profile.body.data.user, 'verificationToken'), false);
});

test('a public profile without an image still excludes private fields', async () => {
  const profile = await get(`/api/v1/users/${users[1].id}`, users[0]);
  assert.equal(profile.status, 200);
  assert.deepEqual(profile.body.data.user, {
    id: users[1].id,
    name: users[1].name,
    createdAt: users[1].createdAt.toISOString(),
  });
});

test('unknown individual profile returns not found without private data', async () => {
  const result = await get('/api/v1/users/507f1f77bcf86cd799439013', users[1]);
  assert.equal(result.status, 404);
  assert.equal(JSON.stringify(result.body).includes(users[0].email), false);
});
