import { Router } from 'express';
import { register, verifyEmail, login, refresh, logout } from '../controllers/index.js';
import {
  registerUserRequestSchema,
  verifyEmailQuerySchema,
  loginRequestSchema,
  refreshTokenRequestSchema,
  logoutRequestSchema,
} from '@opensell/shared';
import { validate } from '../middleware/validate.js';

export const authRouter = Router();

authRouter.post('/register', validate(registerUserRequestSchema), register);
authRouter.get('/verify-email', validate(verifyEmailQuerySchema), verifyEmail);
authRouter.post('/login', validate(loginRequestSchema), login);
authRouter.post('/refresh', validate(refreshTokenRequestSchema), refresh);
authRouter.post('/logout', validate(logoutRequestSchema), logout);
