import { isIP } from 'node:net';
import type { Request, RequestHandler } from 'express';
import { API_ERROR_CODES } from '@opensell/shared';
import { env } from '../config/env.js';
import { consumeAuthRateLimit, type RateLimitPolicy } from '../services/auth-rate-limit.service.js';

const commonWindowMs = env.AUTH_RATE_WINDOW_SECONDS * 1_000;
const registerWindowMs = env.AUTH_REGISTER_WINDOW_SECONDS * 1_000;

export const AUTH_RATE_POLICIES = {
  loginIp: { name: 'login-ip', limit: env.AUTH_LOGIN_IP_LIMIT, windowMs: commonWindowMs },
  loginAccount: { name: 'login-account', limit: env.AUTH_LOGIN_ACCOUNT_LIMIT, windowMs: commonWindowMs },
  registerIp: { name: 'register-ip', limit: env.AUTH_REGISTER_IP_LIMIT, windowMs: registerWindowMs },
  verifyIp: { name: 'verify-ip', limit: env.AUTH_VERIFY_IP_LIMIT, windowMs: commonWindowMs },
  refreshIp: { name: 'refresh-ip', limit: env.AUTH_REFRESH_IP_LIMIT, windowMs: commonWindowMs },
  resendIp: { name: 'resend-ip', limit: env.AUTH_RESEND_IP_LIMIT, windowMs: commonWindowMs },
} as const satisfies Record<string, RateLimitPolicy>;

export function clientIp(req: Request): string {
  const reported = (req.ip ?? '').trim();
  const portSuffix = reported.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  const bracketed = reported.match(/^\[([0-9a-fA-F:.]+)\](?::\d+)?$/);
  const candidate = portSuffix?.[1] ?? bracketed?.[1] ?? reported;
  const address = isIP(candidate) ? candidate : (req.socket.remoteAddress ?? '');
  if (isIP(address) === 4) return address;
  if (isIP(address) === 6) {
    if (address.toLowerCase().startsWith('::ffff:') && isIP(address.slice(7)) === 4) {
      return address.slice(7);
    }
    return new URL(`http://[${address}]/`).hostname.slice(1, -1);
  }
  return 'unknown';
}

export function authRateLimit(policy: RateLimitPolicy, identity: (req: Request) => string): RequestHandler {
  return async (req, res, next) => {
    try {
      const result = await consumeAuthRateLimit(policy, identity(req));
      if (!result.allowed) {
        res.set('Retry-After', String(result.retryAfterSeconds));
        res.status(429).json({
          code: API_ERROR_CODES.RATE_LIMITED,
          message: 'Too many requests. Please try again later.',
        });
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export const limitLoginIp = authRateLimit(AUTH_RATE_POLICIES.loginIp, clientIp);
export const limitLoginAccount = authRateLimit(AUTH_RATE_POLICIES.loginAccount, (req) => req.body.email);
export const limitRegisterIp = authRateLimit(AUTH_RATE_POLICIES.registerIp, clientIp);
export const limitVerifyIp = authRateLimit(AUTH_RATE_POLICIES.verifyIp, clientIp);
export const limitRefreshIp = authRateLimit(AUTH_RATE_POLICIES.refreshIp, clientIp);
export const limitResendIp = authRateLimit(AUTH_RATE_POLICIES.resendIp, clientIp);
