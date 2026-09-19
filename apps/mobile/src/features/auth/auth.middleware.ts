import type { Middleware } from '@reduxjs/toolkit';
import { logout, sessionEstablished } from './auth.slice';
import { beginSessionLogout, endSessionLogout, invalidateSession } from '../../services/storage/session-lifecycle';
import { signOut } from './auth.logout';

export const sessionLifecycleMiddleware: Middleware = () => (next) => (action) => {
  if (logout.match(action) || sessionEstablished.match(action)) invalidateSession();
  if (sessionEstablished.match(action)) endSessionLogout();
  if (signOut.pending.match(action)) beginSessionLogout();
  return next(action);
};
