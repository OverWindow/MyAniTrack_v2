import dotenv from 'dotenv';

dotenv.config();

function requireEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

export interface SupabaseStorageConfig {
  url: string;
  serviceRoleKey: string;
  bucket: string;
  publicBaseUrl?: string;
  profileImagesPrefix: string;
  catalogImagesPrefix: string;
}

export interface S3ImageStorageConfig {
  provider: 's3';
  region: string;
  bucket: string;
  publicBaseUrl: string;
  profileImagesPrefix: string;
  catalogImagesPrefix: string;
}

export function getSupabaseStorageConfig(): SupabaseStorageConfig {
  return {
    url: requireEnv('SUPABASE_URL'),
    serviceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    bucket: requireEnv('SUPABASE_STORAGE_BUCKET'),
    publicBaseUrl: process.env.SUPABASE_STORAGE_PUBLIC_BASE_URL?.trim() || undefined,
    profileImagesPrefix:
      process.env.SUPABASE_PROFILE_IMAGES_PREFIX?.trim() || 'profile-images',
    catalogImagesPrefix:
      process.env.SUPABASE_CATALOG_IMAGES_PREFIX?.trim() || 'catalog-images',
  };
}

export function validateSupabaseStorageEnv() {
  getSupabaseStorageConfig();
}

export function getS3ImageStorageConfig(): S3ImageStorageConfig {
  const provider = requireEnv('IMAGE_STORAGE_PROVIDER').toLowerCase();

  if (provider !== 's3') {
    throw new Error('IMAGE_STORAGE_PROVIDER must be s3');
  }

  const publicBaseUrl = requireEnv('IMAGE_CDN_BASE_URL').replace(/\/+$/, '');

  try {
    const url = new URL(publicBaseUrl);

    if (url.protocol !== 'https:' || url.username || url.password) {
      throw new Error();
    }
  } catch {
    throw new Error('IMAGE_CDN_BASE_URL must be a valid HTTPS URL');
  }

  return {
    provider: 's3',
    region: requireEnv('AWS_REGION'),
    bucket: requireEnv('AWS_S3_BUCKET'),
    publicBaseUrl,
    profileImagesPrefix:
      process.env.IMAGE_PROFILE_IMAGES_PREFIX?.trim()
      || process.env.SUPABASE_PROFILE_IMAGES_PREFIX?.trim()
      || 'profile-images',
    catalogImagesPrefix:
      process.env.IMAGE_CATALOG_IMAGES_PREFIX?.trim()
      || process.env.SUPABASE_CATALOG_IMAGES_PREFIX?.trim()
      || 'catalog-images',
  };
}

export function validateImageStorageEnv() {
  getS3ImageStorageConfig();
}
