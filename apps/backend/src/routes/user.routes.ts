import express from 'express';
export const userRouter = express.Router();
import { getAll as getAllUsers, showMe } from '../controllers/index.js';
import { authenticateUser } from '../middleware/authentication.js';

userRouter.get('/me', authenticateUser, showMe).get('/', authenticateUser, getAllUsers);
