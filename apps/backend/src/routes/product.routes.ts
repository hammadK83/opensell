import express from 'express';
export const productRouter = express.Router();
import {
  getProductsHandler,
  createProductHandler,
  deleteProductHandler,
  updateProductHandler,
} from '../controllers/index.js';
import { authenticateUser } from '../middleware/authentication.js';
import { validate } from '../middleware/validate.js';
import {
  createProductRequestSchema,
  updateProductRequestSchema,
  deleteProductRequestSchema,
} from '@opensell/shared';

productRouter
  .get('/', authenticateUser, getProductsHandler)
  .post('/', authenticateUser, validate(createProductRequestSchema), createProductHandler)
  .patch('/:id', authenticateUser, validate(updateProductRequestSchema), updateProductHandler)
  .delete('/:id', authenticateUser, validate(deleteProductRequestSchema), deleteProductHandler);
