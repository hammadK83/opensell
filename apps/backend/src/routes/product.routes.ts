import express from 'express';
export const productRouter = express.Router();
import { getProductsHandler } from '../controllers/index.js';
import { authenticateUser } from '../middleware/authentication.js';

productRouter.get('/', authenticateUser, getProductsHandler);
