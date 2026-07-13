import { NextFunction, Request, Response } from 'express';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  message: string;
}

function createIpRateLimit(options: RateLimitOptions) {
  const entries = new Map<string, RateLimitEntry>();
  let requestsSinceCleanup = 0;

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const existing = entries.get(key);
    const entry = !existing || existing.resetAt <= now
      ? { count: 0, resetAt: now + options.windowMs }
      : existing;

    entry.count += 1;
    entries.set(key, entry);

    requestsSinceCleanup += 1;
    if (requestsSinceCleanup >= 1000) {
      requestsSinceCleanup = 0;
      for (const [storedKey, storedEntry] of entries) {
        if (storedEntry.resetAt <= now) {
          entries.delete(storedKey);
        }
      }
    }

    if (entry.count > options.maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));

      return res.status(429).json({
        success: false,
        message: options.message,
      });
    }

    return next();
  };
}

const genericMessage = 'Too many requests. Please try again later.';

export const passwordEmailShortIpLimit = createIpRateLimit({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  message: genericMessage,
});

export const passwordEmailDailyIpLimit = createIpRateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  maxRequests: 50,
  message: genericMessage,
});

export const passwordResetConfirmIpLimit = createIpRateLimit({
  windowMs: 15 * 60 * 1000,
  maxRequests: 30,
  message: genericMessage,
});
