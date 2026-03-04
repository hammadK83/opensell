import crypto from 'crypto';
import { TOKEN_LENGTH } from '@opensell/shared';

export function generateToken(): string {
  return crypto.randomBytes(TOKEN_LENGTH / 2).toString('hex');
}
