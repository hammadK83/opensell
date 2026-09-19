import axios from 'axios';
import type { RefreshTokenResponse } from '@opensell/shared';
import { tokenStorage } from '../../storage/token.storage';
import { refreshToken } from '../../../features/auth/api/auth.api';
import {
  assertCurrentSession, assertSessionRequestsAllowed, clearSessionTokens, getSessionGeneration,
  saveSessionTokens, StaleSessionError,
} from '../../storage/session-lifecycle';

export class SessionStorageError extends Error {
  constructor(message: string, readonly rotatedRefreshToken?: string) {
    super(message);
  }
}

let inFlight: { generation: number; promise: Promise<RefreshTokenResponse | null> } | undefined;

async function refreshSession(generation: number): Promise<RefreshTokenResponse | null> {
  let savedToken;
  try {
    savedToken = await tokenStorage.getRefreshToken();
  } catch {
    throw new SessionStorageError('Unable to read your saved session. Please try again.');
  }
  assertCurrentSession(generation);
  if (!savedToken) return null;

  let data;
  try {
    data = await refreshToken({ refreshToken: savedToken });
  } catch (error) {
    assertCurrentSession(generation);
    if (!axios.isAxiosError(error) || error.response?.status !== 401) throw error;
    try {
      await clearSessionTokens(generation);
    } catch (storageError) {
      if (storageError instanceof StaleSessionError) throw storageError;
      throw new SessionStorageError('Unable to remove your expired session. Please try again.');
    }
    return null;
  }
  assertCurrentSession(generation);
  try {
    await saveSessionTokens(data.accessToken, data.refreshToken, generation);
  } catch (error) {
    if (error instanceof StaleSessionError) throw error;
    throw new SessionStorageError('Unable to save your session. Please try again.', data.refreshToken);
  }
  assertCurrentSession(generation);
  return data;
}

// Startup and all protected requests share the same read/refresh/write operation.
export function performTokenRefresh(): Promise<RefreshTokenResponse | null> {
  const generation = getSessionGeneration();
  try {
    assertSessionRequestsAllowed(generation);
  } catch (error) {
    return Promise.reject(error);
  }
  if (inFlight?.generation === generation) return inFlight.promise;
  const operation = { generation, promise: refreshSession(generation) };
  inFlight = operation;
  operation.promise = operation.promise.finally(() => {
    if (inFlight === operation) inFlight = undefined;
  });
  return operation.promise;
}

export function getPendingRefresh() {
  return inFlight?.generation === getSessionGeneration() ? inFlight.promise : undefined;
}
