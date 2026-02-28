import crypto from 'crypto';

interface IVerificationToken {
  rawToken: string;
  tokenHash: string;
}

export function generateVerificationToken(): IVerificationToken {
  const rawToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  return { rawToken, tokenHash };
}
