import { z } from 'zod';
import { userIdSchema } from './common.schema.js';

export const productSchema = z.object({
  id: userIdSchema,
  name: z.string().min(1, 'Name must be at least 1 characters').max(100),
  description: z.string().optional(),
  price: z.number().positive('Price must be greater than zero').optional(),
  images: z.array(z.url()).optional(),
  sellerId: userIdSchema,
  createdAt: z.coerce.date(),
});

export type ProductResponse = z.infer<typeof productSchema>;
