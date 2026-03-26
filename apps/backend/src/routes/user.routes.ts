import express from 'express';
export const userRouter = express.Router();
import { showMe } from '../controllers/user.controller.js';
import { authenticateUser } from '../middleware/authentication.js';

userRouter.get('/me', authenticateUser, showMe);
