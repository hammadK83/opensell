import { Router } from 'express';
import { register, verifyEmail, login, logout } from '../controllers/auth.controller.js';
import { registerUserSchema } from '../schemas/user.schema.js';
import { validate } from '../middleware/validate.js';

export const authRouter = Router();

authRouter.post('/register', validate(registerUserSchema), register);
authRouter.get('/verify-email', verifyEmail);
authRouter.post('/login', login);
authRouter.post('/logout', logout);
