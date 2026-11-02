import crypto from 'node:crypto';
import { z } from 'zod';
import { env } from '../config/env.js';
import { APP_ERROR_CODES, BadRequestError } from '../errors/index.js';

const payloadSchema = z.object({
  version: z.literal(1),
  scope: z.string(),
  createdAt: z.iso.datetime(),
  id: z.string().regex(/^[0-9a-fA-F]{24}$/),
}).strict();

type CursorPayload = z.infer<typeof payloadSchema>;

function signature(encoded: string): Buffer {
  return crypto.createHmac('sha256', env.JWT_SECRET).update(encoded).digest();
}

function invalidCursor(): never {
  throw new BadRequestError(APP_ERROR_CODES.INVALID_PRODUCT_CURSOR, 'Invalid product cursor');
}

export function encodeProductCursor(scope: string, createdAt: Date, id: string): string {
  const payload: CursorPayload = { version: 1, scope, createdAt: createdAt.toISOString(), id };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${signature(encoded).toString('base64url')}`;
}

export function decodeProductCursor(token: string, scope: string): { createdAt: Date; id: string } {
  if (token.length > 512 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) invalidCursor();
  const [encoded, signed] = token.split('.');
  const provided = Buffer.from(signed, 'base64url');
  const expected = signature(encoded);
  if (provided.toString('base64url') !== signed ||
      provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) invalidCursor();
  let data: unknown;
  try {
    data = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    invalidCursor();
  }
  const parsed = payloadSchema.safeParse(data);
  if (!parsed.success || parsed.data.scope !== scope) invalidCursor();
  const createdAt = new Date(parsed.data.createdAt);
  if (!Number.isFinite(createdAt.getTime())) invalidCursor();
  return { createdAt, id: parsed.data.id };
}
