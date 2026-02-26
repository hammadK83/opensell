import { z } from 'zod';

const envSchema = z.object({
  // DB
  MONGO_URI: z.url('MONGO_URI must be a valid URL'),
  DB_NAME: z.string().min(1, 'DB_NAME is required'),

  // Server
  PORT: z
    .string()
    .default('5000')
    .transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production']).default('development'),
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
