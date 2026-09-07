import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createCatalogImageObjectKey,
  readCatalogImageResponse,
} from './catalog-image.sync.service';

test('catalog image object keys are deterministic and content-addressed', () => {
  const key = createCatalogImageObjectKey({
    entityType: 'anime',
    anilistId: 42,
    variant: 'cover_extra_large',
    sourceHash: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    contentType: 'image/webp',
    prefix: '/catalog-images/',
  });

  assert.equal(key, 'catalog-images/anime/42/cover_extra_large-1234567890abcdef.webp');
});

test('catalog image responses enforce MIME type and actual streamed size', async () => {
  const valid = await readCatalogImageResponse(new Response(Buffer.from('image'), {
    status: 200,
    headers: { 'content-type': 'image/jpeg' },
  }), 10);

  assert.equal(valid.contentType, 'image/jpeg');
  assert.equal(valid.buffer.toString(), 'image');

  await assert.rejects(
    readCatalogImageResponse(new Response(Buffer.from('not-image'), {
      status: 200,
      headers: { 'content-type': 'text/plain' },
    }), 20),
    /unsupported content type/,
  );

  await assert.rejects(
    readCatalogImageResponse(new Response(Buffer.alloc(11), {
      status: 200,
      headers: { 'content-type': 'image/png' },
    }), 10),
    /10MB limit/,
  );
});
