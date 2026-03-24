import { z } from 'zod';

const envSchema = z.object({
  // Server
  PORT: z
    .string()
    .default('5000')
    .transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  API_URL: z.url('Api Url must be a valid URL').default('http://localhost:5000/api/v1'),

  // DB
  MONGO_URI: z.url('MONGO_URI must be a valid URL'),
  DB_NAME: z.string().min(1, 'DB_NAME is required'),

  // Jwt
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_ACCESS_TOKEN_TTL: z.string().default('15m'),

  // Refresh Token
  REFRESH_TOKEN_TTL: z.string().default('30d'),

  // Email
  EMAIL_FROM: z.string().min(1, 'Email from is required'),
  EMAIL_HOST: z.string().min(1, 'Email host is required'),
  EMAIL_PORT: z
    .string()
    .default('587')
    .transform((val) => parseInt(val, 10)),
  EMAIL_USER: z.string().min(1, 'Email user is required'),
  EMAIL_PASS: z.string().min(1, 'Email password is required'),
});

// Validate
const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('Invalid environment variables:');
  console.error(JSON.stringify(z.treeifyError(_env.error), null, 2));
  process.exit(1);
}

// Validated env variables
export const env = _env.data;
