const ANILIST_IMAGE_HOST = 's4.anilist.co';

export function isAniListImageUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.hostname.toLowerCase() === ANILIST_IMAGE_HOST;
  } catch {
    return false;
  }
}

export function validateAniListImageSourceUrl(value: string) {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error('Catalog image source URL must be a valid URL');
  }

  if (
    url.protocol !== 'https:'
    || url.hostname.toLowerCase() !== ANILIST_IMAGE_HOST
    || url.username
    || url.password
  ) {
    throw new Error('Catalog image source host is not allowed');
  }

  return url;
}

export function stripAniListImageUrls<T>(value: T): T {
  if (isAniListImageUrl(value)) {
    return null as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => stripAniListImageUrls(item)) as T;
  }

  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const result: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      result[key] = stripAniListImageUrls(item);
    }

    return result as T;
  }

  return value;
}
