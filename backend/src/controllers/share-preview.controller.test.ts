import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { getShareOgImageUrl, renderSharePreviewImage } from './share-preview.controller';

test('share OG image URL is an absolute HTTP URL', () => {
  const url = new URL(getShareOgImageUrl());
  assert.match(url.protocol, /^https?:$/);
});

test('share preview image is a 1200x630 PNG', async () => {
  const image = await renderSharePreviewImage({
    valid: true,
    username: '<김애니 & friends>',
    resourceType: 'ANALYSIS',
    animeListCount: 42,
  });
  const metadata = await sharp(image).metadata();

  assert.equal(metadata.format, 'png');
  assert.equal(metadata.width, 1200);
  assert.equal(metadata.height, 630);
  assert.ok(image.length > 10_000);
});
