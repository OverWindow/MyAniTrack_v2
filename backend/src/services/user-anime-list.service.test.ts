import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildUserAnimeListSearchPattern,
  getUserAnimeList,
  validateUserAnimeListFormat,
  validateUserAnimeListQuery,
} from './user-anime-list.service';
import { validateVoiceActorRankingSort } from './user-voice-actor-stats.service';

test('collection query is normalized and bounded', () => {
  assert.equal(validateUserAnimeListQuery('  Sousou   no Frieren  '), 'Sousou no Frieren');
  assert.equal(validateUserAnimeListQuery('   '), undefined);
  assert.throws(() => validateUserAnimeListQuery('a'.repeat(101)), /100 characters/);
});

test('LIKE wildcard characters are escaped', () => {
  assert.equal(buildUserAnimeListSearchPattern('100%_hero\\'), '%100\\%\\_hero\\\\%');
});

test('collection format filter only accepts supported anime formats', () => {
  assert.equal(validateUserAnimeListFormat('TV'), 'TV');
  assert.equal(validateUserAnimeListFormat(undefined), undefined);
  assert.throws(() => validateUserAnimeListFormat('WEB'), /format must be one of/);
});

test('voice actor ranking accepts watch time sorting', () => {
  assert.equal(validateVoiceActorRankingSort('watchTime'), 'watchTime');
  assert.throws(() => validateVoiceActorRankingSort('duration'), /count, score, watchTime/);
});

test('a cursor cannot be reused with a different collection query', async () => {
  const cursor = Buffer.from(JSON.stringify({
    sort: 'latest',
    query: 'frieren',
    animeId: 1,
  }), 'utf8').toString('base64url');

  await assert.rejects(
    getUserAnimeList({
      userId: 1,
      sort: 'latest',
      titleLanguage: 'ko',
      query: 'dungeon meshi',
      limit: 20,
      cursor,
    }),
    /Cursor query does not match requested query/,
  );
});

test('a cursor cannot be reused with a different format filter', async () => {
  const cursor = Buffer.from(JSON.stringify({
    sort: 'latest',
    format: 'TV',
    animeId: 1,
  }), 'utf8').toString('base64url');

  await assert.rejects(
    getUserAnimeList({
      userId: 1,
      sort: 'latest',
      titleLanguage: 'ko',
      format: 'MOVIE',
      limit: 20,
      cursor,
    }),
    /Cursor format does not match requested format/,
  );
});
