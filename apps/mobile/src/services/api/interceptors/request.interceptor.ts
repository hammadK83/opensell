import { InternalAxiosRequestConfig } from 'axios';
import { tokenStorage } from '../../storage/token.storage';

export async function requestInterceptor(config: InternalAxiosRequestConfig) {
  const token = await tokenStorage.getAccessToken();
  if (!config.headers.Authorization && token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}
