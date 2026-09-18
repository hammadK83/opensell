import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ZodError } from 'zod';
import { axiosInstance } from '../../../../services/api/api.client';
import { login, logout, refreshToken, register } from '../auth.api';

jest.mock('../../../../services/api/api.client', () => ({
  axiosInstance: { post: jest.fn() },
}));

const post = jest.mocked(axiosInstance.post);
const user = {
  id: '507f1f77bcf86cd799439011',
  name: 'Jane Doe',
  email: 'jane@example.com',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};
const credentials = { email: 'JANE@Example.com', password: 'StrongPass1!' };
const registration = { name: '  Jane Doe  ', ...credentials };
const session = { accessToken: 'access-token', refreshToken: 'refresh-token', user };

function respond(data: unknown, status = 200) {
  post.mockResolvedValueOnce({ status, data: { success: true, data } });
}

beforeEach(() => {
  post.mockReset();
});

describe('register', () => {
  it('sends normalized fields and provider directly, without a body wrapper', async () => {
    respond(user, 201);
    await expect(register(registration)).resolves.toBe(true);
    expect(post).toHaveBeenCalledWith('/api/v1/auth/register', {
      name: 'Jane Doe',
      email: 'jane@example.com',
      password: credentials.password,
      provider: 'local',
    });
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('requires a password for local registration before sending a request', async () => {
    await expect(register({ name: 'Jane Doe', email: user.email })).rejects.toBeInstanceOf(ZodError);
    expect(post).not.toHaveBeenCalled();
  });

  it('does not report success for an unexpected status', async () => {
    respond(user, 200);
    await expect(register(registration)).rejects.toThrow('Failed to register account');
  });

  it('rejects a malformed registration response', async () => {
    respond({ ...user, id: 'invalid' }, 201);
    await expect(register(registration)).rejects.toBeInstanceOf(ZodError);
  });
});

describe('login', () => {
  it('normalizes email and returns schema-validated session data', async () => {
    respond(session);
    const result = await login(credentials);
    expect(post).toHaveBeenCalledWith('/api/v1/auth/login', {
      ...credentials,
      email: 'jane@example.com',
    });
    expect(result).toEqual({
      ...session,
      user: { ...user, createdAt: new Date(user.createdAt), updatedAt: new Date(user.updatedAt) },
    });
  });

  it('rejects invalid credentials before sending a request', async () => {
    await expect(login({ email: 'invalid', password: '' })).rejects.toBeInstanceOf(ZodError);
    expect(post).not.toHaveBeenCalled();
  });
});

describe('refreshToken', () => {
  it('sends the parsed payload and returns the rotated session', async () => {
    const rotated = { ...session, refreshToken: 'rotated-refresh-token' };
    respond(rotated);
    const input = { refreshToken: 'old-refresh-token', extra: 'not part of the contract' };
    const result = await refreshToken(input);
    expect(post).toHaveBeenCalledWith('/api/v1/auth/refresh', { refreshToken: 'old-refresh-token' });
    expect(result.refreshToken).toBe(rotated.refreshToken);
    expect(result.accessToken).toBe(rotated.accessToken);
    expect(result.user.id).toBe(user.id);
  });

  it('rejects an empty refresh token before sending a request', async () => {
    await expect(refreshToken({ refreshToken: '' })).rejects.toBeInstanceOf(ZodError);
    expect(post).not.toHaveBeenCalled();
  });
});

describe.each([
  ['login', () => login(credentials)],
  ['refresh', () => refreshToken({ refreshToken: 'refresh-token' })],
] satisfies [string, () => Promise<unknown>][])('%s response validation', (_name, invoke) => {
  it.each([
    ['missing access token', { refreshToken: session.refreshToken, user }],
    ['missing refresh token', { accessToken: session.accessToken, user }],
    ['missing user', { accessToken: session.accessToken, refreshToken: session.refreshToken }],
    ['invalid user', { ...session, user: { ...user, email: 'invalid' } }],
  ])('rejects %s', async (_case, data) => {
    respond(data);
    await expect(invoke()).rejects.toBeInstanceOf(ZodError);
  });

  it.each([false, undefined])('rejects an invalid success marker: %s', async (success) => {
    post.mockResolvedValueOnce({ status: 200, data: { success, data: session } });
    await expect(invoke()).rejects.toBeInstanceOf(ZodError);
  });
});

describe('logout', () => {
  it('sends the refresh token and accepts a null success payload', async () => {
    respond(null);
    await expect(logout({ refreshToken: session.refreshToken })).resolves.toBeUndefined();
    expect(post).toHaveBeenCalledWith('/api/v1/auth/logout', { refreshToken: session.refreshToken });
  });

  it('rejects an empty token before sending a request', async () => {
    await expect(logout({ refreshToken: '' })).rejects.toBeInstanceOf(ZodError);
    expect(post).not.toHaveBeenCalled();
  });

  it('rejects a non-null success payload', async () => {
    respond({});
    await expect(logout({ refreshToken: session.refreshToken })).rejects.toBeInstanceOf(ZodError);
  });
});

describe.each([
  ['register', () => register(registration)],
  ['login', () => login(credentials)],
  ['refresh', () => refreshToken({ refreshToken: session.refreshToken })],
  ['logout', () => logout({ refreshToken: session.refreshToken })],
] satisfies [string, () => Promise<unknown>][])('%s errors', (_name, invoke) => {
  it('preserves backend errors for the UI error handler', async () => {
    const error = Object.assign(new Error('Request failed'), {
      response: { status: 401, data: { code: 'UNAUTHORIZED', message: 'Account not verified' } },
    });
    post.mockRejectedValueOnce(error);
    await expect(invoke()).rejects.toBe(error);
    expect(post).toHaveBeenCalledTimes(1);
  });
});
