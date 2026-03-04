import { z } from 'zod';
import { userResponseSchema } from './user.schema.js';

// Email Verification Schemas
export const verifyEmailSchema = z.object({
  token: z.string('Verification token is required').length(80, 'Invalid token format'),
});

export const verifyEmailQuerySchema = z.object({
  query: verifyEmailSchema,
});

export type VerifyEmailQuery = z.infer<typeof verifyEmailSchema>;

// Login Schemas
export const loginBodySchema = z.object({
  email: z.email('Email is required').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export const loginRequestSchema = z.object({
  body: loginBodySchema,
});

export type LoginBody = z.infer<typeof loginBodySchema>;

export const LoginResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: userResponseSchema,
});

export type LoginResponse = z.infer<typeof LoginResponseSchema>;
