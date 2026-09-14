import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  createShareToken,
  protectShareCursor,
  sanitizeAnalysisValue,
  sanitizeCollectionResult,
  unprotectShareCursor,
  verifyShareToken,
} from './share.service';

test('share tokens reject tampering', () => {
  const publicId = 'abcdefghijklmnopqrstuv';
  const token = createShareToken(publicId);
  assert.equal(verifyShareToken(token), publicId);
  assert.equal(verifyShareToken(`${token}x`), null);
});

test('share cursors are opaque and bound to a share and purpose', () => {
  const cursor = Buffer.from(JSON.stringify({ updatedAt: '2026-01-01', animeId: 4 })).toString('base64url');
  const protectedCursor = protectShareCursor(cursor, 'abcdefghijklmnopqrstuv', 'anime-list');
  assert.ok(protectedCursor);
  assert.equal(protectedCursor?.includes('2026-01-01'), false);
  assert.equal(unprotectShareCursor(protectedCursor, 'abcdefghijklmnopqrstuv', 'anime-list'), cursor);
  assert.throws(() => unprotectShareCursor(protectedCursor, 'different-share-id-xxx', 'anime-list'));
});

test('shared collection and analysis payloads remove private fields', () => {
  const result = sanitizeCollectionResult({
    totalCount: 1,
    items: [{ id: 7, userId: 3, animeId: 9, notes: 'private', createdAt: 'a', updatedAt: 'b', status: 'completed', anime: { id: 9 } }],
    pageInfo: { nextCursor: null, limit: 20 },
  }, 'abcdefghijklmnopqrstuv');
  assert.deepEqual(result.items[0], { animeId: 9, status: 'completed', anime: { id: 9 } });
  assert.deepEqual(
    sanitizeAnalysisValue({ updatedAt: 'private', nested: { notes: 'private', value: 2 }, userList: { id: 4, score: 9 } }),
    { nested: { value: 2 }, userList: { score: 9 } },
  );
});

test('share migration uses signed BIGINT foreign keys and no audience column', () => {
  const sql = readFileSync(join(process.cwd(), 'sql_scripts', '020_share_links.sql'), 'utf8');
  assert.match(sql, /owner_user_id BIGINT NOT NULL/);
  assert.match(sql, /resource_type ENUM\('COLLECTION', 'ANALYSIS'\)/);
  assert.doesNotMatch(sql, /audience|visibility_scope/i);
});
