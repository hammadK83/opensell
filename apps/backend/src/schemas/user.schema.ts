import { z } from 'zod';
import { AUTH_PROVIDER } from '../constants/user.constants';

export const registerUserSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(50),
    email: z.email('Invalid email address').toLowerCase(),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).+$/,
        'Password must include uppercase, lowercase, number and special character (@$!%*?&)',
      ),
    profileImage: z.url('Profile image must be a valid URL').optional(),
    provider: z.enum([AUTH_PROVIDER.LOCAL, AUTH_PROVIDER.GOOGLE]).default(AUTH_PROVIDER.LOCAL),
  }),
});

export type RegisterUserInput = z.infer<typeof registerUserSchema>;
