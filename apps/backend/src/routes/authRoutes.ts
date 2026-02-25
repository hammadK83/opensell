import { Router } from 'express';
import {
  register,
  verifyEmail,
  login,
  logout,
} from '../controllers/authController';

export const authRouter = Router();

authRouter.post('/register', register);
authRouter.get('/verify-email', verifyEmail);
authRouter.post('/login', login);
authRouter.post('/logout', logout);
