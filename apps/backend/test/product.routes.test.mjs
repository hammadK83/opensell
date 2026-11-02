/* global fetch */
import assert from 'node:assert/strict';
import process from 'node:process';
import { after, before, beforeEach, test } from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

Object.assign(process.env, {
  NODE_ENV: 'production',
  MONGO_URI: 'mongodb://127.0.0.1:27017',
  DB_NAME: 'opensell_product_routes_test',
  JWT_SECRET: 'test-only-jwt-secret',
  EMAIL_FROM: 'test@example.invalid',
  EMAIL_HOST: '127.0.0.1',
  EMAIL_USER: 'test',
  EMAIL_PASS: 'test',
  VERIFICATION_EMAIL_KEY: '1'.repeat(64),
  REFRESH_RETRY_KEY: '2'.repeat(64),
});

const [
  { default: app },
  { User },
  { Product },
  { createProductHandler, updateProductHandler, deleteProductHandler },
  { default: errorHandler },
] = await Promise.all([
  import('../src/app.ts'),
  import('../src/models/user.model.ts'),
  import('../src/models/product.model.ts'),
  import('../src/controllers/product.controller.ts'),
  import('../src/middleware/error-handler.ts'),
]);

let database;
let server;
let baseUrl;
let seller;
let buyer;

before(async () => {
  database = await MongoMemoryServer.create();
  await mongoose.connect(database.getUri(), { dbName: 'opensell_product_routes_test' });
  await User.init();
  await Product.init();
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  await Product.deleteMany({});
  await User.deleteMany({});
  [seller, buyer] = await User.create([
    { name: 'Alice Seller', email: 'alice@example.invalid', provider: 'google', isVerified: true },
    { name: 'Bob Buyer', email: 'bob@example.invalid', provider: 'google', isVerified: true },
  ]);
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await mongoose.disconnect();
  if (database) await database.stop();
});

function tokenFor(user) {
  return jwt.sign({
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }, process.env.JWT_SECRET, { expiresIn: '15m' });
}

async function request(origin, method, path, user, body) {
  const response = await fetch(`${origin}${path}`, {
    method,
    headers: {
      ...(user ? { authorization: `Bearer ${tokenFor(user)}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json() };
}

test('product mutations reject unauthenticated requests without changing data', async () => {
  const product = await Product.create({ name: 'Desk', price: 100, sellerId: seller._id });
  for (const [method, path, body] of [
    ['POST', '/api/v1/products', { name: 'Unauthorized desk', price: 50 }],
    ['PATCH', `/api/v1/products/${product.id}`, { name: 'Changed' }],
    ['DELETE', `/api/v1/products/${product.id}`],
  ]) {
    const result = await request(baseUrl, method, path, undefined, body);
    assert.equal(result.status, 401);
    assert.equal(result.body.code, 'UNAUTHORIZED');
  }
  assert.equal(await Product.countDocuments(), 1);
  assert.equal((await Product.findById(product.id)).name, 'Desk');
});

test('authenticated seller can create, update, and delete their own product', async () => {
  const created = await request(baseUrl, 'POST', '/api/v1/products', seller, {
    name: 'Desk', price: 100,
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.sellerId, seller.id);
  const id = created.body.data.id;
  assert.equal((await Product.findById(id)).sellerId.toString(), seller.id);

  const updated = await request(baseUrl, 'PATCH', `/api/v1/products/${id}`, seller, {
    name: 'Updated desk',
  });
  assert.equal(updated.status, 201);
  assert.equal(updated.body.data.name, 'Updated desk');
  assert.equal((await Product.findById(id)).name, 'Updated desk');

  const deleted = await request(baseUrl, 'DELETE', `/api/v1/products/${id}`, seller);
  assert.equal(deleted.status, 200);
  assert.equal(await Product.findById(id), null);
});

test('another user cannot update or delete the seller’s product', async () => {
  const product = await Product.create({ name: 'Seller desk', price: 100, sellerId: seller._id });
  const updated = await request(baseUrl, 'PATCH', `/api/v1/products/${product.id}`, buyer, {
    name: 'Stolen desk',
  });
  assert.equal(updated.status, 404);
  assert.equal(updated.body.code, 'NOT_FOUND');
  const deleted = await request(baseUrl, 'DELETE', `/api/v1/products/${product.id}`, buyer);
  assert.equal(deleted.status, 403);
  assert.equal(deleted.body.code, 'FORBIDDEN');
  assert.equal((await Product.findById(product.id)).name, 'Seller desk');
});

test('a missing user in a product handler reaches the four-argument error middleware', async () => {
  const isolated = express();
  isolated.use(express.json());
  isolated.post('/products', createProductHandler);
  isolated.patch('/products/:productId', updateProductHandler);
  isolated.delete('/products/:productId', deleteProductHandler);
  isolated.use(errorHandler);
  const isolatedServer = isolated.listen(0, '127.0.0.1');
  await new Promise((resolve) => isolatedServer.once('listening', resolve));
  const origin = `http://127.0.0.1:${isolatedServer.address().port}`;
  try {
    for (const [method, path, body] of [
      ['POST', '/products', { name: 'Desk' }],
      ['PATCH', '/products/507f1f77bcf86cd799439011', { name: 'Changed' }],
      ['DELETE', '/products/507f1f77bcf86cd799439011'],
    ]) {
      const result = await request(origin, method, path, undefined, body);
      assert.equal(result.status, 401);
      assert.equal(result.body.code, 'UNAUTHORIZED');
      assert.equal(result.body.message, 'Authentication required');
    }
    assert.equal(await Product.countDocuments(), 0);
  } finally {
    await new Promise((resolve, reject) => isolatedServer.close((error) => error ? reject(error) : resolve()));
  }
});
