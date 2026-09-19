import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { UserDto } from '@opensell/shared';
import { User, toSessionUser } from './model/user';
import { bootstrapAuth } from './auth.bootstrap';

export type AuthState =
  | { status: 'initializing'; user: null; startupError: null; requestId?: string }
  | { status: 'signedOut'; user: null; startupError: null }
  | { status: 'authenticated'; user: User; startupError: null }
  | { status: 'startupError'; user: null; startupError: string };

function initialState(): AuthState {
  return { status: 'initializing', user: null, startupError: null };
}

function signedOutState(): AuthState {
  return { status: 'signedOut', user: null, startupError: null };
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    sessionEstablished: {
      prepare(user: UserDto) {
        return { payload: toSessionUser(user) };
      },
      reducer(_state, action: PayloadAction<User>): AuthState {
        return { status: 'authenticated', user: action.payload, startupError: null };
      },
    },

    // Local state reset only. Token revocation and storage cleanup are coordinated separately.
    logout(): AuthState {
      return signedOutState();
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(bootstrapAuth.pending, (_state, action): AuthState => ({
        status: 'initializing', user: null, startupError: null, requestId: action.meta.requestId,
      }))
      .addCase(bootstrapAuth.fulfilled, (state, action): AuthState => {
        if (state.status !== 'initializing' || state.requestId !== action.meta.requestId) return state;
        return action.payload
          ? { status: 'authenticated', user: action.payload, startupError: null }
          : signedOutState();
      })
      .addCase(bootstrapAuth.rejected, (state, action): AuthState => {
        if (state.status !== 'initializing' || state.requestId !== action.meta.requestId) return state;
        return {
          status: 'startupError', user: null,
          startupError: action.payload ?? 'Unable to restore your session. Please try again.',
        };
      });
  },
});

export const { sessionEstablished, logout } = authSlice.actions;

export default authSlice.reducer;
