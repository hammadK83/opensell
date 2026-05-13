import { z } from 'zod';

export const userIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, {
  message: 'Invalid ID format',
});
