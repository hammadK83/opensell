import crypto from 'crypto';
import { VERIFY_EMAIL_TOKEN_LENGTH } from '@opensell/shared';
import { hashToken } from './hash-token.js';

interface IVerificationToken {
  rawToken: string;
  tokenHash: string;
}

export function generateVerificationToken(): IVerificationToken {
  const rawToken = crypto.randomBytes(VERIFY_EMAIL_TOKEN_LENGTH / 2).toString('hex');
  const tokenHash = hashToken(rawToken);
  return { rawToken, tokenHash };
}
