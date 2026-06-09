import axiosInstance from '../../../services/api/axios';
import { loginBodySchema, LoginResponseSchema, LoginBody, LoginResponse } from '@opensell/shared';

export async function login(body: LoginBody): Promise<LoginResponse> {
  loginBodySchema.parse(body);

  const resp = await axiosInstance.post('/api/v1/auth/login', body);

  const parsed = LoginResponseSchema.parse(resp.data);
  return parsed as LoginResponse;
}
