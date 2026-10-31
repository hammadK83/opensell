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
  REFRESH_RETRY_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/, 'REFRESH_RETRY_KEY must be 32 bytes of hex'),

  // Email
  EMAIL_FROM: z.string().min(1, 'Email from is required'),
  EMAIL_HOST: z.string().min(1, 'Email host is required'),
  EMAIL_PORT: z
    .string()
    .default('587')
    .transform((val) => parseInt(val, 10)),
  EMAIL_USER: z.string().min(1, 'Email user is required'),
  EMAIL_PASS: z.string().min(1, 'Email password is required'),
  VERIFICATION_EMAIL_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/, 'VERIFICATION_EMAIL_KEY must be 32 bytes of hex'),
  VERIFICATION_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().safe()
    .refine((seconds) => Number.isFinite(new Date(Date.now() + seconds * 1_000).getTime()),
      'VERIFICATION_TOKEN_TTL_SECONDS must fit in a Date')
    .default(86_400),

  // Authentication limits. Proxy trust stays disabled until the deployment hop count is configured.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
  AUTH_RATE_WINDOW_SECONDS: z.coerce.number().int().positive().default(900),
  AUTH_REGISTER_WINDOW_SECONDS: z.coerce.number().int().positive().default(3600),
  AUTH_LOGIN_ACCOUNT_LIMIT: z.coerce.number().int().positive().default(10),
  AUTH_LOGIN_IP_LIMIT: z.coerce.number().int().positive().default(30),
  AUTH_REGISTER_IP_LIMIT: z.coerce.number().int().positive().default(5),
  AUTH_VERIFY_IP_LIMIT: z.coerce.number().int().positive().default(20),
  AUTH_REFRESH_IP_LIMIT: z.coerce.number().int().positive().default(30),
  AUTH_RESEND_IP_LIMIT: z.coerce.number().int().positive().default(10),
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
