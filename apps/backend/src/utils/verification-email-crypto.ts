import crypto from 'node:crypto';
import { env } from '../config/env.js';

const key = Buffer.from(env.VERIFICATION_EMAIL_KEY, 'hex');

export function encryptVerificationToken(rawToken: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(rawToken, 'utf8'), cipher.final()]);
  return {
    encryptedToken: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  };
}

export function decryptVerificationToken(job: { encryptedToken: string; iv: string; tag: string }) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(job.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(job.tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(job.encryptedToken, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
