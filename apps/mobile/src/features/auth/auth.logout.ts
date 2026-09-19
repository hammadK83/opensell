import { createAsyncThunk } from '@reduxjs/toolkit';
import { logout as revokeSession } from './api/auth.api';
import { getPendingRefresh, SessionStorageError } from '../../services/api/interceptors/refresh.controller';
import { tokenStorage } from '../../services/storage/token.storage';
import {
  assertCurrentSession, clearSessionTokens, endSessionLogout,
  getSessionGeneration, invalidateSession,
} from '../../services/storage/session-lifecycle';

const revocationWarning = 'You are signed out on this device, but we could not confirm that your server session was revoked.';

export const signOut = createAsyncThunk<string | null, void, {
  rejectValue: { message: string; notice: string | null };
  state: { auth: { status: string; logoutNotice?: string | null } };
}>(
  'auth/signOut',
  async (_, { getState, rejectWithValue }) => {
    let generation = getSessionGeneration();
    let notice = getState().auth.logoutNotice ?? null;
    let rotatedRefreshToken: string | undefined;
    // Let an existing rotation finish so we revoke its newest refresh token.
    try {
      const session = await getPendingRefresh();
      rotatedRefreshToken = session?.refreshToken;
    } catch (error) {
      if (error instanceof SessionStorageError && error.rotatedRefreshToken) {
        rotatedRefreshToken = error.rotatedRefreshToken;
      } else {
        notice = revocationWarning;
      }
    }
    try {
      assertCurrentSession(generation);
      const refreshToken = rotatedRefreshToken ?? await tokenStorage.getRefreshToken();
      assertCurrentSession(generation);
      if (refreshToken) await revokeSession({ refreshToken });
    } catch {
      notice = revocationWarning;
    }

    try {
      assertCurrentSession(generation);
      invalidateSession();
      generation = getSessionGeneration();
      await clearSessionTokens(generation);
      endSessionLogout();
      return notice;
    } catch {
      return rejectWithValue({
        message: 'We could not remove your saved credentials. Please try signing out again.',
        notice,
      });
    }
  },
  {
    condition: (_, { getState }) => {
      const status = getState().auth.status;
      return status !== 'signingOut' && status !== 'signedOut';
    },
  },
);
