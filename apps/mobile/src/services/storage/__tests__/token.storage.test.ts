import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as SecureStore from 'expo-secure-store';
import { tokenStorage } from '../token.storage';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const secureStore = jest.mocked(SecureStore);

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe.each([
  ['accessToken', () => tokenStorage.getAccessToken()],
  ['refreshToken', () => tokenStorage.getRefreshToken()],
] satisfies [string, () => Promise<string | null>][])('%s storage reads', (key, read) => {
  it('returns null only when SecureStore reports a missing value', async () => {
    secureStore.getItemAsync.mockResolvedValueOnce(null);
    await expect(read()).resolves.toBeNull();
    expect(secureStore.getItemAsync).toHaveBeenCalledWith(key);
  });

  it('returns a stored credential', async () => {
    secureStore.getItemAsync.mockResolvedValueOnce('saved-token');
    await expect(read()).resolves.toBe('saved-token');
  });

  it('propagates native storage failure instead of returning null', async () => {
    const error = new Error('SecureStore unavailable');
    secureStore.getItemAsync.mockRejectedValueOnce(error);
    await expect(read()).rejects.toBe(error);
  });
});

it('rejects a combined read when either credential cannot be read', async () => {
  const error = new Error('SecureStore unavailable');
  secureStore.getItemAsync.mockResolvedValueOnce('access').mockRejectedValueOnce(error);
  await expect(tokenStorage.getTokens()).rejects.toBe(error);
});

it('persists credentials using the existing SecureStore keys', async () => {
  secureStore.setItemAsync.mockResolvedValue(undefined);
  await tokenStorage.setTokens('access', 'refresh');
  expect(secureStore.setItemAsync).toHaveBeenCalledWith('accessToken', 'access');
  expect(secureStore.setItemAsync).toHaveBeenCalledWith('refreshToken', 'refresh');
});
