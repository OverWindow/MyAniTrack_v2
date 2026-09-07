import crypto from 'crypto';
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { getS3ImageStorageConfig } from '../config/env';
import {
  deleteObjectByKey as deleteLegacySupabaseObjectByKey,
  getObjectKeyFromPublicUrl as getLegacySupabaseObjectKeyFromPublicUrl,
  normalizeProfileImageUrl as normalizeLegacyProfileImageUrl,
} from './supabase-storage';

const DEFAULT_CACHE_CONTROL = 'public, max-age=31536000, immutable';
const STORAGE_PREFLIGHT_TTL_MS = 10 * 60 * 1000;
const STORAGE_PREFLIGHT_TIMEOUT_MS = 60 * 1000;
const SUPPORTED_IMAGE_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

let s3Client: S3Client | null = null;
let lastSuccessfulPreflightAt = 0;
let preflightPromise: Promise<void> | null = null;

export class ImageStorageError extends Error {
  public readonly cause?: unknown;

  constructor(
    public readonly action: 'upload' | 'verify' | 'delete' | 'cdn-read',
    public readonly storageStatus?: number,
    options?: { cause?: unknown },
  ) {
    super(`S3 image storage ${action} failed${storageStatus ? ` (HTTP ${storageStatus})` : ''}`);
    this.name = 'ImageStorageError';
    this.cause = options?.cause;
  }
}

function getClient() {
  if (!s3Client) {
    s3Client = new S3Client({ region: getS3ImageStorageConfig().region });
  }

  return s3Client;
}

function encodeObjectPath(objectKey: string) {
  return objectKey.split('/').map(encodeURIComponent).join('/');
}

function normalizeObjectKey(objectKey: string) {
  const normalized = objectKey.replace(/^\/+/, '');

  if (!normalized || normalized.split('/').some((segment) => segment === '..')) {
    throw new Error('Image object key is invalid');
  }

  return normalized;
}

export function getImageStorageErrorStatus(error: unknown) {
  if (error instanceof S3ServiceException) {
    return error.$metadata.httpStatusCode;
  }

  if (error && typeof error === 'object' && '$metadata' in error) {
    return Number((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode) || undefined;
  }

  return undefined;
}

function wrapStorageError(
  action: ImageStorageError['action'],
  error: unknown,
): never {
  if (error instanceof ImageStorageError) {
    throw error;
  }

  throw new ImageStorageError(action, getImageStorageErrorStatus(error), { cause: error });
}

export function calculateImageSha256(buffer: Buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function isSupportedImageContentType(contentType: string) {
  return SUPPORTED_IMAGE_CONTENT_TYPES.has(contentType.split(';')[0]?.trim().toLowerCase());
}

export function getImageFileExtension(contentType: string) {
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  if (contentType === 'image/gif') return 'gif';
  if (contentType === 'image/avif') return 'avif';
  return 'jpg';
}

export function assertS3HeadMatchesUpload(
  head: {
    ContentLength?: number;
    ContentType?: string;
    ChecksumSHA256?: string;
    Metadata?: Record<string, string>;
  },
  expected: { contentType: string; size: number; checksumSha256: string },
) {
  const checksumBase64 = Buffer.from(expected.checksumSha256, 'hex').toString('base64');

  if (
    head.ContentLength !== expected.size
    || head.ContentType?.split(';')[0]?.trim().toLowerCase() !== expected.contentType
    || head.Metadata?.sha256 !== expected.checksumSha256
    || (head.ChecksumSHA256 && head.ChecksumSHA256 !== checksumBase64)
  ) {
    throw new ImageStorageError('verify');
  }
}

export function getPublicObjectUrl(objectKey: string) {
  const key = normalizeObjectKey(objectKey);
  return `${getS3ImageStorageConfig().publicBaseUrl}/${encodeObjectPath(key)}`;
}

export function getS3ObjectKeyFromPublicUrl(imageUrl: string) {
  try {
    const base = new URL(`${getS3ImageStorageConfig().publicBaseUrl}/`);
    const url = new URL(imageUrl);
    const basePath = base.pathname.replace(/\/+$/, '');

    if (url.origin !== base.origin || !url.pathname.startsWith(`${basePath}/`)) {
      return null;
    }

    return decodeURIComponent(url.pathname.slice(basePath.length + 1));
  } catch {
    return null;
  }
}

export function getObjectKeyFromPublicUrl(imageUrl: string) {
  return getS3ObjectKeyFromPublicUrl(imageUrl)
    ?? getLegacySupabaseObjectKeyFromPublicUrl(imageUrl);
}

export function getCatalogImagesPrefix() {
  return getS3ImageStorageConfig().catalogImagesPrefix;
}

export function getProfileImagesPrefix() {
  return getS3ImageStorageConfig().profileImagesPrefix;
}

export async function verifyS3Object(params: {
  objectKey: string;
  contentType: string;
  size: number;
  checksumSha256: string;
}) {
  const config = getS3ImageStorageConfig();

  try {
    const result = await getClient().send(new HeadObjectCommand({
      Bucket: config.bucket,
      Key: normalizeObjectKey(params.objectKey),
      ChecksumMode: 'ENABLED',
    }));

    assertS3HeadMatchesUpload(result, params);
  } catch (error) {
    wrapStorageError('verify', error);
  }
}

export async function uploadPublicObject(params: {
  objectKey: string;
  buffer: Buffer;
  contentType: string;
  cacheControl?: string;
}) {
  const config = getS3ImageStorageConfig();
  const objectKey = normalizeObjectKey(params.objectKey);
  const checksumSha256 = calculateImageSha256(params.buffer);
  const checksumBase64 = Buffer.from(checksumSha256, 'hex').toString('base64');

  try {
    await getClient().send(new PutObjectCommand({
      Bucket: config.bucket,
      Key: objectKey,
      Body: params.buffer,
      ContentType: params.contentType,
      CacheControl: params.cacheControl ?? DEFAULT_CACHE_CONTROL,
      ChecksumSHA256: checksumBase64,
      Metadata: { sha256: checksumSha256 },
    }));
  } catch (error) {
    wrapStorageError('upload', error);
  }

  await verifyS3Object({
    objectKey,
    contentType: params.contentType,
    size: params.buffer.length,
    checksumSha256,
  });

  return {
    objectKey,
    publicUrl: getPublicObjectUrl(objectKey),
    contentSizeBytes: params.buffer.length,
    contentSha256: checksumSha256,
  };
}

export async function uploadProfileImage(params: {
  userId: number;
  buffer: Buffer;
  contentType: string;
}) {
  const extension = getImageFileExtension(params.contentType);
  const randomId = crypto.randomBytes(8).toString('hex');
  const objectKey = `${getProfileImagesPrefix()}/user-${params.userId}/${Date.now()}-${randomId}.${extension}`;
  return uploadPublicObject({
    objectKey,
    buffer: params.buffer,
    contentType: params.contentType,
  });
}

export async function deleteObjectByKey(objectKey: string) {
  const config = getS3ImageStorageConfig();

  try {
    await getClient().send(new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: normalizeObjectKey(objectKey),
    }));
  } catch (error) {
    wrapStorageError('delete', error);
  }
}

