import type { SyntheticEvent } from 'react'

export const DEFAULT_PROFILE_IMAGE_SRC = '/default-profile.jpeg'

export function getProfileImageSrc(src?: string | null) {
  return src?.trim() || DEFAULT_PROFILE_IMAGE_SRC
}

export function handleProfileImageError(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget

  if (image.src.endsWith(DEFAULT_PROFILE_IMAGE_SRC)) {
    return
  }

  image.src = DEFAULT_PROFILE_IMAGE_SRC
}

