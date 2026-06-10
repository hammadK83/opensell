import { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { axiosInstance } from '../api.client';
import { performTokenRefresh } from './refresh.controller';

let isRefreshing = false;

type Subscriber = {
  resolve: (token: string) => void;
  reject: (error: Error) => void;
};

let subscribers: Subscriber[] = [];

function subscribe(resolve: (token: string) => void, reject: (e: Error) => void) {
  subscribers.push({ resolve, reject });
}

function notifySuccess(token: string) {
  subscribers.forEach((s) => s.resolve(token));
  subscribers = [];
}

function notifyFailure(error: Error) {
  subscribers.forEach((s) => s.reject(error));
  subscribers = [];
}

export async function responseInterceptor(error: AxiosError) {
  const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
  const isRefreshRequest = originalRequest.url?.includes('/auth/refresh');
  if (
    error.response?.status === 401 &&
    originalRequest &&
    !originalRequest._retry &&
    !isRefreshRequest
  ) {
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        subscribe((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          resolve(axiosInstance(originalRequest));
        }, reject);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const newToken = await performTokenRefresh();

      notifySuccess(newToken);

      originalRequest.headers.Authorization = `Bearer ${newToken}`;

      return axiosInstance(originalRequest);
    } catch (err) {
      notifyFailure(err instanceof Error ? err : new Error('Refresh failed'));

      return Promise.reject(err);
    } finally {
      isRefreshing = false;
    }
  }

  return Promise.reject(error);
}
