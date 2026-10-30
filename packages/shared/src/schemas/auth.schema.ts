import { z } from 'zod';
import { userSchema } from './user.schema.js';

export const registerResponseSchema = z.object({
  user: userSchema,
  verificationEmailDelivery: z.literal('queued'),
});
export type RegisterResponse = z.infer<typeof registerResponseSchema>;

export const resendVerificationBodySchema = z.object({
  email: z.email('Invalid email address').toLowerCase(),
});
export const resendVerificationRequestSchema = z.object({ body: resendVerificationBodySchema });
export type ResendVerificationBody = z.infer<typeof resendVerificationBodySchema>;
export const resendVerificationResponseSchema = z.object({ message: z.string() });

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

export const loginResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: userSchema,
});

export type LoginResponse = z.infer<typeof loginResponseSchema>;

// Refresh Token Schemas
export const refreshTokenBodySchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
  retryKey: z.string().regex(/^[a-f0-9]{64}$/, 'Invalid refresh retry key').optional(),
});

export const refreshTokenRequestSchema = z.object({
  body: refreshTokenBodySchema,
});

export const refreshTokenResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: userSchema,
});

export type RefreshTokenBody = z.infer<typeof refreshTokenBodySchema>;
export type RefreshTokenResponse = z.infer<typeof refreshTokenResponseSchema>;

// Logout Schemas
export const logoutBodySchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const logoutRequestSchema = z.object({
  body: logoutBodySchema,
});
