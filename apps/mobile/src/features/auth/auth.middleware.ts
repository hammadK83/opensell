import type { Middleware } from '@reduxjs/toolkit';
import { logout, sessionEstablished } from './auth.slice';
import { invalidateSession } from '../../services/storage/session-lifecycle';

export const sessionLifecycleMiddleware: Middleware = () => (next) => (action) => {
  if (logout.match(action) || sessionEstablished.match(action)) invalidateSession();
  return next(action);
};
