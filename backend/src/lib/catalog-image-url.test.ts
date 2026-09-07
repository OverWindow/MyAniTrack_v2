import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isAniListImageUrl,
  stripAniListImageUrls,
  validateAniListImageSourceUrl,
} from './catalog-image-url';

test('AniList image validation accepts only the HTTPS image host', () => {
  assert.equal(isAniListImageUrl('https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/test.jpg'), true);
  assert.equal(isAniListImageUrl('http://s4.anilist.co/test.jpg'), true);
  assert.equal(isAniListImageUrl('https://anilist.co/anime/1'), false);
  assert.throws(() => validateAniListImageSourceUrl('http://s4.anilist.co/test.jpg'));
  assert.throws(() => validateAniListImageSourceUrl('https://s4.anilist.co.example.com/test.jpg'));
  assert.throws(() => validateAniListImageSourceUrl('https://user@s4.anilist.co/test.jpg'));
});

test('response sanitization removes AniList CDN images but preserves ordinary AniList links', () => {
  const payload = {
    coverImageLarge: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/test.jpg',
    siteUrl: 'https://anilist.co/anime/1',
    nested: [{ image: 'https://s4.anilist.co/file/anilistcdn/character/large/test.jpg' }],
  };

  assert.deepEqual(stripAniListImageUrls(payload), {
    coverImageLarge: null,
    siteUrl: 'https://anilist.co/anime/1',
    nested: [{ image: null }],
  });
});
