import { configureStore } from '@reduxjs/toolkit';
import authNavigationReducer from '../features/auth/navigation/authNavigationSlice';

export const store = configureStore({
  reducer: {
    authNavigation: authNavigationReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
