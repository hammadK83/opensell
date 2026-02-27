import { z } from 'zod';
import { API_ERROR_CODES } from './api-error-codes.js';

export const ApiErrorResponseSchema = z.object({
  code: z.nativeEnum(API_ERROR_CODES),
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

// TODO: Add ApiSuccessResponse and ApiResponse types in the future
// export interface ApiSuccessResponse<T> {
//   success: true;
//   data: T;
// }

// export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
