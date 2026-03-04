import { z } from 'zod';
import { API_ERROR_CODES } from '../errors/api-error-codes.js';

export const ApiErrorResponseSchema = z.object({
  code: z.enum(API_ERROR_CODES),
  message: z.string(),
  // Optional field errors
  errors: z
    .array(
      z.object({
        field: z.string(),
        message: z.string(),
      }),
    )
    .optional(),
});

export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
