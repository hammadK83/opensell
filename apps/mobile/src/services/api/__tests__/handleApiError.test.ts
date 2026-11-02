import { afterEach, expect, it, jest } from '@jest/globals';
import { getApiErrorMessage } from '../handleApiError';

afterEach(() => { jest.restoreAllMocks(); });

function responseError(status: number, code: string, message: string) {
  return Object.assign(new Error('Request failed'), {
    isAxiosError: true,
    response: { status, data: { code, message } },
  });
}

it('presents a duplicate registration conflict as actionable feedback', () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  const message = getApiErrorMessage(responseError(409, 'CONFLICT', 'Resource already exists'));
  expect(message).toBe('Resource already exists');
  expect(message).not.toContain('servers');
});

it('presents an oversized request as a client input problem', () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  const message = getApiErrorMessage(responseError(413, 'VALIDATION_ERROR', 'Request body is too large'));
  expect(message).toBe('Request body is too large');
  expect(message).not.toContain('servers');
});
