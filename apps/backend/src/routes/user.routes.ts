import express from 'express';
export const userRouter = express.Router();
import { showMeHandler, getUsersHandler, getUserByIdHandler } from '../controllers/index.js';
import { authenticateUser } from '../middleware/authentication.js';
import { validate } from '../middleware/validate.js';
import { getUserByIdRequestSchema } from '@opensell/shared';

userRouter
  .get('/me', authenticateUser, showMeHandler)
  .get('/', authenticateUser, getUsersHandler)
  .get('/:id', authenticateUser, validate(getUserByIdRequestSchema), getUserByIdHandler);
