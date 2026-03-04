import jwt from 'jsonwebtoken';
import { UserResponse } from '@opensell/shared';

const options: jwt.SignOptions = {
  expiresIn: (process.env.JWT_ACCESS_TOKEN_TTL || '15m') as jwt.SignOptions['expiresIn'],
};

export const createJWTToken = (payload: UserResponse): string => {
  return jwt.sign(
    payload as object,
    (process.env.JWT_SECRET as string) || 'default-secret-key',
    options,
  );
};
