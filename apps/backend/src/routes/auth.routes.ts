import { Router } from 'express';
import {
  register,
  verifyEmail,
  login,
  logout,
} from '../controllers/auth.controller';
import { registerUserSchema } from '../schemas/user.schema';
import { validate } from '../middleware/validate';

export const authRouter = Router();

authRouter.post('/register', validate(registerUserSchema), register);
authRouter.get('/verify-email', verifyEmail);
authRouter.post('/login', login);
authRouter.post('/logout', logout);
