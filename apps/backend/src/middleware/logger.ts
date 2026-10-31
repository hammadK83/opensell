import morgan from 'morgan';
import { env } from '../config/env.js';

// URLSearchParams decodes encoded parameter names and handles repeated values.
// This changes only log output; Express still receives the original request URL.
export function redactSensitiveUrl(value: string): string {
  try {
    const url = new URL(value, 'http://log.invalid');
    for (const key of [...url.searchParams.keys()]) {
      let decoded = key;
      try { decoded = decodeURIComponent(key); } catch { /* use the once-decoded key */ }
      if (/^(token|verificationtoken)(?:\[[^\]]*\])?$/i.test(decoded)) {
        url.searchParams.set(key, '[REDACTED]');
      }
    }
    return /^https?:\/\//i.test(value)
      ? url.toString()
      : `${url.pathname}${url.search}${url.hash}`;
  } catch {
    // A malformed URL must never be logged with its query string intact.
    return value.split('?')[0];
  }
}

morgan.token('safe-url', (req) => {
  const url = 'originalUrl' in req && typeof req.originalUrl === 'string'
    ? req.originalUrl : req.url || '';
  return redactSensitiveUrl(url);
});
morgan.token('safe-referrer', (req) => {
  const referrer = req.headers.referer || req.headers.referrer;
  return typeof referrer === 'string' ? redactSensitiveUrl(referrer) : '-';
});

const developmentFormat = ':method :safe-url :status :response-time ms - :res[content-length]';
const productionFormat = ':remote-addr - :remote-user [:date[clf]] ":method :safe-url HTTP/:http-version" :status :res[content-length] ":safe-referrer" ":user-agent"';

export function createRequestLogger(
  mode: 'development' | 'production',
  stream?: { write: (message: string) => void },
) {
  return morgan(mode === 'production' ? productionFormat : developmentFormat, stream ? { stream } : {});
}

export const logger = createRequestLogger(env.NODE_ENV);
