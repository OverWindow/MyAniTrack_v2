import assert from 'node:assert/strict';
import test from 'node:test';
import { pickAnimeTitle } from './anime-title';

const titles = {
  korean: '한국어 제목',
  english: 'English Title',
  romaji: 'Romaji Title',
  userPreferred: 'Preferred Title',
  native: '原題',
};

test('selects the requested title language first', () => {
  assert.equal(pickAnimeTitle(titles, 'ko'), '한국어 제목');
  assert.equal(pickAnimeTitle(titles, 'en'), 'English Title');
  assert.equal(pickAnimeTitle(titles, 'ja'), '原題');
});

test('keeps Korean last when English is unavailable', () => {
  assert.equal(pickAnimeTitle({ ...titles, english: null }, 'en'), 'Romaji Title');
  assert.equal(
    pickAnimeTitle({
      korean: '한국어 제목',
      english: null,
      romaji: null,
      userPreferred: null,
      native: '原題',
    }, 'en'),
    '原題'
  );
});

test('ignores blank title values', () => {
  assert.equal(pickAnimeTitle({ english: '  ', romaji: 'Fallback' }, 'en'), 'Fallback');
});
