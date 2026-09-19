import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { configureStore } from '@reduxjs/toolkit';
import { AxiosError, AxiosHeaders, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import { axiosInstance, refreshInstance } from '../api.client';
import { setupApiInterceptors } from '../index';
import { tokenStorage } from '../../storage/token.storage';
import { endSessionLogout, getSessionGeneration, invalidateSession, saveSessionTokens, StaleSessionError } from '../../storage/session-lifecycle';
import { performTokenRefresh } from '../interceptors/refresh.controller';
import { responseInterceptor } from '../interceptors/response.interceptor';
import { bootstrapAuth } from '../../../features/auth/auth.bootstrap';
import authReducer, { logout, sessionEstablished } from '../../../features/auth/auth.slice';
import { sessionLifecycleMiddleware } from '../../../features/auth/auth.middleware';
import { signOut } from '../../../features/auth/auth.logout';
import { login, register, refreshToken, logout as logoutApi } from '../../../features/auth/api/auth.api';

jest.mock('../../storage/token.storage', () => ({
  tokenStorage: {
    getAccessToken: jest.fn(), getRefreshToken: jest.fn(),
    setTokens: jest.fn(), clearTokens: jest.fn(),
  },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const user = {
  id: '507f1f77bcf86cd799439011', name: 'Jane Doe', email: 'jane@example.com',
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
};
const rotated = { accessToken: 'new-access', refreshToken: 'new-refresh', user };
const storage = jest.mocked(tokenStorage);
const protectedAdapter = jest.fn<AxiosAdapter>();
const authAdapter = jest.fn<AxiosAdapter>();
let access: string | null;
let refresh: string | null;
let dispose: () => void;

function ok(config: InternalAxiosRequestConfig, data: unknown) {
  return { config, status: 200, statusText: 'OK', headers: new AxiosHeaders(), data };
}
function unauthorized(config: InternalAxiosRequestConfig) {
  return new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, {
    ...ok(config, { message: 'Expired token' }), status: 401,
  });
}
function makeStore() {
  return configureStore({
    reducer: { auth: authReducer },
    middleware: (defaults) => defaults().concat(sessionLifecycleMiddleware),
  });
}

beforeEach(() => {
  jest.resetAllMocks();
  invalidateSession();
  endSessionLogout();
  access = 'old-access';
  refresh = 'old-refresh';
  storage.getAccessToken.mockImplementation(async () => access);
  storage.getRefreshToken.mockImplementation(async () => refresh);
  storage.setTokens.mockImplementation(async (nextAccess, nextRefresh) => {
    access = nextAccess; refresh = nextRefresh;
  });
  storage.clearTokens.mockImplementation(async () => { access = null; refresh = null; });
  axiosInstance.defaults.adapter = protectedAdapter;
  refreshInstance.defaults.adapter = authAdapter;
  authAdapter.mockImplementation(async (config) => ok(config, { success: true, data: rotated }));
  dispose = setupApiInterceptors(() => {});
});
afterEach(() => { dispose(); endSessionLogout(); });

describe('startup and shared refresh', () => {
  it('shares one refresh between startup and concurrent protected requests', async () => {
    const releaseRefresh = deferred<void>();
    const requestsStarted = deferred<void>();
    let initialRequests = 0;
    authAdapter.mockImplementation(async (config) => {
      await releaseRefresh.promise;
      return ok(config, { success: true, data: rotated });
    });
    protectedAdapter.mockImplementation(async (config) => {
      if (config.headers.Authorization === 'Bearer old-access') {
        initialRequests += 1;
        if (initialRequests === 2) requestsStarted.resolve();
        throw unauthorized(config);
      }
      return ok(config, { value: 'protected data' });
    });
    const store = makeStore();
    const startup = store.dispatch(bootstrapAuth());
    const first = axiosInstance.get('/api/v1/products');
    const second = axiosInstance.get('/api/v1/users/me');
    await requestsStarted.promise;
    releaseRefresh.resolve();
    await Promise.all([startup, first, second]);
    expect(authAdapter).toHaveBeenCalledTimes(1);
    expect(storage.setTokens).toHaveBeenCalledTimes(1);
    expect(protectedAdapter).toHaveBeenCalledTimes(4);
    expect(store.getState().auth.status).toBe('authenticated');
  });

  it('ignores duplicate initialization and does not restore again after completion', async () => {
    const releaseRefresh = deferred<void>();
    authAdapter.mockImplementation(async (config) => {
      await releaseRefresh.promise;
      return ok(config, { success: true, data: rotated });
    });
    const store = makeStore();
    const first = store.dispatch(bootstrapAuth());
    const duplicate = await store.dispatch(bootstrapAuth());
    expect(duplicate.meta).toMatchObject({ condition: true });
    releaseRefresh.resolve();
    await first;
    await store.dispatch(bootstrapAuth());
    expect(authAdapter).toHaveBeenCalledTimes(1);
  });

  it('registers interceptors only once', async () => {
    expect(setupApiInterceptors(() => {})).toBe(dispose);
    protectedAdapter.mockImplementation(async (config) => ok(config, {}));
    await axiosInstance.get('/api/v1/products');
    expect(storage.getAccessToken).toHaveBeenCalledTimes(1);
  });
});

describe('request retry boundaries', () => {
  it('clears rejected refresh credentials and notifies the store to sign out', async () => {
    dispose();
    const store = makeStore();
    store.dispatch(sessionEstablished({ ...user,
      createdAt: new Date(user.createdAt), updatedAt: new Date(user.updatedAt) }));
    dispose = setupApiInterceptors(() => { store.dispatch(logout()); });
    protectedAdapter.mockImplementation(async (config) => { throw unauthorized(config); });
    authAdapter.mockImplementation(async (config) => { throw unauthorized(config); });
    await expect(axiosInstance.get('/protected')).rejects.toBeInstanceOf(AxiosError);
    expect(storage.clearTokens).toHaveBeenCalledTimes(1);
    expect(store.getState().auth.status).toBe('signedOut');
    expect(protectedAdapter).toHaveBeenCalledTimes(1);
    expect(authAdapter).toHaveBeenCalledTimes(1);
  });

  it('retries each queued request only once even if both retries return 401', async () => {
    protectedAdapter.mockImplementation(async (config) => { throw unauthorized(config); });
    const results = await Promise.allSettled([
      axiosInstance.get('/api/v1/products'), axiosInstance.get('/api/v1/users/me'),
    ]);
    expect(results.map((result) => result.status)).toEqual(['rejected', 'rejected']);
    expect(protectedAdapter).toHaveBeenCalledTimes(4);
    expect(authAdapter).toHaveBeenCalledTimes(1);
  });

  it('uses the rotated token for a delayed 401 instead of refreshing again', async () => {
    const releaseLate = deferred<void>();
    const lateStarted = deferred<void>();
    protectedAdapter.mockImplementation(async (config) => {
      if (config.headers.Authorization === 'Bearer old-access') {
        if (config.url === '/late') {
          lateStarted.resolve();
          await releaseLate.promise;
        }
        throw unauthorized(config);
      }
      return ok(config, {});
    });
    const late = axiosInstance.get('/late');
    await lateStarted.promise;
    await axiosInstance.get('/first');
    releaseLate.resolve();
    await late;
    expect(authAdapter).toHaveBeenCalledTimes(1);
    expect(protectedAdapter).toHaveBeenCalledTimes(4);
  });

  it.each([
    ['login', () => login({ email: user.email, password: 'Password1!' })],
    ['register', () => register({ name: user.name, email: user.email, password: 'Password1!' })],
    ['refresh', () => refreshToken({ refreshToken: 'old-refresh' })],
    ['logout', () => logoutApi({ refreshToken: 'old-refresh' })],
  ] satisfies [string, () => Promise<unknown>][])('never auto-refreshes a failed %s call', async (_name, invoke) => {
    authAdapter.mockImplementation(async (config) => { throw unauthorized(config); });
    await expect(invoke()).rejects.toBeInstanceOf(AxiosError);
    expect(authAdapter).toHaveBeenCalledTimes(1);
    expect(protectedAdapter).not.toHaveBeenCalled();
    expect(storage.getRefreshToken).not.toHaveBeenCalled();
  });

  it('preserves errors without request configuration', async () => {
    const error = new AxiosError('Network failure');
    await expect(responseInterceptor(error, () => {})).rejects.toBe(error);
  });

  it('rejects all waiting requests on refresh failure and allows a later attempt', async () => {
    const failure = new Error('Offline');
    authAdapter.mockRejectedValueOnce(failure);
    protectedAdapter.mockImplementation(async (config) => {
      if (config.headers.Authorization === 'Bearer old-access') throw unauthorized(config);
      return ok(config, {});
    });
    const results = await Promise.allSettled([axiosInstance.get('/one'), axiosInstance.get('/two')]);
    expect(results.map((result) => result.status)).toEqual(['rejected', 'rejected']);
    expect(authAdapter).toHaveBeenCalledTimes(1);
    expect(storage.clearTokens).not.toHaveBeenCalled();
    await axiosInstance.get('/retry');
    expect(authAdapter).toHaveBeenCalledTimes(2);
  });
});

describe('session changes during refresh', () => {
  it('does not save or restore a response arriving after logout', async () => {
    const started = deferred<void>();
    const release = deferred<void>();
    authAdapter.mockImplementation(async (config) => {
      started.resolve(); await release.promise;
      return ok(config, { success: true, data: rotated });
    });
    const store = makeStore();
    const pending = store.dispatch(bootstrapAuth());
    await started.promise;
    store.dispatch(logout());
    release.resolve();
    await pending;
    expect(store.getState().auth.status).toBe('signedOut');
    expect(storage.setTokens).not.toHaveBeenCalled();
  });

  it('cleans an in-progress stale write before saving a newer login', async () => {
    const started = deferred<void>();
    const release = deferred<void>();
    storage.setTokens.mockImplementationOnce(async (nextAccess, nextRefresh) => {
      started.resolve(); await release.promise;
      access = nextAccess; refresh = nextRefresh;
    });
    const pending = performTokenRefresh();
    const rejected = expect(pending).rejects.toBeInstanceOf(StaleSessionError);
    await started.promise;
    const store = makeStore();
    store.dispatch(logout());
    const nextLogin = saveSessionTokens('login-access', 'login-refresh', getSessionGeneration());
    release.resolve();
    await rejected;
    await nextLogin;
    expect(storage.clearTokens).toHaveBeenCalledTimes(1);
    expect(access).toBe('login-access');
    expect(refresh).toBe('login-refresh');
  });

  it('does not replay protected requests after logout while refresh is pending', async () => {
    const started = deferred<void>();
    const release = deferred<void>();
    protectedAdapter.mockImplementation(async (config) => { throw unauthorized(config); });
    authAdapter.mockImplementation(async (config) => {
      started.resolve(); await release.promise;
      return ok(config, { success: true, data: rotated });
    });
    const request = axiosInstance.get('/protected');
    const rejected = expect(request).rejects.toBeInstanceOf(StaleSessionError);
    await started.promise;
    makeStore().dispatch(logout());
    release.resolve();
    await rejected;
    expect(protectedAdapter).toHaveBeenCalledTimes(1);
  });

  it('does not overwrite a newer login with a late startup result', async () => {
    const started = deferred<void>();
    const release = deferred<void>();
    authAdapter.mockImplementation(async (config) => {
      started.resolve(); await release.promise;
      return ok(config, { success: true, data: rotated });
    });
    const store = makeStore();
    const startup = store.dispatch(bootstrapAuth());
    await started.promise;
    store.dispatch(sessionEstablished({ ...user, name: 'New User',
      createdAt: new Date(user.createdAt), updatedAt: new Date(user.updatedAt) }));
    release.resolve();
    await startup;
    expect(store.getState().auth.user?.name).toBe('New User');
  });
});

describe('user-triggered logout', () => {
  function authenticatedStore() {
    const store = makeStore();
    store.dispatch(sessionEstablished({ ...user,
      createdAt: new Date(user.createdAt), updatedAt: new Date(user.updatedAt) }));
    return store;
  }

  beforeEach(() => {
    authAdapter.mockImplementation(async (config) => ok(config, {
      success: true, data: config.url?.endsWith('/logout') ? null : rotated,
    }));
  });

  it('revokes the saved token, clears both credentials, and removes the user', async () => {
    const store = authenticatedStore();
    const pending = store.dispatch(signOut());
    expect(store.getState().auth.status).toBe('signingOut');
    expect(store.getState().auth.user).toBeNull();
    await pending;
    expect(authAdapter.mock.calls[0][0].url).toBe('/api/v1/auth/logout');
    expect(JSON.parse(authAdapter.mock.calls[0][0].data)).toEqual({ refreshToken: 'old-refresh' });
    expect(access).toBeNull();
    expect(refresh).toBeNull();
    expect(store.getState().auth).toEqual({
      status: 'signedOut', user: null, startupError: null, logoutNotice: null,
    });
  });

  it('waits for refresh and revokes the rotated token while blocking new requests', async () => {
    const started = deferred<void>();
    const release = deferred<void>();
    authAdapter.mockImplementation(async (config) => {
      if (config.url?.endsWith('/refresh')) {
        started.resolve(); await release.promise;
        return ok(config, { success: true, data: rotated });
      }
      return ok(config, { success: true, data: null });
    });
    const store = authenticatedStore();
    const refreshing = performTokenRefresh();
    await started.promise;
    const signingOut = store.dispatch(signOut());
    await expect(axiosInstance.get('/protected')).rejects.toBeInstanceOf(StaleSessionError);
    await expect(performTokenRefresh()).rejects.toBeInstanceOf(StaleSessionError);
    expect(authAdapter).toHaveBeenCalledTimes(1);
    release.resolve();
    await Promise.all([refreshing, signingOut]);
    expect(authAdapter).toHaveBeenCalledTimes(2);
    expect(JSON.parse(authAdapter.mock.calls[1][0].data)).toEqual({ refreshToken: 'new-refresh' });
    expect(store.getState().auth.status).toBe('signedOut');
    expect(refresh).toBeNull();
  });

  it('revokes a rotated token even if storing it failed', async () => {
    const started = deferred<void>();
    const release = deferred<void>();
    storage.setTokens.mockImplementationOnce(async () => {
      started.resolve(); await release.promise;
      throw new Error('Write failed');
    });
    const store = authenticatedStore();
    const refreshing = performTokenRefresh();
    const rejected = expect(refreshing).rejects.toThrow('Unable to save');
    await started.promise;
    const signingOut = store.dispatch(signOut());
    release.resolve();
    await Promise.all([rejected, signingOut]);
    expect(JSON.parse(authAdapter.mock.calls[1][0].data)).toEqual({ refreshToken: 'new-refresh' });
    expect(store.getState().auth).toMatchObject({ status: 'signedOut', logoutNotice: null });
  });

  it('clears local credentials when the server is unavailable and explains the limitation', async () => {
    authAdapter.mockRejectedValueOnce(new Error('Offline'));
    const store = authenticatedStore();
    await store.dispatch(signOut());
    expect(store.getState().auth).toMatchObject({
      status: 'signedOut', logoutNotice: expect.stringContaining('could not confirm'),
    });
    expect(refresh).toBeNull();
    expect(access).toBeNull();
  });

  it('clears local credentials even when reading the refresh token fails', async () => {
    storage.getRefreshToken.mockRejectedValueOnce(new Error('Read failed'));
    const store = authenticatedStore();
    await store.dispatch(signOut());
    expect(authAdapter).not.toHaveBeenCalled();
    expect(storage.clearTokens).toHaveBeenCalledTimes(1);
    expect(store.getState().auth).toMatchObject({
      status: 'signedOut', logoutNotice: expect.stringContaining('could not confirm'),
    });
  });

  it('blocks navigation after cleanup failure and supports retrying logout', async () => {
    storage.clearTokens.mockRejectedValueOnce(new Error('Delete failed'));
    const store = authenticatedStore();
    await store.dispatch(signOut());
    expect(store.getState().auth).toMatchObject({
      status: 'logoutError', user: null, logoutError: expect.stringContaining('could not remove'),
    });
    await expect(axiosInstance.get('/protected')).rejects.toBeInstanceOf(StaleSessionError);
    await store.dispatch(signOut());
    expect(store.getState().auth.status).toBe('signedOut');
    expect(refresh).toBeNull();
  });

  it('ignores double taps and does not repeat logout after completion', async () => {
    const store = authenticatedStore();
    const first = store.dispatch(signOut());
    const duplicate = await store.dispatch(signOut());
    expect(duplicate.meta).toMatchObject({ condition: true });
    await first;
    await store.dispatch(signOut());
    expect(authAdapter).toHaveBeenCalledTimes(1);
    expect(storage.clearTokens).toHaveBeenCalledTimes(1);
  });

  it('ignores late startup completion while signing out', async () => {
    const started = deferred<void>();
    const release = deferred<void>();
    authAdapter.mockImplementation(async (config) => {
      if (config.url?.endsWith('/refresh')) {
        started.resolve(); await release.promise;
        return ok(config, { success: true, data: rotated });
      }
      return ok(config, { success: true, data: null });
    });
    const store = makeStore();
    const startup = store.dispatch(bootstrapAuth());
    await started.promise;
    const signingOut = store.dispatch(signOut());
    release.resolve();
    await Promise.all([startup, signingOut]);
    expect(store.getState().auth.status).toBe('signedOut');
    expect(refresh).toBeNull();
  });
});
