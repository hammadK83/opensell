import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type AuthRouteNames = 'Login' | 'Register';

type AuthNavigationState = {
  currentScreen: AuthRouteNames;
};

const initialState: AuthNavigationState = {
  currentScreen: 'Login',
};

const authNavigationSlice = createSlice({
  name: 'authNavigation',
  initialState,
  reducers: {
    navigateToLogin(state) {
      state.currentScreen = 'Login';
    },
    navigateToRegister(state) {
      state.currentScreen = 'Register';
    },
    setAuthRoute(state, action: PayloadAction<AuthRouteNames>) {
      state.currentScreen = action.payload;
    },
  },
});

export const { navigateToLogin, navigateToRegister, setAuthRoute } = authNavigationSlice.actions;
export default authNavigationSlice.reducer;
