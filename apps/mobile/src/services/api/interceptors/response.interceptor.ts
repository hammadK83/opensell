import { AxiosError } from 'axios';
import { axiosInstance } from '../api.client';
import { performTokenRefresh } from './refresh.controller';
import { SessionRequestConfig } from './request.interceptor';
import { tokenStorage } from '../../storage/token.storage';
import { assertSessionRequestsAllowed, getSessionGeneration } from '../../storage/session-lifecycle';

export async function responseInterceptor(error: AxiosError, onSessionExpired: () => void) {
  const request = error.config as SessionRequestConfig | undefined;
  if (!request || error.response?.status !== 401 || request._retry || request.url?.includes('/auth/')) {
    throw error;
  }
  const generation = request._sessionGeneration ?? getSessionGeneration();
  assertSessionRequestsAllowed(generation);
  // Mark every request before it waits, so queued requests also retry at most once.
  request._retry = true;
  request._sessionGeneration = generation;

  const currentToken = await tokenStorage.getAccessToken();
  assertSessionRequestsAllowed(generation);
  let token = currentToken;
  if (!token || request.headers.Authorization === `Bearer ${token}`) {
    const session = await performTokenRefresh();
    assertSessionRequestsAllowed(generation);
    if (!session) {
      onSessionExpired();
      throw error;
    }
    token = session.accessToken;
  }
  // A late 401 for an older token reuses an already-rotated token.
  assertSessionRequestsAllowed(generation);
  request.headers.Authorization = `Bearer ${token}`;
  return axiosInstance(request);
}
