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

test('empty product lists return page metadata and still require authentication', async () => {
  const anonymous = await request(baseUrl, 'GET', '/api/v1/products');
  assert.equal(anonymous.status, 401);
  const global = await request(baseUrl, 'GET', '/api/v1/products', seller);
  const bySeller = await request(baseUrl, 'GET', `/api/v1/products/seller/${seller.id}`, buyer);
  for (const result of [global, bySeller]) {
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.data, {
      products: [], count: 0, hasMore: false, nextCursor: null,
    });
  }
  assert.equal((await request(baseUrl, 'GET', '/api/v1/users', seller)).status, 404);
});

test('default and maximum page sizes bound product results', async () => {
  await Product.insertMany(Array.from({ length: 102 }, (_, index) => ({
    name: `Product ${index}`, sellerId: seller._id,
  })));
  const first = await request(baseUrl, 'GET', '/api/v1/products', seller);
  assert.equal(first.status, 200);
  assert.equal(first.body.data.products.length, 20);
  assert.equal(first.body.data.count, 20);
  assert.equal(first.body.data.hasMore, true);
  assert.equal(typeof first.body.data.nextCursor, 'string');

  const largest = await request(baseUrl, 'GET', '/api/v1/products?limit=100', seller);
  assert.equal(largest.status, 200);
  assert.equal(largest.body.data.products.length, 100);
  assert.equal(largest.body.data.count, 100);
  assert.equal(largest.body.data.hasMore, true);
  const last = await request(baseUrl, 'GET',
    `/api/v1/products?limit=100&cursor=${encodeURIComponent(largest.body.data.nextCursor)}`, seller);
  assert.equal(last.status, 200);
  assert.equal(last.body.data.count, 2);
  assert.equal(last.body.data.hasMore, false);
  assert.equal(last.body.data.nextCursor, null);
});

test('equal timestamps traverse in descending ID order without duplicates', async () => {
  const created = await Product.insertMany(Array.from({ length: 5 }, (_, index) => ({
    name: `Tied ${index}`, sellerId: seller._id,
  })));
  const sameTime = new Date('2026-01-01T00:00:00.000Z');
  await Product.collection.updateMany({ _id: { $in: created.map((item) => item._id) } },
    { $set: { createdAt: sameTime } });
  const expected = created.map((item) => item.id).sort().reverse();
  const seen = [];
  let cursor;
  do {
    const path = `/api/v1/products?limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
    const page = await request(baseUrl, 'GET', path, seller);
    assert.equal(page.status, 200);
    assert.equal(page.body.data.count, page.body.data.products.length);
    assert.ok(page.body.data.count <= 2);
    seen.push(...page.body.data.products.map((product) => product.id));
    cursor = page.body.data.nextCursor;
    assert.equal(page.body.data.hasMore, cursor !== null);
  } while (cursor);
  assert.deepEqual(seen, expected);
  assert.equal(new Set(seen).size, 5);
});

test('global and seller cursors traverse timestamp groups and ties in exact order', async () => {
  const id = (number) => new mongoose.Types.ObjectId(number.toString(16).padStart(24, '0'));
  const newest = new Date('2026-03-01T00:00:00.000Z');
  const middle = new Date('2026-02-01T00:00:00.000Z');
  const oldest = new Date('2026-01-01T00:00:00.000Z');
  const rows = [
    [2, buyer, newest], [1, seller, newest],
    [8, seller, middle], [7, buyer, middle], [6, seller, middle],
    [9, buyer, oldest], [5, seller, oldest], [4, buyer, oldest],
  ];
  await Product.collection.insertMany(rows.map(([number, owner, createdAt]) => ({
    _id: id(number), name: `Catalog ${number}`, sellerId: owner._id,
    createdAt, updatedAt: createdAt,
  })));

  async function traverse(path, expectedNumbers, expectedSellerId) {
    const seen = [];
    const cursors = new Set();
    let cursor = null;
    let firstCursor = null;
    const pageCount = expectedNumbers.length / 2;
    // One extra attempt makes a stalled or repeating cursor fail with a bounded assertion.
    for (let pageNumber = 0; pageNumber <= pageCount; pageNumber += 1) {
      const url = `${path}?limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
      const response = await request(baseUrl, 'GET', url, seller);
      assert.equal(response.status, 200);
      const page = response.body.data;
      assert.equal(page.count, 2);
      assert.equal(page.products.length, 2);
      assert.deepEqual(page.products.map((product) => product.id),
        expectedNumbers.slice(pageNumber * 2, pageNumber * 2 + 2).map((number) => id(number).toString()));
      if (expectedSellerId) {
        assert.ok(page.products.every((product) => product.sellerId === expectedSellerId));
      }
      seen.push(...page.products.map((product) => product.id));
      const finalPage = pageNumber === pageCount - 1;
      assert.equal(page.hasMore, !finalPage);
      assert.equal(page.nextCursor === null, finalPage);
      if (finalPage) {
        assert.equal(pageNumber, pageCount - 1);
        break;
      }
      assert.equal(typeof page.nextCursor, 'string');
      assert.equal(cursors.has(page.nextCursor), false);
      cursors.add(page.nextCursor);
      cursor = page.nextCursor;
      firstCursor ??= cursor;
    }
    assert.deepEqual(seen, expectedNumbers.map((number) => id(number).toString()));
    assert.equal(new Set(seen).size, expectedNumbers.length);
    return firstCursor;
  }

  const globalCursor = await traverse('/api/v1/products', [2, 1, 8, 7, 6, 9, 5, 4]);
  await traverse(`/api/v1/products/seller/${seller.id}`, [1, 8, 6, 5], seller.id);
  const crossRoute = await request(baseUrl, 'GET',
    `/api/v1/products/seller/${seller.id}?cursor=${encodeURIComponent(globalCursor)}`, seller);
  assert.equal(crossRoute.status, 400);
  assert.equal(crossRoute.body.code, 'VALIDATION_ERROR');
});

