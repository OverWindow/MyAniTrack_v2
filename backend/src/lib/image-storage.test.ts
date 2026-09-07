import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertS3HeadMatchesUpload,
  calculateImageSha256,
  getImageStorageErrorStatus,
  getImageFileExtension,
  getPublicObjectUrl,
  getS3ObjectKeyFromPublicUrl,
} from './image-storage';
import { getS3ImageStorageConfig } from '../config/env';
import { validateCatalogImageSourceUrl } from '../../sync/catalog-image.sync.service';

function configureStorageEnv() {
  process.env.IMAGE_STORAGE_PROVIDER = 's3';
  process.env.AWS_REGION = 'ap-northeast-2';
  process.env.AWS_S3_BUCKET = 'test-assets';
  process.env.IMAGE_CDN_BASE_URL = 'https://images.example.com';
  process.env.SUPABASE_URL = 'https://project.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role';
  process.env.SUPABASE_STORAGE_BUCKET = 'legacy-assets';
  delete process.env.SUPABASE_STORAGE_PUBLIC_BASE_URL;
}

test('CloudFront public URLs encode and recover S3 object keys', () => {
  configureStorageEnv();
  const objectKey = 'catalog-images/anime/42/cover image.webp';
  const publicUrl = getPublicObjectUrl(objectKey);

  assert.equal(
    publicUrl,
    'https://images.example.com/catalog-images/anime/42/cover%20image.webp',
  );
  assert.equal(getS3ObjectKeyFromPublicUrl(publicUrl), objectKey);
  assert.equal(getS3ObjectKeyFromPublicUrl('https://attacker.example/catalog-images/a.webp'), null);
});

test('image extensions are derived from supported MIME types', () => {
  assert.equal(getImageFileExtension('image/webp'), 'webp');
  assert.equal(getImageFileExtension('image/avif'), 'avif');
  assert.equal(getImageFileExtension('image/jpeg'), 'jpg');
});

test('S3 image storage environment is validated and normalized', () => {
  configureStorageEnv();
  process.env.IMAGE_CDN_BASE_URL = 'https://images.example.com///';

  assert.deepEqual(getS3ImageStorageConfig(), {
    provider: 's3',
    region: 'ap-northeast-2',
    bucket: 'test-assets',
    publicBaseUrl: 'https://images.example.com',
    profileImagesPrefix: 'profile-images',
    catalogImagesPrefix: 'catalog-images',
  });

  process.env.IMAGE_STORAGE_PROVIDER = 'supabase';
  assert.throws(() => getS3ImageStorageConfig(), /must be s3/);
  configureStorageEnv();
});

test('S3 HeadObject metadata must match size, MIME, and SHA-256', () => {
  const checksumSha256 = calculateImageSha256(Buffer.from('image'));
  const checksumBase64 = Buffer.from(checksumSha256, 'hex').toString('base64');

  assert.doesNotThrow(() => assertS3HeadMatchesUpload({
    ContentLength: 5,
    ContentType: 'image/webp',
    ChecksumSHA256: checksumBase64,
    Metadata: { sha256: checksumSha256 },
  }, {
    contentType: 'image/webp',
    size: 5,
    checksumSha256,
  }));

  assert.throws(() => assertS3HeadMatchesUpload({
    ContentLength: 4,
    ContentType: 'image/webp',
    Metadata: { sha256: checksumSha256 },
  }, {
    contentType: 'image/webp',
    size: 5,
    checksumSha256,
  }), /verify failed/);
});

test('AWS HTTP status is retained for safe error mapping', () => {
  assert.equal(getImageStorageErrorStatus({ $metadata: { httpStatusCode: 403 } }), 403);
  assert.equal(getImageStorageErrorStatus(new Error('network failure')), undefined);
});

test('catalog image sources only allow the configured providers', () => {
  configureStorageEnv();

  assert.equal(
    validateCatalogImageSourceUrl(
      'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/test.jpg',
      'anilist',
    ).hostname,
    's4.anilist.co',
  );
  assert.equal(
    validateCatalogImageSourceUrl(
      'https://project.supabase.co/storage/v1/object/public/legacy-assets/catalog-images/test.webp',
      'supabase',
    ).hostname,
    'project.supabase.co',
  );
  assert.equal(
    validateCatalogImageSourceUrl(
      'https://images.example.com/catalog-images/test.webp',
      'cloudfront',
    ).hostname,
    'images.example.com',
  );

  assert.throws(
    () => validateCatalogImageSourceUrl(
      'https://project.supabase.co.attacker.example/storage/v1/object/public/legacy-assets/test.webp',
      'supabase',
    ),
    /not allowed/,
  );
  assert.throws(
    () => validateCatalogImageSourceUrl(
      'https://attacker.example/catalog-images/test.webp',
      'cloudfront',
    ),
    /not allowed/,
  );
});
