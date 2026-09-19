import { configureStore } from '@reduxjs/toolkit';

import authReducer, { logout } from '../features/auth/auth.slice';
import { sessionLifecycleMiddleware } from '../features/auth/auth.middleware';
import { setupApiInterceptors } from '../services/api';

export const store = configureStore({
  reducer: {
    auth: authReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(sessionLifecycleMiddleware),
});

setupApiInterceptors(() => store.dispatch(logout()));

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
