import { z } from 'zod';

export const ApiSucccessResponseSchema = <T extends z.ZodObject>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
  });

export type ApiSuccessResponse = z.infer<typeof ApiSucccessResponseSchema>;
