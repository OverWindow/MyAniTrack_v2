import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildUserAnimeListSearchPattern,
  getUserAnimeList,
  validateUserAnimeListQuery,
} from './user-anime-list.service';

test('collection query is normalized and bounded', () => {
  assert.equal(validateUserAnimeListQuery('  Sousou   no Frieren  '), 'Sousou no Frieren');
  assert.equal(validateUserAnimeListQuery('   '), undefined);
  assert.throws(() => validateUserAnimeListQuery('a'.repeat(101)), /100 characters/);
});

test('LIKE wildcard characters are escaped', () => {
  assert.equal(buildUserAnimeListSearchPattern('100%_hero\\'), '%100\\%\\_hero\\\\%');
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
