import ms, { type StringValue } from 'ms';
import { z } from 'zod';

export const refreshTokenTtlSchema = z.string().default('30d').refine((value) => {
  try {
    const duration = ms(value as StringValue);
    return typeof duration === 'number'
      && Number.isFinite(duration)
      && duration > 0
      && Number.isFinite(new Date(Date.now() + duration).getTime());
  } catch {
    return false;
  }
}, 'REFRESH_TOKEN_TTL must be a positive duration that fits in a Date, for example 30d');
