import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import crypto from 'crypto';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL;
const R2_PROFILE_IMAGES_PREFIX = process.env.R2_PROFILE_IMAGES_PREFIX || 'profile-images';
const R2_ENDPOINT = process.env.R2_ENDPOINT || (R2_ACCOUNT_ID ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : undefined);

function requireEnv(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function getR2Client() {
  return new S3Client({
    region: 'auto',
    endpoint: requireEnv(R2_ENDPOINT, 'R2_ENDPOINT'),
    credentials: {
      accessKeyId: requireEnv(R2_ACCESS_KEY_ID, 'R2_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv(R2_SECRET_ACCESS_KEY, 'R2_SECRET_ACCESS_KEY'),
    },
  });
}

function getBucketName() {
  return requireEnv(R2_BUCKET_NAME, 'R2_BUCKET_NAME');
}

function getPublicBaseUrl() {
  return requireEnv(R2_PUBLIC_BASE_URL, 'R2_PUBLIC_BASE_URL').replace(/\/+$/, '');
}

function getFileExtension(contentType: string) {
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  if (contentType === 'image/gif') return 'gif';
  return 'jpg';
}

export async function uploadProfileImage(params: {
  userId: number;
  buffer: Buffer;
  contentType: string;
}) {
  const client = getR2Client();
  const bucket = getBucketName();
  const extension = getFileExtension(params.contentType);
  const randomId = crypto.randomBytes(8).toString('hex');
  const objectKey = `${R2_PROFILE_IMAGES_PREFIX}/user-${params.userId}/${Date.now()}-${randomId}.${extension}`;

  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    Body: params.buffer,
    ContentType: params.contentType,
  }));

  return {
    objectKey,
    publicUrl: `${getPublicBaseUrl()}/${objectKey}`,
  };
}

export async function deleteObjectByKey(objectKey: string) {
  const client = getR2Client();
  const bucket = getBucketName();

  await client.send(new DeleteObjectCommand({
    Bucket: bucket,
    Key: objectKey,
  }));
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
    return null;
  }

  return imageUrl.slice(publicBaseUrl.length + 1);
}
