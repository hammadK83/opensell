import axiosInstance from '../../../services/api/axios';
import { loginBodySchema, LoginResponseSchema, LoginBody, LoginResponse } from '@opensell/shared';

export async function login(body: LoginBody): Promise<LoginResponse> {
  // validate request locally with shared schema
  loginBodySchema.parse(body);

  const resp = await axiosInstance.post('/api/v1/auth/login', body);

  // console.log('Login response:', resp.data); // Debug log to inspect the raw response

  // validate response using shared schema
  const parsed = LoginResponseSchema.parse(resp.data);
  return parsed as LoginResponse;
}
