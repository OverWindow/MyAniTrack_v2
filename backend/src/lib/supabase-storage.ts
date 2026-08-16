import crypto from 'crypto';
import { getSupabaseStorageConfig } from '../config/env';

const STORAGE_TIMEOUT_MS = 15_000;

export class SupabaseStorageError extends Error {
  public readonly cause?: unknown;

  constructor(
    public readonly action: 'upload' | 'delete',
    public readonly storageStatus?: number,
    options?: { cause?: unknown },
  ) {
    super(`Supabase Storage ${action} failed`);
    this.name = 'SupabaseStorageError';
    this.cause = options?.cause;
  }
}

function getSupabaseUrl() {
  const rawUrl = getSupabaseStorageConfig().url.replace(/\/+$/, '');

  try {
    const url = new URL(rawUrl);

    if (url.hostname.endsWith('.storage.supabase.co')) {
      url.hostname = url.hostname.replace('.storage.supabase.co', '.supabase.co');
    }

    url.pathname = url.pathname
      .replace(/\/storage\/v1\/s3\/?$/, '')
      .replace(/\/storage\/v1\/?$/, '')
      .replace(/\/+$/, '');
    url.search = '';
    url.hash = '';

    return url.toString().replace(/\/+$/, '');
  } catch {
    throw new Error('SUPABASE_URL must be a valid Supabase project URL');
  }
}

function encodeObjectPath(objectKey: string) {
  return objectKey.split('/').map(encodeURIComponent).join('/');
}

function getServiceRoleKey() {
  return getSupabaseStorageConfig().serviceRoleKey;
}

function getBucketName() {
  return getSupabaseStorageConfig().bucket;
}

function getPublicBaseUrl() {
  const configuredPublicBaseUrl = getSupabaseStorageConfig().publicBaseUrl;

  if (configuredPublicBaseUrl) {
    const rawUrl = configuredPublicBaseUrl.replace(/\/+$/, '');

    try {
      const url = new URL(rawUrl);

      if (
        url.hostname.endsWith('.supabase.co') ||
        url.hostname.endsWith('.storage.supabase.co')
      ) {
        return `${getSupabaseUrl()}/storage/v1/object/public/${encodeURIComponent(getBucketName())}`;
      }

      return rawUrl;
    } catch {
      return rawUrl;
    }
  }

  return `${getSupabaseUrl()}/storage/v1/object/public/${encodeURIComponent(getBucketName())}`;
}

function getStorageHeaders(contentType?: string) {
  const serviceRoleKey = getServiceRoleKey();

  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    ...(contentType ? { 'Content-Type': contentType } : {}),
  };
}

function getFileExtension(contentType: string) {
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  if (contentType === 'image/gif') return 'gif';
  return 'jpg';
}

async function assertStorageResponse(response: Response, action: string) {
  if (response.ok) {
    return;
  }

  await response.body?.cancel().catch(() => undefined);
  throw new SupabaseStorageError(action as 'upload' | 'delete', response.status);
}

async function storageFetch(
  action: 'upload' | 'delete',
  url: string,
  init: RequestInit,
) {
  try {
    const response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(STORAGE_TIMEOUT_MS),
    });
    await assertStorageResponse(response, action);
    return response;
  } catch (error) {
    if (error instanceof SupabaseStorageError) {
      throw error;
    }

    throw new SupabaseStorageError(action, undefined, { cause: error });
  }
}

export async function uploadProfileImage(params: {
  userId: number;
  buffer: Buffer;
  contentType: string;
}) {
  const bucket = getBucketName();
  const extension = getFileExtension(params.contentType);
  const randomId = crypto.randomBytes(8).toString('hex');
  const prefix = getSupabaseStorageConfig().profileImagesPrefix;
  const objectKey = `${prefix}/user-${params.userId}/${Date.now()}-${randomId}.${extension}`;
  const uploadUrl = `${getSupabaseUrl()}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeObjectPath(objectKey)}`;

  await storageFetch('upload', uploadUrl, {
    method: 'POST',
    headers: {
      ...getStorageHeaders(params.contentType),
      'x-upsert': 'false',
    },
    body: params.buffer,
  });

  return {
    objectKey,
    publicUrl: getProfileImagePublicUrl(objectKey),
  };
}

export async function deleteObjectByKey(objectKey: string) {
  const bucket = getBucketName();
  await storageFetch('delete', `${getSupabaseUrl()}/storage/v1/object/${encodeURIComponent(bucket)}`, {
    method: 'DELETE',
    headers: {
      ...getStorageHeaders('application/json'),
    },
    body: JSON.stringify({
      prefixes: [objectKey],
    }),
  });
}

export async function deleteProfileImageByUrl(imageUrl: string | null | undefined) {
  if (!imageUrl) {
    return;
  }

  const objectKey = getObjectKeyFromPublicUrl(imageUrl);

  if (!objectKey) {
    return;
  }

  await deleteObjectByKey(objectKey);
}

export function getObjectKeyFromPublicUrl(imageUrl: string) {
  const publicBaseUrl = getPublicBaseUrl();

  if (!imageUrl.startsWith(`${publicBaseUrl}/`)) {
    return getObjectKeyFromSupabaseUrl(imageUrl);
  }

  return decodeURIComponent(imageUrl.slice(publicBaseUrl.length + 1));
}

export function getProfileImagePublicUrl(objectKey: string) {
  return `${getPublicBaseUrl()}/${encodeObjectPath(objectKey)}`;
}

export function normalizeProfileImageUrl(imageUrl: string | null | undefined) {
  if (!imageUrl) {
    return null;
  }

  const objectKey = getObjectKeyFromPublicUrl(imageUrl);

  if (!objectKey) {
    return imageUrl;
  }

  return getProfileImagePublicUrl(objectKey);
}

function getObjectKeyFromSupabaseUrl(imageUrl: string) {
  try {
    const url = new URL(imageUrl);
    const bucket = getBucketName();
    const bucketMarker = `/${bucket}/`;
    const decodedPathname = decodeURIComponent(url.pathname);
    const bucketIndex = decodedPathname.indexOf(bucketMarker);

    if (bucketIndex === -1) {
      return null;
    }

    return decodedPathname.slice(bucketIndex + bucketMarker.length);
  } catch {
    return null;
  }
}
