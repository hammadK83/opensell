import { z } from 'zod';
import { AUTH_PROVIDER } from '../constants/auth.constants.js';
import { dbIdSchema } from './common.schema.js';

export const registerUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2)
    .max(50)
    .regex(/^[\p{L}]+(?:[ -][\p{L}]+)*$/u, 'Please enter a valid name'),
  email: z.email('Invalid email address').toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).+$/,
      'Password must include uppercase, lowercase, number and special character (@$!%*?&)',
    )
    .optional(),
});

export const registerUserBodySchema = registerUserSchema
  .extend({
    profileImage: z.url('Profile image must be a valid URL').optional(),
    provider: z.enum([AUTH_PROVIDER.LOCAL, AUTH_PROVIDER.GOOGLE]).default(AUTH_PROVIDER.LOCAL),
  })
  .strict()
  .refine(
    ({ provider, password }) => {
      return provider !== AUTH_PROVIDER.LOCAL || password !== undefined;
    },
    {
      message: 'Password is required to register',
      path: ['password'],
    },
  );

export const registerUserRequestSchema = z.object({
  body: registerUserBodySchema,
});

export type RegisterUserDto = z.infer<typeof registerUserSchema>;
export type RegisterUserBody = z.infer<typeof registerUserBodySchema>;

export const userSchema = z.object({
  id: dbIdSchema,
  name: z.string(),
  email: z.email(),
  profileImage: z.url().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type UserDto = z.infer<typeof userSchema>;

export const getUserByIdSchema = z.object({
  id: dbIdSchema,
});

export const getUserByIdRequestSchema = z.object({
  params: getUserByIdSchema,
});
