import type { UserAnimeListItem, UserAnimeListResponse, UserAnimeListSort } from './collection'
import type { AnimeStatsItem } from './stats'

export type PublicUserProfile = {
  id: number
  username: string
  profileImageUrl?: string | null
  bio?: string | null
  animeListCount: number
  createdAt: string
  updatedAt: string
}

export type PublicUserProfileResponse = {
  success: boolean
  user: PublicUserProfile
}

export type PublicUserAnimeListResponse = UserAnimeListResponse & {
  user: PublicUserProfile
}

export type PublicUserAnimeStatsResponse = {
  success: boolean
  user: PublicUserProfile
  item: AnimeStatsItem
}

export type PublicUserAnimeListPage = {
  user: PublicUserProfile
  items: UserAnimeListItem[]
  pageInfo: PublicUserAnimeListResponse['pageInfo']
}

export type PublicUserAnimeStatsPage = {
  user: PublicUserProfile
  item: AnimeStatsItem
}

export type PublicUserAnimeListParams = {
  userId: string
  sort: UserAnimeListSort
  limit: number
  genre?: string | null
  cursor?: string | null
  signal?: AbortSignal
}
