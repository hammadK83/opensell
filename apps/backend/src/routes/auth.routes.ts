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
import {
  limitLoginAccount,
  limitLoginIp,
  limitRegisterIp,
  limitVerifyIp,
  limitRefreshIp,
  limitResendIp,
} from '../middleware/auth-rate-limit.js';

export const authRouter = Router();

authRouter.post('/register', limitRegisterIp, validate(registerUserRequestSchema), register);
authRouter.post('/resend-verification', limitResendIp, validate(resendVerificationRequestSchema), resendVerification);
authRouter.get('/verify-email', limitVerifyIp, validate(verifyEmailQuerySchema), verifyEmail);
authRouter.post('/login', limitLoginIp, validate(loginRequestSchema), limitLoginAccount, login);
authRouter.post('/refresh', limitRefreshIp, validate(refreshTokenRequestSchema), refresh);
authRouter.post('/logout', validate(logoutRequestSchema), logout);
