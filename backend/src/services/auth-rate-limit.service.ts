import crypto from 'crypto';
import { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/db';

const DEFAULT_RATE_LIMIT_SECRET = 'dev-only-secret-change-me';
const CLEANUP_INTERVAL_REQUESTS = 1000;
const CLEANUP_BATCH_SIZE = 1000;

interface AuthRateLimitRow extends RowDataPacket {
  windowStartedAt: Date | string;
  attemptCount: number;
}

export interface AuthRateLimitPolicy {
  scope: string;
  windowMs: number;
  maxRequests: number;
}

export interface AuthRateLimitResult {
  allowed: boolean;
  attemptCount: number;
  retryAfterSeconds: number;
}

export interface AuthRateLimitState {
  windowStartedAt: Date;
  attemptCount: number;
}

let requestsSinceCleanup = 0;

function getRateLimitSecret() {
  return process.env.AUTH_TOKEN_SECRET || DEFAULT_RATE_LIMIT_SECRET;
}

function asDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

function validatePolicy(policy: AuthRateLimitPolicy) {
  if (!/^[a-z0-9_-]{1,40}$/.test(policy.scope)) {
    throw new Error('Invalid auth rate limit scope');
  }

  if (!Number.isInteger(policy.windowMs) || policy.windowMs < 1000) {
    throw new Error('Invalid auth rate limit window');
  }

  if (!Number.isInteger(policy.maxRequests) || policy.maxRequests < 1) {
    throw new Error('Invalid auth rate limit maximum');
  }
}

export function hashAuthRateLimitKey(scope: string, rawKey: string) {
  return crypto
    .createHmac('sha256', getRateLimitSecret())
    .update(`auth-rate-limit\0${scope}\0${rawKey}`)
    .digest('hex');
}

export function advanceAuthRateLimit(
  current: AuthRateLimitState,
  policy: AuthRateLimitPolicy,
  now: Date
) {
  const windowExpired = now.getTime() - current.windowStartedAt.getTime() >= policy.windowMs;
  const windowStartedAt = windowExpired ? now : current.windowStartedAt;
  const attemptCount = windowExpired
    ? 1
    : Math.min(current.attemptCount + 1, policy.maxRequests + 1);
  const resetAt = windowStartedAt.getTime() + policy.windowMs;

  return {
    state: {
      windowStartedAt,
      attemptCount,
    },
    result: {
      allowed: attemptCount <= policy.maxRequests,
      attemptCount,
      retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now.getTime()) / 1000)),
    } satisfies AuthRateLimitResult,
  };
}

function scheduleCleanup() {
  requestsSinceCleanup += 1;

  if (requestsSinceCleanup < CLEANUP_INTERVAL_REQUESTS) {
    return;
  }

  requestsSinceCleanup = 0;
  void pool.execute(
    `
    DELETE FROM auth_rate_limits
    WHERE updated_at < DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL 48 HOUR)
    LIMIT ${CLEANUP_BATCH_SIZE}
    `
  ).catch((error) => {
    console.error('Auth rate limit cleanup failed', error);
  });
}

export async function consumeAuthRateLimit(
  policy: AuthRateLimitPolicy,
  rawKey: string,
  now = new Date()
): Promise<AuthRateLimitResult> {
  validatePolicy(policy);
  const keyHash = hashAuthRateLimitKey(policy.scope, rawKey || 'unknown');
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await connection.execute(
      `
      INSERT IGNORE INTO auth_rate_limits (
        scope,
        key_hash,
        window_started_at,
        attempt_count
      )
      VALUES (?, ?, ?, 0)
      `,
      [policy.scope, keyHash, now]
    );

    const [rows] = await connection.query<AuthRateLimitRow[]>(
      `
      SELECT
        window_started_at AS windowStartedAt,
        attempt_count AS attemptCount
      FROM auth_rate_limits
      WHERE scope = ? AND key_hash = ?
      FOR UPDATE
      `,
      [policy.scope, keyHash]
    );
    const row = rows[0];

    if (!row) {
      throw new Error('Auth rate limit row unavailable');
    }

    const next = advanceAuthRateLimit({
      windowStartedAt: asDate(row.windowStartedAt),
      attemptCount: Number(row.attemptCount),
    }, policy, now);

    await connection.execute(
      `
      UPDATE auth_rate_limits
      SET
        window_started_at = ?,
        attempt_count = ?,
        updated_at = CURRENT_TIMESTAMP(3)
      WHERE scope = ? AND key_hash = ?
      `,
      [next.state.windowStartedAt, next.state.attemptCount, policy.scope, keyHash]
    );
    await connection.commit();

    scheduleCleanup();
    return next.result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
