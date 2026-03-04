import { hashToken, generateToken } from './index.js';

interface IVerificationToken {
  rawToken: string;
  tokenHash: string;
}

export function generateVerificationToken(): IVerificationToken {
  const rawToken = generateToken();
  const tokenHash = hashToken(rawToken);
  return { rawToken, tokenHash };
}
