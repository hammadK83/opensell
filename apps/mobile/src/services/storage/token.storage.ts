import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const REFRESH_ATTEMPT_KEY = 'refreshAttempt';

export type RefreshAttempt = { refreshToken: string; retryKey: string };

export const tokenStorage = {
  async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    try {
      const results = await Promise.allSettled([
        SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken),
        SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken),
      ]);
      // Wait for both native writes before releasing the session storage queue.
      const failure = results.find((result) => result.status === 'rejected');
      if (failure?.status === 'rejected') throw failure.reason;
      await SecureStore.deleteItemAsync(REFRESH_ATTEMPT_KEY);
    } catch (error) {
      console.error('Failed to store tokens:', error);
      throw error;
    }
  },

  async setAccessToken(accessToken: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
    } catch (error) {
      console.error('Failed to store access token:', error);
      throw error;
    }
  },

  async setRefreshToken(refreshToken: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    } catch (error) {
      console.error('Failed to store refresh token:', error);
      throw error;
    }
  },

  async getAccessToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    } catch (error) {
      console.error('Failed to retrieve access token:', error);
      throw error;
    }
  },

  async getRefreshToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    } catch (error) {
      console.error('Failed to retrieve refresh token:', error);
      throw error;
    }
  },

  async getRefreshAttempt(): Promise<RefreshAttempt | null> {
    const stored = await SecureStore.getItemAsync(REFRESH_ATTEMPT_KEY);
    if (!stored) return null;
    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object' || !('refreshToken' in parsed) ||
        !('retryKey' in parsed) || typeof parsed.refreshToken !== 'string' ||
        typeof parsed.retryKey !== 'string' || !/^[a-f0-9]{64}$/.test(parsed.retryKey)) {
      throw new Error('Invalid saved refresh attempt');
    }
    return { refreshToken: parsed.refreshToken, retryKey: parsed.retryKey };
  },

  async setRefreshAttempt(attempt: RefreshAttempt): Promise<void> {
    await SecureStore.setItemAsync(REFRESH_ATTEMPT_KEY, JSON.stringify(attempt));
  },

  async getTokens(): Promise<{ accessToken: string | null; refreshToken: string | null }> {
    const [accessToken, refreshToken] = await Promise.all([
      this.getAccessToken(),
      this.getRefreshToken(),
    ]);
    return { accessToken, refreshToken };
  },

  async clearTokens(): Promise<void> {
    try {
      const results = await Promise.allSettled([
        SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
        SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
        SecureStore.deleteItemAsync(REFRESH_ATTEMPT_KEY),
      ]);
      const failure = results.find((result) => result.status === 'rejected');
      if (failure?.status === 'rejected') throw failure.reason;
    } catch (error) {
      console.error('Failed to clear tokens:', error);
      throw error;
    }
  },
};
