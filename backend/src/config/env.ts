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
}

export function getSupabaseStorageConfig(): SupabaseStorageConfig {
  return {
    url: requireEnv('SUPABASE_URL'),
    serviceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    bucket: requireEnv('SUPABASE_STORAGE_BUCKET'),
    publicBaseUrl: process.env.SUPABASE_STORAGE_PUBLIC_BASE_URL?.trim() || undefined,
    profileImagesPrefix:
      process.env.SUPABASE_PROFILE_IMAGES_PREFIX?.trim() || 'profile-images',
  };
}

export function validateSupabaseStorageEnv() {
  getSupabaseStorageConfig();
}
