export type UserAnimeStatus =
  | 'planned'
  | 'watching'
  | 'completed'
  | 'paused'
  | 'dropped'

export type UserAnimeListPayload = {
  animeId: number
  status?: UserAnimeStatus
  score?: number
  progress?: number
  startedAt?: string | null
  completedAt?: string | null
  notes?: string
}

export type UserAnimeListEntry = {
  animeId: number
  status: UserAnimeStatus
  score?: number | null
  progress?: number | null
  startedAt?: string | null
  completedAt?: string | null
  notes?: string | null
}

export type UserAnimeListSort = 'latest' | 'added' | 'score' | 'scoreAsc'

export type UserAnimeListItem = {
  id: number
  userId: number
  animeId: number
  status: UserAnimeStatus
  score?: number | null
  progress?: number | null
  startedAt?: string | null
  completedAt?: string | null
  notes?: string | null
  createdAt: string
  updatedAt: string
  anime: {
    id: number
    anilistId: number
    title: string
    titles?: {
      korean?: string | null
      english?: string | null
      native?: string | null
      romaji?: string | null
      userPreferred?: string | null
    }
    episodes?: number | null
    duration?: number | null
    season?: string | null
    seasonYear?: number | null
    format?: string | null
    status?: string | null
    averageScore?: number | null
    meanScore?: number | null
    popularity?: number | null
    favourites?: number | null
    coverImageLarge: string
    coverImageExtraLarge?: string | null
    bannerImage?: string | null
    siteUrl?: string | null
    isAdult?: boolean
  }
}

export type UserAnimeListResponse = {
  success: boolean
  items: UserAnimeListItem[]
  pageInfo: {
    hasNext: boolean
    nextCursor: string | null
    limit: number
    sort: UserAnimeListSort
    titleLanguage: 'ko' | 'en' | 'ja'
  }
}

export type UserAnimeListEntryResponse = {
  success: boolean
  item: UserAnimeListItem
}
