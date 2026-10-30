import { Request, Response, NextFunction } from 'express';

const WINDOW_MS = 15 * 60_000;
const MAX_REQUESTS = 10;
const requests = new Map<string, { count: number; resetAt: number }>();

export function resendRateLimit(req: Request, res: Response, next: NextFunction) {
  const now = Date.now();
  for (const [ip, entry] of requests) {
    if (entry.resetAt <= now) requests.delete(ip);
  }

  const ip = req.ip ?? 'unknown';
  const entry = requests.get(ip) ?? { count: 0, resetAt: now + WINDOW_MS };
  entry.count += 1;
  requests.set(ip, entry);

  if (entry.count > MAX_REQUESTS) {
    res.status(429).json({ code: 'RATE_LIMITED', message: 'Please try again later.' });
    return;
  }
  next();
}
