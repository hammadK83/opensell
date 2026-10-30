import crypto from 'node:crypto';
import { AuthRateLimit } from '../models/auth-rate-limit.model.js';
import { env } from '../config/env.js';

export interface RateLimitPolicy {
  name: string;
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
  count: number;
}

export async function consumeAuthRateLimit(
  policy: RateLimitPolicy,
  identity: string,
  now = new Date(Date.now()),
): Promise<RateLimitResult> {
  const startedAt = Math.floor(now.getTime() / policy.windowMs) * policy.windowMs;
  const windowEndsAt = startedAt + policy.windowMs;
  // Hash account and IP values so the limiter collection does not store raw identifiers.
  const digest = crypto.createHmac('sha256', env.JWT_SECRET)
    .update(policy.name).update('\0').update(identity).digest('hex');
  const key = `${policy.name}:${digest}:${startedAt}`;
  const update = {
    $inc: { count: 1 },
    $setOnInsert: { expiresAt: new Date(windowEndsAt + policy.windowMs) },
  };
  let counter;
  try {
    counter = await AuthRateLimit.findOneAndUpdate({ _id: key }, update, { new: true, upsert: true });
  } catch (error) {
    // Concurrent first requests may race on the built-in unique _id index.
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 11000)) throw error;
    counter = await AuthRateLimit.findOneAndUpdate({ _id: key }, { $inc: { count: 1 } }, { new: true });
  }
  if (!counter) throw new Error('Rate limit counter was not saved');
  return {
    allowed: counter.count <= policy.limit,
    retryAfterSeconds: Math.max(1, Math.ceil((windowEndsAt - now.getTime()) / 1_000)),
    count: counter.count,
  };
}
