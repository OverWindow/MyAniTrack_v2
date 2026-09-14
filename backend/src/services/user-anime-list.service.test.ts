import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildUserAnimeListSearchPattern,
  getUserAnimeList,
  validateUserAnimeListFormat,
  validateUserAnimeListQuery,
} from './user-anime-list.service';
import { validateVoiceActorRankingSort } from './user-voice-actor-stats.service';
import {
  getUserSeriesCollection,
  validateAnimeSeriesScope,
  validateUserSeriesCollectionStatus,
  validateUserSeriesQuery,
} from './user-series-stats.service';

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

test('series collection filters are normalized and bounded', () => {
  assert.equal(validateAnimeSeriesScope('franchise'), 'franchise');
  assert.equal(validateUserSeriesCollectionStatus('completed'), 'completed');
  assert.equal(validateUserSeriesQuery('  Frieren  '), 'Frieren');
  assert.equal(validateUserSeriesQuery('   '), undefined);
  assert.throws(() => validateAnimeSeriesScope('side-story'), /scope must be one of/);
  assert.throws(() => validateUserSeriesCollectionStatus('paused'), /status must be one of/);
  assert.throws(() => validateUserSeriesQuery('a'.repeat(101)), /100 characters/);
});

test('a series cursor cannot be reused with different filters', async () => {
  const cursor = Buffer.from(JSON.stringify({
    scope: 'mainline',
    status: 'watched',
    query: 'frieren',
    lastActivityAt: '2026-08-21T00:00:00.000Z',
    seriesId: 1,
  }), 'utf8').toString('base64url');

  await assert.rejects(
    getUserSeriesCollection({
      userId: 1,
      scope: 'franchise',
      status: 'watched',
      titleLanguage: 'ko',
      query: 'frieren',
      limit: 20,
      cursor,
    }),
    /Cursor scope does not match requested scope/,
  );
});
