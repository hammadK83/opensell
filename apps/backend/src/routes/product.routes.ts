import express from 'express';
export const productRouter = express.Router();
import {
  getProductsHandler,
  getProductByIdHandler,
  getProductsBySellerHandler,
  createProductHandler,
  deleteProductHandler,
  updateProductHandler,
} from '../controllers/index.js';
import { authenticateUser } from '../middleware/authentication.js';
import { validate } from '../middleware/validate.js';
import {
  getProductByIdRequestSchema,
  getProductsBySellerRequestSchema,
  createProductRequestSchema,
  updateProductRequestSchema,
  deleteProductRequestSchema,
} from '@opensell/shared';

productRouter
  .get('/', authenticateUser, getProductsHandler)
  .get(
    '/seller/:sellerId',
    authenticateUser,
    validate(getProductsBySellerRequestSchema),
    getProductsBySellerHandler,
  )
  .get(
    '/:productId',
    authenticateUser,
    validate(getProductByIdRequestSchema),
    getProductByIdHandler,
  )
  .post('/', authenticateUser, validate(createProductRequestSchema), createProductHandler)
  .patch(
    '/:productId',
    authenticateUser,
    validate(updateProductRequestSchema),
    updateProductHandler,
  )
  .delete(
    '/:productId',
    authenticateUser,
    validate(deleteProductRequestSchema),
    deleteProductHandler,
  );