test('seller pages stay isolated and reject global or another seller’s cursor', async () => {
  await Product.insertMany([
    { name: 'Alice 1', sellerId: seller._id },
    { name: 'Bob 1', sellerId: buyer._id },
    { name: 'Alice 2', sellerId: seller._id },
    { name: 'Bob 2', sellerId: buyer._id },
    { name: 'Alice 3', sellerId: seller._id },
  ]);
  const first = await request(baseUrl, 'GET',
    `/api/v1/products/seller/${seller.id}?limit=1`, buyer);
  assert.equal(first.status, 200);
  assert.equal(first.body.data.products[0].sellerId, seller.id);
  assert.equal(first.body.data.hasMore, true);
  const second = await request(baseUrl, 'GET',
    `/api/v1/products/seller/${seller.id}?limit=1&cursor=${encodeURIComponent(first.body.data.nextCursor)}`, buyer);
  assert.equal(second.status, 200);
  assert.equal(second.body.data.products[0].sellerId, seller.id);
  assert.notEqual(first.body.data.products[0].id, second.body.data.products[0].id);

  const crossSeller = await request(baseUrl, 'GET',
    `/api/v1/products/seller/${buyer.id}?cursor=${encodeURIComponent(first.body.data.nextCursor)}`, buyer);
  assert.equal(crossSeller.status, 400);
  assert.equal(crossSeller.body.code, 'VALIDATION_ERROR');
  const crossGlobal = await request(baseUrl, 'GET',
    `/api/v1/products?cursor=${encodeURIComponent(first.body.data.nextCursor)}`, buyer);
  assert.equal(crossGlobal.status, 400);
  assert.equal(crossGlobal.body.code, 'VALIDATION_ERROR');
});

test('invalid limits and malformed or changed cursors fail validation', async () => {
  await Product.insertMany([
    { name: 'First', sellerId: seller._id },
    { name: 'Second', sellerId: seller._id },
  ]);
  for (const query of ['limit=0', 'limit=101', 'limit=1.5', 'limit=abc', 'limit=1&limit=2',
    'cursor=garbage', 'unknown=1']) {
    const result = await request(baseUrl, 'GET', `/api/v1/products?${query}`, seller);
    assert.equal(result.status, 400, query);
    assert.equal(result.body.code, 'VALIDATION_ERROR', query);
  }
  const page = await request(baseUrl, 'GET', '/api/v1/products?limit=1', seller);
  const cursor = page.body.data.nextCursor;
  assert.ok(cursor);
  const changed = `${cursor[0] === 'A' ? 'B' : 'A'}${cursor.slice(1)}`;
  const tampered = await request(baseUrl, 'GET',
    `/api/v1/products?cursor=${encodeURIComponent(changed)}`, seller);
  assert.equal(tampered.status, 400);
  assert.equal(tampered.body.code, 'VALIDATION_ERROR');
});

test('product list indexes support the global and seller sort patterns', async () => {
  await Product.createIndexes();
  const indexes = await Product.listIndexes();
  assert.ok(indexes.some((index) => JSON.stringify(index.key) ===
    JSON.stringify({ createdAt: -1, _id: -1 })));
  assert.ok(indexes.some((index) => JSON.stringify(index.key) ===
    JSON.stringify({ sellerId: 1, createdAt: -1, _id: -1 })));
});
