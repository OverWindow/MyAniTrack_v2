import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { join } from 'node:path';
import {
  assertOtherUser,
  validateProfileReportReason,
} from './content-moderation.service';
import { hasCurrentRequiredAgreements } from './user-agreement.service';

test('profile moderation rejects self targeting and unsupported reasons', () => {
  assert.throws(() => assertOtherUser(7, 7), /yourself/);
  assert.throws(() => validateProfileReportReason('UNSUPPORTED'), /Invalid report reason/);
  assert.equal(validateProfileReportReason('VIOLENT_CONTENT'), 'VIOLENT_CONTENT');
});

test('only the current terms version satisfies the agreement gate', () => {
  assert.equal(hasCurrentRequiredAgreements({
    termsAgreed: true,
    privacyAgreed: true,
    termsVersion: 'v1.0',
    privacyVersion: 'v1.0',
  }), false);
  assert.equal(hasCurrentRequiredAgreements({
    termsAgreed: true,
    privacyAgreed: true,
    termsVersion: 'v1.1',
    privacyVersion: 'v1.0',
  }), true);
});

test('content safety migration preserves catalog rows and adds moderation tables', () => {
  const sql = readFileSync(join(process.cwd(), 'sql_scripts', '019_content_safety.sql'), 'utf8');
  assert.match(sql, /ADD COLUMN app_visible BOOLEAN NOT NULL DEFAULT TRUE/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS user_blocks/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS profile_reports/);
  assert.match(sql, /moderation_status ENUM\('ACTIVE', 'SUSPENDED'\)/);
  assert.match(sql, /blocker_user_id BIGINT NOT NULL/);
  assert.match(sql, /reporter_user_id BIGINT NOT NULL/);
  assert.doesNotMatch(sql, /(?:blocker|blocked|reporter|reported|reviewed_by)_user_id BIGINT UNSIGNED/);
});

test('all high-risk user-facing anime services apply adult and manual visibility filters', () => {
  const files = [
    'anime.service.ts',
    'anime-series.service.ts',
    'user-anime-list.service.ts',
    'recommendation.service.ts',
    'smart-rating.service.ts',
    'voice-actor-detail.service.ts',
    'user-studio-stats.service.ts',
    'user-voice-actor-stats.service.ts',
    'user-viewing-dna.service.ts',
  ];
  for (const file of files) {
    const source = readFileSync(join(process.cwd(), 'src', 'services', file), 'utf8');
    assert.match(source, /is_adult\s*=\s*FALSE/, `${file} must block adult anime`);
    assert.match(source, /app_visible\s*=\s*TRUE/, `${file} must honor operator visibility`);
  }
});

test('viewing DNA aggregates qualify user-list status and score columns', () => {
  const source = readFileSync(
    join(process.cwd(), 'src', 'services', 'user-viewing-dna.service.ts'),
    'utf8',
  );

  assert.match(source, /SUM\(ual\.status <> 'planned'\)/);
  assert.match(source, /SUM\(ual\.status = 'completed'\)/);
  assert.match(source, /ual\.score IS NOT NULL/);
  assert.doesNotMatch(source, /SUM\(status/);
});

test('public anime list routes enforce visible-user middleware', () => {
  const source = readFileSync(
    join(process.cwd(), 'src', 'routes', 'user-anime-list.routes.ts'),
    'utf8',
  );

  assert.match(
    source,
    /router\.get\('\/users\/:userId\/anime-list\/series', optionalAuth, requireVisibleUser, getUserAnimeSeriesCollection\)/,
  );
  assert.match(
    source,
    /router\.get\('\/users\/:userId\/anime-list', optionalAuth, requireVisibleUser, getUserAnimeListController\)/,
  );
});
