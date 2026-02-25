import { z } from 'zod';
import { AUTH_PROVIDER } from '../constants/user.constants';

export const registerUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(50),

  email: z.email('Invalid email address').toLowerCase(),

  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must include at least one uppercase letter')
    .regex(/[a-z]/, 'Password must include at least one lowercase letter')
    .regex(/[0-9]/, 'Password must include at least one number')
    .regex(
      /[@$!%*?&]/,
      'Password must include at least one special character (@$!%*?&)',
    ),

  provider: z
    .enum([AUTH_PROVIDER.LOCAL, AUTH_PROVIDER.GOOGLE])
    .default(AUTH_PROVIDER.LOCAL),
});

export type RegisterUserInput = z.infer<typeof registerUserSchema>;
