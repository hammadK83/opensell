import { refreshInstance } from '../../../services/api/api.client';
import { z } from 'zod';
import {
  ApiSucccessResponseSchema,
  loginBodySchema,
  loginResponseSchema,
  LoginBody,
  LoginResponse,
  refreshTokenBodySchema,
  refreshTokenResponseSchema,
  RefreshTokenBody,
  RefreshTokenResponse,
  registerUserRequestSchema,
  registerResponseSchema,
  resendVerificationBodySchema,
  resendVerificationResponseSchema,
  RegisterResponse,
  RegisterUserDto,
  logoutBodySchema,
} from '@opensell/shared';

const registerSuccessSchema = ApiSucccessResponseSchema(registerResponseSchema);
const resendSuccessSchema = ApiSucccessResponseSchema(resendVerificationResponseSchema);
const loginSuccessSchema = ApiSucccessResponseSchema(loginResponseSchema);
const refreshSuccessSchema = ApiSucccessResponseSchema(refreshTokenResponseSchema);
const logoutResponseSchema = ApiSucccessResponseSchema(z.null());

export async function register(body: RegisterUserDto): Promise<RegisterResponse> {
  const parsed = registerUserRequestSchema.parse({ body });

  const resp = await refreshInstance.post('/api/v1/auth/register', parsed.body);

  if (resp.status !== 201) {
    throw new Error('Failed to register account');
  }
  return registerSuccessSchema.parse(resp.data).data;
}

export async function resendVerification(email: string): Promise<string> {
  const body = resendVerificationBodySchema.parse({ email });
  const resp = await refreshInstance.post('/api/v1/auth/resend-verification', body);
  return resendSuccessSchema.parse(resp.data).data.message;
}

export async function login(body: LoginBody): Promise<LoginResponse> {
  const parsed = loginBodySchema.parse(body);

  const resp = await refreshInstance.post('/api/v1/auth/login', parsed);

  return loginSuccessSchema.parse(resp.data).data;
}

export async function refreshToken(body: RefreshTokenBody): Promise<RefreshTokenResponse> {
  const parsed = refreshTokenBodySchema.parse(body);

  const resp = await refreshInstance.post('/api/v1/auth/refresh', parsed);

  return refreshSuccessSchema.parse(resp.data).data;
}

export async function logout(body: z.input<typeof logoutBodySchema>): Promise<void> {
  const parsed = logoutBodySchema.parse(body);
  const resp = await refreshInstance.post('/api/v1/auth/logout', parsed);
  logoutResponseSchema.parse(resp.data);
}
