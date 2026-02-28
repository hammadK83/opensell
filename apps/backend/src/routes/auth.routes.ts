import { Router } from 'express';
import { register, verifyEmail, login, logout } from '../controllers/auth.controller.js';
import { registerUserRequestSchema } from '@opensell/shared';
import { validate } from '../middleware/validate.js';

export const authRouter = Router();

authRouter.post('/register', validate(registerUserRequestSchema), register);
authRouter.get('/verify-email', verifyEmail);
authRouter.post('/login', login);
authRouter.post('/logout', logout);
