import { describe, expect, it, jest } from '@jest/globals';
import { resolveApiBaseUrl } from '../api-url';
import { axiosInstance, refreshInstance } from '../api.client';

describe('API origin validation', () => {
  it('uses the same configured origin for protected and authentication clients', () => {
    expect(axiosInstance.defaults.baseURL).toBe('http://127.0.0.1:5000');
    expect(refreshInstance.defaults.baseURL).toBe(axiosInstance.defaults.baseURL);
  });

  it('rejects an HTTP address when the actual clients initialize in release mode', () => {
    const previousUrl = process.env.EXPO_PUBLIC_API_URL;
    const previousDev = __DEV__;
    try {
      process.env.EXPO_PUBLIC_API_URL = 'http://192.168.1.136:5000';
      Object.defineProperty(globalThis, '__DEV__', { configurable: true, value: false });
      jest.isolateModules(() => {
        expect(() => jest.requireActual('../api.client')).toThrow('HTTPS');
      });
    } finally {
      process.env.EXPO_PUBLIC_API_URL = previousUrl;
      Object.defineProperty(globalThis, '__DEV__', { configurable: true, value: previousDev });
    }
  });

  it('initializes both actual clients with the same HTTPS address in release mode', () => {
    const previousUrl = process.env.EXPO_PUBLIC_API_URL;
    const previousDev = __DEV__;
    try {
      process.env.EXPO_PUBLIC_API_URL = 'https://api.example.com';
      Object.defineProperty(globalThis, '__DEV__', { configurable: true, value: false });
      jest.isolateModules(() => {
        const clients = jest.requireActual<typeof import('../api.client')>('../api.client');
        expect(clients.axiosInstance.defaults.baseURL).toBe('https://api.example.com');
        expect(clients.refreshInstance.defaults.baseURL).toBe('https://api.example.com');
      });
    } finally {
      process.env.EXPO_PUBLIC_API_URL = previousUrl;
      Object.defineProperty(globalThis, '__DEV__', { configurable: true, value: previousDev });
    }
  });
  it('accepts local development HTTP and normalizes a trailing slash', () => {
    expect(resolveApiBaseUrl('http://192.168.1.136:5000/', true)).toBe('http://192.168.1.136:5000');
    expect(resolveApiBaseUrl('http://127.0.0.1:5000', true)).toBe('http://127.0.0.1:5000');
    expect(resolveApiBaseUrl('http://10.0.0.2', true)).toBe('http://10.0.0.2');
    expect(resolveApiBaseUrl('http://172.31.1.1', true)).toBe('http://172.31.1.1');
  });

  it('accepts HTTPS in development and release', () => {
    expect(resolveApiBaseUrl('https://api.example.com/', true)).toBe('https://api.example.com');
    expect(resolveApiBaseUrl('https://api.example.com/', false)).toBe('https://api.example.com');
  });

  it('rejects HTTP in release and public HTTP in development', () => {
    expect(() => resolveApiBaseUrl('http://192.168.1.136:5000', false)).toThrow('HTTPS');
    expect(() => resolveApiBaseUrl('http://api.example.com', true)).toThrow('HTTPS');
    expect(() => resolveApiBaseUrl('http://172.32.0.1', true)).toThrow('HTTPS');
  });

  it.each([undefined, '', ' ', 'example.com', 'ftp://example.com', 'javascript:alert(1)',
    'https://name:password@example.com', 'https://example.com/api/v1',
    'https://example.com?x=1', 'https://example.com/#frag'])(
    'rejects missing or unsafe input %s', (value) => {
      expect(() => resolveApiBaseUrl(value, false)).toThrow('EXPO_PUBLIC_API_URL');
    },
  );
});
