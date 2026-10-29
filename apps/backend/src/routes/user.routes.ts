import express from 'express';
export const userRouter = express.Router();
import { showMeHandler, getUserByIdHandler } from '../controllers/index.js';
import { authenticateUser } from '../middleware/authentication.js';
import { validate } from '../middleware/validate.js';
import { getUserByIdRequestSchema } from '@opensell/shared';

userRouter
  .get('/me', authenticateUser, showMeHandler)
  .get('/:id', authenticateUser, validate(getUserByIdRequestSchema), getUserByIdHandler);