export async function deleteProfileImageByUrl(imageUrl: string | null | undefined) {
  if (!imageUrl) {
    return;
  }

  const s3ObjectKey = getS3ObjectKeyFromPublicUrl(imageUrl);

  if (s3ObjectKey) {
    await deleteObjectByKey(s3ObjectKey);
    return;
  }

  const legacyObjectKey = getLegacySupabaseObjectKeyFromPublicUrl(imageUrl);

  if (legacyObjectKey) {
    await deleteLegacySupabaseObjectByKey(legacyObjectKey);
  }
}

export function normalizeProfileImageUrl(imageUrl: string | null | undefined) {
  if (!imageUrl) {
    return null;
  }

  const s3ObjectKey = getS3ObjectKeyFromPublicUrl(imageUrl);

  if (s3ObjectKey) {
    return getPublicObjectUrl(s3ObjectKey);
  }

  return normalizeLegacyProfileImageUrl(imageUrl);
}

async function runImageStoragePreflight() {
  const token = crypto.randomBytes(24);
  const objectKey = `_health/image-sync-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.txt`;
  let uploadAttempted = false;
  let failed = false;

  try {
    uploadAttempted = true;
    const result = await uploadPublicObject({
      objectKey,
      buffer: token,
      contentType: 'text/plain',
      cacheControl: 'no-store, max-age=0',
    });
    const deadline = Date.now() + STORAGE_PREFLIGHT_TIMEOUT_MS;
    let lastError: unknown;

    while (Date.now() < deadline) {
      try {
        const response = await fetch(result.publicUrl, {
          method: 'GET',
          cache: 'no-store',
          signal: AbortSignal.timeout(Math.min(5_000, Math.max(1, deadline - Date.now()))),
        });

        if (response.ok && Buffer.from(await response.arrayBuffer()).equals(token)) {
          return;
        }

        lastError = new Error(`CloudFront preflight returned HTTP ${response.status}`);
      } catch (error) {
        lastError = error;
      }

      await new Promise((resolve) => setTimeout(resolve, 3_000));
    }

    throw new ImageStorageError('cdn-read', undefined, { cause: lastError });
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    if (uploadAttempted) {
      try {
        await deleteObjectByKey(objectKey);
      } catch (error) {
        if (!failed) {
          throw error;
        }

        console.error('Failed to delete image storage preflight object', error);
      }
    }
  }
}

export async function assertImageStorageReady(options: { force?: boolean } = {}) {
  if (!options.force && Date.now() - lastSuccessfulPreflightAt < STORAGE_PREFLIGHT_TTL_MS) {
    return;
  }

  if (!preflightPromise) {
    preflightPromise = runImageStoragePreflight()
      .then(() => {
        lastSuccessfulPreflightAt = Date.now();
      })
      .finally(() => {
        preflightPromise = null;
      });
  }

  return preflightPromise;
}
