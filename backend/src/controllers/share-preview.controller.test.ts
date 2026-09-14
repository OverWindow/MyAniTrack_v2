import assert from 'node:assert/strict';
import test from 'node:test';
import { getShareOgImageUrl } from './share-preview.controller';

test('share OG image URL is an absolute HTTP URL', () => {
  const url = new URL(getShareOgImageUrl());
  assert.match(url.protocol, /^https?:$/);
});
