import { axiosInstance } from './api.client';
import { requestInterceptor, SessionRequestConfig } from './interceptors/request.interceptor';
import { responseInterceptor } from './interceptors/response.interceptor';
import { assertSessionRequestsAllowed } from '../storage/session-lifecycle';

let dispose: (() => void) | undefined;

export function setupApiInterceptors(onSessionExpired: () => void) {
  if (dispose) return dispose;
  const requestId = axiosInstance.interceptors.request.use(requestInterceptor);
  const responseId = axiosInstance.interceptors.response.use((response) => {
    const generation = (response.config as SessionRequestConfig)._sessionGeneration;
    if (generation !== undefined) assertSessionRequestsAllowed(generation);
    return response;
  }, (error) => responseInterceptor(error, onSessionExpired));
  dispose = () => {
    axiosInstance.interceptors.request.eject(requestId);
    axiosInstance.interceptors.response.eject(responseId);
    dispose = undefined;
  };
  return dispose;
}

export { axiosInstance };
