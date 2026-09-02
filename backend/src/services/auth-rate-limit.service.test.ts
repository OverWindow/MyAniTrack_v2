import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advanceAuthRateLimit,
  AuthRateLimitPolicy,
  hashAuthRateLimitKey,
} from './auth-rate-limit.service';

const policy: AuthRateLimitPolicy = {
  scope: 'login_ip',
  windowMs: 15 * 60 * 1000,
  maxRequests: 2,
};

test('rate limit keys are stable, scoped hashes without raw identifiers', () => {
  const email = 'user@example.com';
  const first = hashAuthRateLimitKey('login_ip_email', `127.0.0.1\0${email}`);
  const second = hashAuthRateLimitKey('login_ip_email', `127.0.0.1\0${email}`);
  const otherScope = hashAuthRateLimitKey('password_email_ip_short', `127.0.0.1\0${email}`);

  assert.equal(first, second);
  assert.notEqual(first, otherScope);
  assert.equal(first.length, 64);
  assert.equal(first.includes(email), false);
  assert.equal(first.includes('127.0.0.1'), false);
});

test('rate limit blocks after the threshold and returns the remaining window', () => {
  const startedAt = new Date('2026-09-02T00:00:00.000Z');
  const now = new Date('2026-09-02T00:01:00.000Z');
  const allowed = advanceAuthRateLimit({ windowStartedAt: startedAt, attemptCount: 1 }, policy, now);
  const blocked = advanceAuthRateLimit(allowed.state, policy, now);

  assert.equal(allowed.result.allowed, true);
  assert.equal(allowed.result.attemptCount, 2);
  assert.equal(blocked.result.allowed, false);
  assert.equal(blocked.result.attemptCount, 3);
  assert.equal(blocked.result.retryAfterSeconds, 14 * 60);
});

test('rate limit resets after the configured window', () => {
  const startedAt = new Date('2026-09-02T00:00:00.000Z');
  const now = new Date('2026-09-02T00:15:00.000Z');
  const next = advanceAuthRateLimit({ windowStartedAt: startedAt, attemptCount: 3 }, policy, now);

  assert.equal(next.result.allowed, true);
  assert.equal(next.result.attemptCount, 1);
  assert.equal(next.state.windowStartedAt, now);
  assert.equal(next.result.retryAfterSeconds, 15 * 60);
});
