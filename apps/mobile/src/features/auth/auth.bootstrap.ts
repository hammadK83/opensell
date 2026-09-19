import { createAsyncThunk } from '@reduxjs/toolkit';
import { performTokenRefresh, SessionStorageError } from '../../services/api/interceptors/refresh.controller';
import { User, toSessionUser } from './model/user';

export const bootstrapAuth = createAsyncThunk<User | null, void, {
  rejectValue: string;
  state: { auth: { status: string; requestId?: string } };
}>(
  'auth/bootstrap',
  async (_, { rejectWithValue }) => {
    try {
      const session = await performTokenRefresh();
      return session ? toSessionUser(session.user) : null;
    } catch (error) {
      return rejectWithValue(error instanceof SessionStorageError
        ? error.message : 'Unable to restore your session. Please try again.');
    }
  },
  {
    condition: (_, { getState }) => {
      const auth = getState().auth;
      return (auth.status === 'initializing' && !auth.requestId) || auth.status === 'startupError';
    },
  },
);
