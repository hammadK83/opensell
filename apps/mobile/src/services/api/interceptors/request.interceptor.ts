import type { InternalAxiosRequestConfig } from 'axios';
import { tokenStorage } from '../../storage/token.storage';
import { assertSessionRequestsAllowed, getSessionGeneration } from '../../storage/session-lifecycle';

export type SessionRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  _sessionGeneration?: number;
};

export async function requestInterceptor(config: SessionRequestConfig) {
  config._sessionGeneration ??= getSessionGeneration();
  assertSessionRequestsAllowed(config._sessionGeneration);
  const token = await tokenStorage.getAccessToken();
  assertSessionRequestsAllowed(config._sessionGeneration);
  if (!config.headers.Authorization && token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}
