import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type AuthState = {
  isAuthenticated: boolean;
  isInitializing: boolean;
};

const initialState: AuthState = {
  isAuthenticated: false,
  isInitializing: true,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuthenticated(state, action: PayloadAction<boolean>) {
      state.isAuthenticated = action.payload;
    },

    setInitializing(state, action: PayloadAction<boolean>) {
      state.isInitializing = action.payload;
    },

    logout(state) {
      state.isAuthenticated = false;
    },
  },
});

export const { setAuthenticated, setInitializing, logout } = authSlice.actions;

export default authSlice.reducer;
