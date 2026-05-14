import { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { mapProductToResponse, sendSuccessResponse } from '../utils/index.js';
import { getAllProducts, createProduct, deleteProduct } from '../services/index.js';
import { StatusCodes } from 'http-status-codes';

export const getProductsHandler = asyncHandler(async (req: Request, res: Response) => {
  const products = await getAllProducts();
  sendSuccessResponse(res, {
    products: products.map((product) => mapProductToResponse(product)),
    count: products.length,
  });
});

export const createProductHandler = asyncHandler(async (req: Request, res: Response) => {
  const product = await createProduct({ ...req.body, sellerId: req.user.id });
  sendSuccessResponse(res, mapProductToResponse(product), StatusCodes.CREATED);
});

export const deleteProductHandler = asyncHandler(async (req: Request, res: Response) => {
  await deleteProduct(req.params.id as string, req.user.id);
  sendSuccessResponse(res);
});
