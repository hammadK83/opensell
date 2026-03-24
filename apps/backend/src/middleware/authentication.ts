import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { userResponseSchema } from '@opensell/shared';
import { APP_ERROR_CODES, UnauthorizedError } from '../errors/index.js';
import { env } from '../config/env.js';
import { z } from 'zod';

export const authenticateUser = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError(
      APP_ERROR_CODES.MISSING_AUTH_TOKEN,
      'Authorization header missing or malformed',
    );
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    const result = userResponseSchema.safeParse(decoded);
    if (!result.success) {
      // Bad data in token
      console.error('Token schema mismatch:', z.treeifyError(result.error));
      throw new UnauthorizedError(
        APP_ERROR_CODES.INVALID_AUTH_TOKEN_PAYLOAD,
        'Invalid token payload',
      );
    }
    req.user = result.data;
    next();
  } catch (error) {
    next(error);
  }
};
