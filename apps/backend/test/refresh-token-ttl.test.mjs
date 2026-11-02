import assert from 'node:assert/strict';
import { test } from 'node:test';
import { refreshTokenTtlSchema } from '../src/config/refresh-token-ttl.ts';

test('refresh token TTL defaults to 30 days', () => {
  assert.equal(refreshTokenTtlSchema.parse(undefined), '30d');
});

test('accepts valid positive durations that produce valid expiry dates', () => {
  for (const value of ['1ms', '30d', '1y']) {
    assert.equal(refreshTokenTtlSchema.safeParse(value).success, true, value);
  }
});

test('rejects empty and malformed durations through normal schema errors', () => {
  for (const value of ['', 'not-a-duration']) {
    assert.doesNotThrow(() => refreshTokenTtlSchema.safeParse(value));
    assert.equal(refreshTokenTtlSchema.safeParse(value).success, false, JSON.stringify(value));
  }
});

test('rejects zero and negative durations', () => {
  for (const value of ['0s', '-1d']) {
    assert.equal(refreshTokenTtlSchema.safeParse(value).success, false, value);
  }
});

test('rejects durations that overflow the JavaScript date range', () => {
  assert.equal(refreshTokenTtlSchema.safeParse('1000000000d').success, false);
});
