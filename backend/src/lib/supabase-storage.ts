import crypto from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET;
const SUPABASE_STORAGE_PUBLIC_BASE_URL = process.env.SUPABASE_STORAGE_PUBLIC_BASE_URL;
const SUPABASE_PROFILE_IMAGES_PREFIX = process.env.SUPABASE_PROFILE_IMAGES_PREFIX || 'profile-images';

function requireEnv(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function getSupabaseUrl() {
  const rawUrl = requireEnv(SUPABASE_URL, 'SUPABASE_URL').replace(/\/+$/, '');

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
  return requireEnv(SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY');
}

function getBucketName() {
  return requireEnv(SUPABASE_STORAGE_BUCKET, 'SUPABASE_STORAGE_BUCKET');
}

function getPublicBaseUrl() {
  if (SUPABASE_STORAGE_PUBLIC_BASE_URL) {
    const rawUrl = SUPABASE_STORAGE_PUBLIC_BASE_URL.replace(/\/+$/, '');

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

  const message = await response.text().catch(() => '');
  throw new Error(`Supabase Storage ${action} failed: ${response.status}${message ? ` ${message}` : ''}`);
}

export async function uploadProfileImage(params: {
  userId: number;
  buffer: Buffer;
  contentType: string;
}) {
  const bucket = getBucketName();
  const extension = getFileExtension(params.contentType);
  const randomId = crypto.randomBytes(8).toString('hex');
  const objectKey = `${SUPABASE_PROFILE_IMAGES_PREFIX}/user-${params.userId}/${Date.now()}-${randomId}.${extension}`;
  const uploadUrl = `${getSupabaseUrl()}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeObjectPath(objectKey)}`;

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      ...getStorageHeaders(params.contentType),
      'x-upsert': 'false',
    },
    body: params.buffer,
  });

  await assertStorageResponse(response, 'upload');

  return {
    objectKey,
    publicUrl: getProfileImagePublicUrl(objectKey),
  };
}

export async function deleteObjectByKey(objectKey: string) {
  const bucket = getBucketName();
  const response = await fetch(`${getSupabaseUrl()}/storage/v1/object/${encodeURIComponent(bucket)}`, {
    method: 'DELETE',
    headers: {
      ...getStorageHeaders('application/json'),
    },
    body: JSON.stringify({
      prefixes: [objectKey],
    }),
  });

  await assertStorageResponse(response, 'delete');
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
