import { axiosInstance } from '../../../services/api/api.client';
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
  RegisterUserDto,
  userSchema,
  logoutBodySchema,
} from '@opensell/shared';

const registerResponseSchema = ApiSucccessResponseSchema(userSchema);
const loginSuccessSchema = ApiSucccessResponseSchema(loginResponseSchema);
const refreshSuccessSchema = ApiSucccessResponseSchema(refreshTokenResponseSchema);
const logoutResponseSchema = ApiSucccessResponseSchema(z.null());

export async function register(body: RegisterUserDto): Promise<boolean> {
  const parsed = registerUserRequestSchema.parse({ body });

  const resp = await axiosInstance.post('/api/v1/auth/register', parsed.body);

  if (resp.status !== 201) {
    throw new Error('Failed to register account');
  }
  registerResponseSchema.parse(resp.data);
  return true;
}

export async function login(body: LoginBody): Promise<LoginResponse> {
  const parsed = loginBodySchema.parse(body);

  const resp = await axiosInstance.post('/api/v1/auth/login', parsed);

  return loginSuccessSchema.parse(resp.data).data;
}

export async function refreshToken(body: RefreshTokenBody): Promise<RefreshTokenResponse> {
  const parsed = refreshTokenBodySchema.parse(body);

  const resp = await axiosInstance.post('/api/v1/auth/refresh', parsed);

  return refreshSuccessSchema.parse(resp.data).data;
}

export async function logout(body: z.input<typeof logoutBodySchema>): Promise<void> {
  const parsed = logoutBodySchema.parse(body);
  const resp = await axiosInstance.post('/api/v1/auth/logout', parsed);
  logoutResponseSchema.parse(resp.data);
}
