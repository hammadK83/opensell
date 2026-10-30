import { Router } from 'express';
import { register, resendVerification, verifyEmail, login, refresh, logout } from '../controllers/index.js';
import {
  registerUserRequestSchema,
  resendVerificationRequestSchema,
  verifyEmailQuerySchema,
  loginRequestSchema,
  refreshTokenRequestSchema,
  logoutRequestSchema,
} from '@opensell/shared';
import { validate } from '../middleware/validate.js';
import { resendRateLimit } from '../middleware/resend-rate-limit.js';

export const authRouter = Router();

authRouter.post('/register', validate(registerUserRequestSchema), register);
authRouter.post('/resend-verification', resendRateLimit, validate(resendVerificationRequestSchema), resendVerification);
authRouter.get('/verify-email', validate(verifyEmailQuerySchema), verifyEmail);
authRouter.post('/login', validate(loginRequestSchema), login);
authRouter.post('/refresh', validate(refreshTokenRequestSchema), refresh);
authRouter.post('/logout', validate(logoutRequestSchema), logout);
