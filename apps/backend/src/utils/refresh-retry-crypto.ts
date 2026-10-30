import crypto from 'node:crypto';
import { env } from '../config/env.js';

const key = Buffer.from(env.REFRESH_RETRY_KEY, 'hex');

export function encryptRefreshSuccessor(token: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return {
    encryptedSuccessor: encrypted.toString('base64'),
    retryIv: iv.toString('base64'),
    retryTag: cipher.getAuthTag().toString('base64'),
  };
}

export function decryptRefreshSuccessor(record: {
  encryptedSuccessor: string; retryIv: string; retryTag: string;
}) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(record.retryIv, 'base64'));
  decipher.setAuthTag(Buffer.from(record.retryTag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(record.encryptedSuccessor, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
