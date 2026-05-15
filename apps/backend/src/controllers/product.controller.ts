import { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { mapProductToResponse, sendSuccessResponse } from '../utils/index.js';
import {
  getAllProducts,
  getProductById,
  getProductsBySeller,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../services/index.js';
import { StatusCodes } from 'http-status-codes';

export const getProductsHandler = asyncHandler(async (req: Request, res: Response) => {
  const products = await getAllProducts();
  sendSuccessResponse(res, {
    products: products.map((product) => mapProductToResponse(product)),
    count: products.length,
  });
});

export const getProductByIdHandler = asyncHandler(async (req: Request, res: Response) => {
  const product = await getProductById(req.params.productId as string);
  sendSuccessResponse(res, {
    product: mapProductToResponse(product),
  });
});

export const getProductsBySellerHandler = asyncHandler(async (req: Request, res: Response) => {
  const products = await getProductsBySeller(req.params.sellerId as string);
  sendSuccessResponse(res, {
    products: products.map((product) => mapProductToResponse(product)),
    count: products.length,
  });
});

export const createProductHandler = asyncHandler(async (req: Request, res: Response) => {
  const product = await createProduct({ ...req.body, sellerId: req.user.id });
  sendSuccessResponse(res, mapProductToResponse(product), StatusCodes.CREATED);
});

export const updateProductHandler = asyncHandler(async (req: Request, res: Response) => {
  const product = await updateProduct(
    req.params.productId as string,
    req.user?.id as string,
    req.body,
  );
  sendSuccessResponse(res, mapProductToResponse(product), StatusCodes.CREATED);
});

export const deleteProductHandler = asyncHandler(async (req: Request, res: Response) => {
  await deleteProduct(req.params.productId as string, req.user.id);
  sendSuccessResponse(res);
});
