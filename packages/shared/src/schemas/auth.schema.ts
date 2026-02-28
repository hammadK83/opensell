import { z } from 'zod';

export const verifyEmailSchema = z.object({
  token: z.string('Verification token is required').length(80, 'Invalid token format'),
});

export const verifyEmailQuerySchema = z.object({
  query: verifyEmailSchema,
});

export type VerifyEmailQuery = z.infer<typeof verifyEmailSchema>;
