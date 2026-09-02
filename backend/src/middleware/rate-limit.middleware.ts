import { NextFunction, Request, Response } from 'express';
import {
  AuthRateLimitPolicy,
  consumeAuthRateLimit,
} from '../services/auth-rate-limit.service';

interface RateLimitOptions extends AuthRateLimitPolicy {
  key: (req: Request) => string;
}

const tooManyRequestsMessage = 'Too many requests. Please try again later.';
const unavailableMessage = 'Authentication temporarily unavailable';

function getPositiveIntegerEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function getClientIp(req: Request) {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function getNormalizedEmail(req: Request) {
  const email = req.body && typeof req.body.email === 'string'
    ? req.body.email.trim().toLowerCase()
    : '';
  return email || 'invalid-email';
}

function createAuthRateLimit(options: RateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await consumeAuthRateLimit(options, options.key(req));

      if (!result.allowed) {
        res.setHeader('Retry-After', String(result.retryAfterSeconds));
        return res.status(429).json({
          success: false,
          message: tooManyRequestsMessage,
        });
      }

      return next();
    } catch (error) {
      console.error('Authentication rate limit check failed', error);
      return res.status(503).json({
        success: false,
        message: unavailableMessage,
      });
    }
  };
}

export const loginIpLimit = createAuthRateLimit({
  scope: 'login_ip',
  windowMs: getPositiveIntegerEnv('AUTH_LOGIN_WINDOW_SECONDS', 15 * 60) * 1000,
  maxRequests: getPositiveIntegerEnv('AUTH_LOGIN_IP_MAX', 30),
  key: getClientIp,
});

export const loginIdentityLimit = createAuthRateLimit({
  scope: 'login_ip_email',
  windowMs: getPositiveIntegerEnv('AUTH_LOGIN_WINDOW_SECONDS', 15 * 60) * 1000,
  maxRequests: getPositiveIntegerEnv('AUTH_LOGIN_IDENTITY_MAX', 10),
  key: (req) => `${getClientIp(req)}\0${getNormalizedEmail(req)}`,
});

export const supabaseAuthIpLimit = createAuthRateLimit({
  scope: 'supabase_auth_ip',
  windowMs: getPositiveIntegerEnv('AUTH_SUPABASE_WINDOW_SECONDS', 5 * 60) * 1000,
  maxRequests: getPositiveIntegerEnv('AUTH_SUPABASE_IP_MAX', 30),
  key: getClientIp,
});

export const passwordEmailShortIpLimit = createAuthRateLimit({
  scope: 'password_email_ip_short',
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  key: getClientIp,
});

export const passwordEmailDailyIpLimit = createAuthRateLimit({
  scope: 'password_email_ip_daily',
  windowMs: 24 * 60 * 60 * 1000,
  maxRequests: 50,
  key: getClientIp,
});

export const passwordResetConfirmIpLimit = createAuthRateLimit({
  scope: 'password_reset_confirm_ip',
  windowMs: 15 * 60 * 1000,
  maxRequests: 30,
  key: getClientIp,
});
