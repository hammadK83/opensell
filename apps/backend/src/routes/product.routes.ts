import express from 'express';
export const productRouter = express.Router();
import {
  getProductsHandler,
  createProductHandler,
  deleteProductHandler,
} from '../controllers/index.js';
import { authenticateUser } from '../middleware/authentication.js';
import { validate } from '../middleware/validate.js';
import { createProductRequestSchema, deleteProductRequestSchema } from '@opensell/shared';

productRouter
  .get('/', authenticateUser, getProductsHandler)
  .post('/', authenticateUser, validate(createProductRequestSchema), createProductHandler)
  .delete('/:id', authenticateUser, validate(deleteProductRequestSchema), deleteProductHandler);
