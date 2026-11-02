import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { test } from 'node:test';
import {
  MAX_PASSWORD_BYTES,
  productListQuerySchema,
  publicUserSchema,
  registerUserSchema,
  utf8ByteLength,
} from '@opensell/shared';

test('built public entry counts UTF-8 bytes for supported and malformed Unicode', () => {
  const values = ['ascii', 'é', '€', '😀', 'aé€😀', '\ud800', '\udc00', 'x\ud800y'];
  for (const value of values) assert.equal(utf8ByteLength(value), Buffer.byteLength(value));
  assert.equal(MAX_PASSWORD_BYTES, 72);
});

test('registration schema accepts exactly 72 bytes and rejects 73', () => {
  const base = { name: 'Jane Doe', email: 'jane@example.invalid' };
  const accepted = `Aa1!${'é'.repeat(34)}`;
  const rejected = `${accepted}a`;
  assert.equal(Buffer.byteLength(accepted), 72);
  assert.equal(registerUserSchema.safeParse({ ...base, password: accepted }).success, true);
  assert.equal(registerUserSchema.safeParse({ ...base, password: rejected }).success, false);
});

test('product list schema coerces supported limits and rejects invalid or extra query fields', () => {
  assert.deepEqual(productListQuerySchema.parse({}), { limit: 20 });
  assert.equal(productListQuerySchema.parse({ limit: '1' }).limit, 1);
  assert.equal(productListQuerySchema.parse({ limit: '100' }).limit, 100);
  for (const query of [
    { limit: '0' }, { limit: '101' }, { limit: '1.5' }, { limit: 'many' },
    { other: 'value' }, { cursor: '' }, { cursor: 'x'.repeat(513) },
  ]) assert.equal(productListQuerySchema.safeParse(query).success, false);
});

test('public profile schema strips private fields and coerces the join date', () => {
  const parsed = publicUserSchema.parse({
    id: '507f1f77bcf86cd799439011',
    name: 'Jane Doe',
    profileImage: 'https://example.invalid/profile.png',
    createdAt: '2026-01-02T03:04:05.000Z',
    email: 'private@example.invalid',
    updatedAt: '2026-02-03T04:05:06.000Z',
  });
  assert.deepEqual(Object.keys(parsed).sort(), ['createdAt', 'id', 'name', 'profileImage']);
  assert.equal(parsed.createdAt.toISOString(), '2026-01-02T03:04:05.000Z');
});
