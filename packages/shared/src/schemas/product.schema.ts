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
  id: dbIdSchema,
});

export const deleteProductRequestSchema = z.object({
  params: productIdParamSchema,
});

export type CreateProductDto = z.infer<typeof createProductRequestSchema>;
