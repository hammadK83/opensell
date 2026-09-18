import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { configureStore, findNonSerializableValue } from '@reduxjs/toolkit';
import authReducer, { logout, sessionEstablished } from '../auth.slice';
import { bootstrapAuth } from '../auth.bootstrap';
import { refreshToken } from '../api/auth.api';
import { tokenStorage } from '../../../services/storage/token.storage';

jest.mock('../api/auth.api', () => ({ refreshToken: jest.fn() }));
jest.mock('../../../services/storage/token.storage', () => ({
  tokenStorage: {
    getRefreshToken: jest.fn(),
    setTokens: jest.fn(),
    clearTokens: jest.fn(),
  },
}));

const user = {
  id: '507f1f77bcf86cd799439011',
  name: 'Jane Doe',
  email: 'jane@example.com',
  profileImage: 'https://example.com/profile.png',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};
const sessionUser = {
  ...user,
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt.toISOString(),
};
const session = { accessToken: 'new-access', refreshToken: 'new-refresh', user };
const storage = jest.mocked(tokenStorage);
const refresh = jest.mocked(refreshToken);
const makeStore = () => configureStore({ reducer: { auth: authReducer } });
const signedOut = { status: 'signedOut', user: null, startupError: null };

beforeEach(() => {
  jest.resetAllMocks();
  storage.getRefreshToken.mockResolvedValue('saved-refresh');
  storage.setTokens.mockResolvedValue();
  storage.clearTokens.mockResolvedValue();
  refresh.mockResolvedValue(session);
});

describe('session state', () => {
  it('starts with an explicit initializing state and no user', () => {
    expect(makeStore().getState().auth).toEqual({
      status: 'initializing', user: null, startupError: null,
    });
  });

  it('establishes authentication and user data in one serializable action', () => {
    const store = makeStore();
    // Extra API properties must not accidentally enter Redux through object spreading.
    const action = sessionEstablished({ ...user, ...{ accessToken: 'must-not-enter-redux' } });
    expect(findNonSerializableValue(action)).toBe(false);
    expect(action.payload).toEqual(sessionUser);
    store.dispatch(action);
    expect(store.getState().auth).toEqual({
      status: 'authenticated', user: sessionUser, startupError: null,
    });
    expect(findNonSerializableValue(store.getState())).toBe(false);
  });

  it('resets user and authentication together on local logout', () => {
    const store = makeStore();
    store.dispatch(sessionEstablished(user));
    store.dispatch(logout());
    expect(store.getState().auth).toEqual(signedOut);
  });

  it('clears a startup error when login establishes a session', async () => {
    const store = makeStore();
    storage.getRefreshToken.mockRejectedValueOnce(new Error('storage unavailable'));
    await store.dispatch(bootstrapAuth());
    expect(store.getState().auth.status).toBe('startupError');
    store.dispatch(sessionEstablished(user));
    expect(store.getState().auth).toEqual({
      status: 'authenticated', user: sessionUser, startupError: null,
    });
  });
});

describe('bootstrap state transitions', () => {
  it('signs out without calling refresh when there are no saved credentials', async () => {
    storage.getRefreshToken.mockResolvedValueOnce(null);
    const store = makeStore();
    await store.dispatch(bootstrapAuth());
    expect(store.getState().auth).toEqual(signedOut);
    expect(refresh).not.toHaveBeenCalled();
    expect(storage.clearTokens).not.toHaveBeenCalled();
  });

  it('waits for token persistence before establishing a serializable session', async () => {
    let finishSaving!: () => void;
    let notifySaving!: () => void;
    const savingStarted = new Promise<void>((resolve) => { notifySaving = resolve; });
    storage.setTokens.mockImplementationOnce(() => {
      notifySaving();
      return new Promise<void>((resolve) => { finishSaving = resolve; });
    });
    const store = makeStore();
    const pending = store.dispatch(bootstrapAuth());
    await savingStarted;
    expect(store.getState().auth.status).toBe('initializing');
    finishSaving();
    const action = await pending;
    expect(refresh).toHaveBeenCalledWith({ refreshToken: 'saved-refresh' });
    expect(storage.setTokens).toHaveBeenCalledWith('new-access', 'new-refresh');
    expect(action.payload).toEqual(sessionUser);
    expect(findNonSerializableValue(action)).toBe(false);
    expect(store.getState().auth).toEqual({
      status: 'authenticated', user: sessionUser, startupError: null,
    });
  });

  it('reports a storage read failure separately from missing credentials', async () => {
    storage.getRefreshToken.mockRejectedValueOnce(new Error('native storage error'));
    const store = makeStore();
    const action = await store.dispatch(bootstrapAuth());
    expect(store.getState().auth).toEqual({
      status: 'startupError', user: null,
      startupError: 'Unable to read your saved session. Please try again.',
    });
    expect(findNonSerializableValue(action)).toBe(false);
    expect(refresh).not.toHaveBeenCalled();
    expect(storage.clearTokens).not.toHaveBeenCalled();
  });

  it.each([
    ['network failure', new Error('Network Error')],
    ['server failure', { isAxiosError: true, response: { status: 500 } }],
    ['unexpected response', new Error('Invalid response')],
  ])('preserves credentials after %s and permits retry', async (_name, error) => {
    refresh.mockRejectedValueOnce(error);
    const store = makeStore();
    await store.dispatch(bootstrapAuth());
    expect(store.getState().auth.status).toBe('startupError');
    expect(store.getState().auth.user).toBeNull();
    expect(storage.clearTokens).not.toHaveBeenCalled();
    expect(storage.setTokens).not.toHaveBeenCalled();
    await store.dispatch(bootstrapAuth());
    expect(store.getState().auth.status).toBe('authenticated');
    expect(store.getState().auth.startupError).toBeNull();
  });

  it('clears explicitly rejected credentials and ends signed out', async () => {
    refresh.mockRejectedValueOnce({ isAxiosError: true, response: { status: 401 } });
    const store = makeStore();
    await store.dispatch(bootstrapAuth());
    expect(storage.clearTokens).toHaveBeenCalledTimes(1);
    expect(store.getState().auth).toEqual(signedOut);
  });

  it('reports cleanup failure instead of reporting successful session removal', async () => {
    refresh.mockRejectedValueOnce({ isAxiosError: true, response: { status: 401 } });
    storage.clearTokens.mockRejectedValueOnce(new Error('delete failed'));
    const store = makeStore();
    await store.dispatch(bootstrapAuth());
    expect(store.getState().auth).toEqual({
      status: 'startupError', user: null,
      startupError: 'Unable to remove your expired session. Please try again.',
    });
  });

  it('does not authenticate when saving rotated tokens fails', async () => {
    storage.setTokens.mockRejectedValueOnce(new Error('write failed'));
    const store = makeStore();
    await store.dispatch(bootstrapAuth());
    expect(store.getState().auth).toEqual({
      status: 'startupError', user: null,
      startupError: 'Unable to save your session. Please try again.',
    });
    expect(storage.clearTokens).not.toHaveBeenCalled();
  });
});
