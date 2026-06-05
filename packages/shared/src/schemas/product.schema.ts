import { z } from 'zod';
import { dbIdSchema } from './common.schema.js';

export const productSchema = z.object({
  id: dbIdSchema,
  name: z.string().min(1, 'Name must be at least 1 characters').max(100),
  description: z.string().optional(),
  price: z.number().positive('Price must be greater than zero').optional(),
  images: z.array(z.url()).optional(),
  sellerId: dbIdSchema,
  createdAt: z.coerce.date(),
});

export const createProductSchema = productSchema.omit({
  id: true,
  sellerId: true,
  createdAt: true,
});

export const createProductRequestSchema = z.object({
  body: createProductSchema,
});

export const productIdParamSchema = z.object({
  productId: dbIdSchema,
});

export const sellerIdParamSchema = z.object({
  sellerId: dbIdSchema,
});

export const getProductByIdRequestSchema = z.object({
  params: productIdParamSchema,
});

export const getProductsBySellerRequestSchema = z.object({
  params: sellerIdParamSchema,
});

export const updateProductSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  price: z.number().positive().optional(),
  images: z.array(z.url()).optional(),
});

export const updateProductRequestSchema = z.object({
  params: productIdParamSchema,
  body: updateProductSchema,
});

export const deleteProductRequestSchema = z.object({
  params: productIdParamSchema,
});

export type ProductDto = z.infer<typeof productSchema>;
export type CreateProductDto = z.infer<typeof createProductSchema>;
export type UpdateProductDto = z.infer<typeof updateProductSchema>;
