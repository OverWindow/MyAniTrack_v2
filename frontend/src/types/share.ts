export type ShareResourceType = 'COLLECTION' | 'ANALYSIS'
export type ShareExpiryDays = 1 | 7 | 30 | null

export type ManagedShare = {
  resourceType: ShareResourceType
  url: string
  expiresAt: string | null
  revoked: boolean
  expired: boolean
}

export type ShareOwner = {
  username: string
  profileImageUrl: string | null
  bio: string | null
  animeListCount: number
}

export type ShareDescriptor = {
  resourceType: ShareResourceType
  expiresAt: string | null
  owner: ShareOwner
}
