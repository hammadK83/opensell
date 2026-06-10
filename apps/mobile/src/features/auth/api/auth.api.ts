import { axiosInstance } from '../../../services/api/api.client';
import {
  loginBodySchema,
  loginResponseSchema,
  LoginBody,
  LoginResponse,
  refreshTokenBodySchema,
  refreshTokenResponseSchema,
  RefreshTokenBody,
  RefreshTokenResponse,
} from '@opensell/shared';

export async function login(body: LoginBody): Promise<LoginResponse> {
  loginBodySchema.parse(body);

  const resp = await axiosInstance.post('/api/v1/auth/login', body);

  const parsed = loginResponseSchema.parse(resp.data.data);
  return parsed as LoginResponse;
}

export async function refreshToken(body: RefreshTokenBody): Promise<RefreshTokenResponse> {
  refreshTokenBodySchema.parse(body);

  const resp = await axiosInstance.post('/api/v1/auth/refresh', body, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const parsed = refreshTokenResponseSchema.parse(resp.data.data);
  return parsed as RefreshTokenResponse;
}
