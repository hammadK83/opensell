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
  registerUserRequestSchema,
  RegisterUserDto,
} from '@opensell/shared';

export async function register(body: RegisterUserDto): Promise<boolean> {
  registerUserRequestSchema.parse({ body });

  const resp = await axiosInstance.post('/api/v1/auth/register', body);

  return resp.status === 201 ? true : Promise.reject('Failed to register account');
}

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
