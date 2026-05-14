import { z } from 'zod';

export const dbIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, {
  message: 'Invalid ID format',
});
