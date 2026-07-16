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
  item: UserAnimeListItem | null
}

export type AnimeSeriesScope = 'mainline' | 'franchise'
export type UserSeriesCollectionStatus = 'all' | 'started' | 'watched' | 'completed'

export type UserSeriesCollectionMember = {
  anime: {
    id: number
    anilistId: number
    title: string
    titles: {
      korean: string | null
      english: string | null
      native: string | null
      romaji: string | null
      userPreferred: string | null
    }
    season: string | null
    seasonYear: number | null
    format: string | null
    status: string | null
    coverImageLarge: string | null
    coverImageExtraLarge: string | null
  }
  userList: {
    id: number
    status: UserAnimeStatus
    score: number | null
    progress: number | null
    updatedAt: string | null
  } | null
}

export type UserSeriesCollectionItem = {
  seriesId: number
  scope: AnimeSeriesScope
  title: string | null
  customTitle: string | null
  canonicalAnimeId: number | null
  memberCount: number
  collectedMemberCount: number
  startedMemberCount: number
  completedMemberCount: number
  completionRate: number
  completed: boolean
  lastActivityAt: string
  coverImageLarge: string | null
  coverImageExtraLarge: string | null
  items: UserSeriesCollectionMember[]
}

export type UserSeriesCollectionResponse = {
  success: boolean
  items: UserSeriesCollectionItem[]
  pageInfo: {
    hasNext: boolean
    nextCursor: string | null
    limit: number
    scope: AnimeSeriesScope
    status: UserSeriesCollectionStatus
    titleLanguage: 'ko' | 'en' | 'ja'
    query: string | null
  }
}

export type SmartRatingRelation = 'better' | 'similar' | 'worse'

export type SmartRatingCandidate = {
  animeId: number
  score: number
  anime: {
    id: number
    anilistId: number
    title: string
    coverImageLarge: string | null
    coverImageExtraLarge?: string | null
  }
}

export type SmartRatingCandidatesResponse = {
  success: boolean
  targetAnimeId: number
  items: SmartRatingCandidate[]
}

export type SmartRatingEstimateComparison = {
  animeId: number
  relation: SmartRatingRelation
  score: number
}

export type SmartRatingEstimateResponse = {
  success: boolean
  targetAnimeId: number
  estimatedScore: number
  confidence: 'low' | 'medium' | 'high' | string
  range: {
    min: number
    max: number
  }
  comparisons: SmartRatingEstimateComparison[]
  reason: string
}
