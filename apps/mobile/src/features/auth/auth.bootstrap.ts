import { createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { tokenStorage } from '../../services/storage/token.storage';
import { refreshToken } from './api/auth.api';
import { User, toSessionUser } from './model/user';

export const bootstrapAuth = createAsyncThunk<User | null, void, { rejectValue: string }>(
  'auth/bootstrap',
  async (_, { rejectWithValue }) => {
    let savedRefreshToken: string | null;
    try {
      savedRefreshToken = await tokenStorage.getRefreshToken();
    } catch {
      return rejectWithValue('Unable to read your saved session. Please try again.');
    }

    if (!savedRefreshToken) return null;

    let data;
    try {
      data = await refreshToken({ refreshToken: savedRefreshToken });
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        try {
          await tokenStorage.clearTokens();
          return null;
        } catch {
          return rejectWithValue('Unable to remove your expired session. Please try again.');
        }
      }
      return rejectWithValue('Unable to restore your session. Please try again.');
    }

    try {
      await tokenStorage.setTokens(data.accessToken, data.refreshToken);
    } catch {
      return rejectWithValue('Unable to save your session. Please try again.');
    }
    return toSessionUser(data.user);
  },
);
