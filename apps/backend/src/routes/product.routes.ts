import express from 'express';
export const productRouter = express.Router();
import {
  getProductsHandler,
  getProductByIdHandler,
  createProductHandler,
  deleteProductHandler,
  updateProductHandler,
} from '../controllers/index.js';
import { authenticateUser } from '../middleware/authentication.js';
import { validate } from '../middleware/validate.js';
import {
  getProductByIdRequestSchema,
  createProductRequestSchema,
  updateProductRequestSchema,
  deleteProductRequestSchema,
} from '@opensell/shared';

productRouter
  .get('/', authenticateUser, getProductsHandler)
  .get('/:id', authenticateUser, validate(getProductByIdRequestSchema), getProductByIdHandler)
  .post('/', authenticateUser, validate(createProductRequestSchema), createProductHandler)
  .patch('/:id', authenticateUser, validate(updateProductRequestSchema), updateProductHandler)
  .delete('/:id', authenticateUser, validate(deleteProductRequestSchema), deleteProductHandler);
