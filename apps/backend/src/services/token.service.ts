import jwt from 'jsonwebtoken';
import { UserDto } from '@opensell/shared';
import { env } from '../config/env.js';

const options: jwt.SignOptions = {
  expiresIn: env.JWT_ACCESS_TOKEN_TTL as jwt.SignOptions['expiresIn'],
};

export const createJWTToken = (payload: UserDto): string => {
  return jwt.sign(payload as object, env.JWT_SECRET, options);
};

export const verifyJwtToken = (token: string): UserDto => {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    return decoded as UserDto;
  } catch {
    return null as unknown as UserDto;
  }
};
