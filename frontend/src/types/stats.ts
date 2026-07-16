export type TopGenreAnimeItem = {
  animeId: number
  title: string
  coverImageLarge: string | null
  score: number | null
  genre: string
}

export type UserSeriesStats = {
  scope: 'mainline'
  startedSeriesCount: number
  watchedSeriesCount: number
  completedSeriesCount: number
  seriesCompletionRate: number
}

export type AnimeStatsItem = {
  userId: number
  totalCount: number
  completedCount: number
  watchingCount: number
  droppedCount: number
  totalWatchedEpisodes: number
  totalWatchMinutes: number
  avgScore: number | null
  favoriteGenre: string | null
  favoriteReleasePeriod: string | null
  genreDistribution: Record<string, number>
  genreWatchMinutes: Record<string, number>
  genreAvgScore: Record<string, number>
  releaseYearDistribution: Record<string, number>
  avgReleaseYear: number | null
  scoreDistribution: Record<string, number>
  topWatchedGenreTopAnime: TopGenreAnimeItem[]
  topRatedGenreTopAnime: TopGenreAnimeItem[]
  seriesStats: UserSeriesStats
  preferenceSummary: string | null
  recommendationContext: string | null
  updatedAt: string | null
}

export type AnimeStatsResponse = {
  success: boolean
  item: AnimeStatsItem
}

export type ViewingDnaAxisKey =
  | 'completion'
  | 'seriesCompletion'
  | 'genreExploration'
  | 'eraExploration'
  | 'ratingActivity'
  | 'watchImmersion'

export type ViewingDnaAxis = {
  key: ViewingDnaAxisKey
  label: string
  score: number
  available: boolean
  description: string
  raw: Record<string, number>
}

export type ViewingDnaItem = {
  userId: number
  methodologyVersion: number
  confidence: 'none' | 'low' | 'medium' | 'high'
  scale: {
    min: 0
    max: 100
  }
  axes: ViewingDnaAxis[]
  strongestAxis: ViewingDnaAxisKey | null
  raw: {
    totalAnimeCount: number
    startedAnimeCount: number
  }
  calculatedAt: string
}

export type ViewingDnaResponse = {
  success: boolean
  item: ViewingDnaItem
}

export type GenreBubbleTopAnime = {
  animeId?: number
  id?: number
  title: string
  score?: number | null
  coverImageLarge?: string | null
}

export type GenreBubbleItem = {
  genre: string
  animeCount: number
  weightedAnimeCount: number
  myAverageScore: number
  communityAverageScore: number
  preferenceScore: number
  totalWatchMinutes: number
  totalWatchHours: number
  averageReleaseYear: number | null
  bubbleSize: number
  topRatedAnime: GenreBubbleTopAnime[]
}

export type GenreBubbleResponse = {
  success: boolean
  item: {
    userId: number
    weighting: 'fractional' | 'full'
    communityScore: 'average' | 'mean'
    status: 'completed' | 'all'
    minCount: number
    items: GenreBubbleItem[]
    axis: {
      x: {
        field: string
        min: number
        max: number
      }
      y: {
        field: string
        min: number
        max: number
      }
    }
  }
}

export type YearlyScoreStatsItem = {
  year: number
  animeCount: number
  ratedAnimeCount: number
  averageScore: number | null
  communityAverageScore: number | null
  preferenceDelta: number | null
}

export type YearlyScoreStats = {
  userId: number
  status: 'completed' | 'all'
  minRatedAnimeCount: number
  items: YearlyScoreStatsItem[]
  summary: {
    yearCount: number
    bestYear: number | null
    worstYear: number | null
    averageScore: number | null
  }
}

export type YearlyScoreStatsResponse = {
  success: boolean
  item: YearlyScoreStats
}

export type FormatDistributionItem = {
  format: string
  label: string
  animeCount: number
  percentage: number
  ratedAnimeCount: number
  averageScore: number | null
  watchedEpisodes: number
  watchMinutes: number
  watchHours: number | null
}

export type FormatDistributionStats = {
  userId: number
  status: 'completed' | 'all'
  minCount: number
  totalAnimeCount: number
  totalWatchMinutes: number
  totalWatchHours: number | null
  items: FormatDistributionItem[]
  summary: {
    formatCount: number
    topFormat: string | null
    topFormatLabel: string | null
  }
}

export type FormatDistributionResponse = {
  success: boolean
  item: FormatDistributionStats
}

export type VoiceActorRankingSort = 'count' | 'score'

export type VoiceActorPersonName = {
  full?: string | null
  native?: string | null
  userPreferred?: string | null
}

export type VoiceActorImage = {
  large?: string | null
  medium?: string | null
}

export type VoiceActorRankingItem = {
  voiceActor: {
    id: number
    name: VoiceActorPersonName
    image: VoiceActorImage
  }
  animeCount: number
  characterCount: number
  ratedAnimeCount: number
  scoreSum: number
  averageScore: number | null
}

export type VoiceActorRankingResponse = {
  success: boolean
  items: VoiceActorRankingItem[]
}

export type VoiceActorAnimeItem = {
  anime: {
    id: number
    title: string
    coverImageLarge?: string | null
    coverImageExtraLarge?: string | null
    seasonYear?: number | null
    format?: string | null
    averageScore?: number | null
  }
  userList: {
    status?: string | null
    score?: number | null
    progress?: number | null
  } | null
  characters: Array<{
    id: number
    role?: string | null
    name: VoiceActorPersonName
    image: VoiceActorImage
  }>
}

export type VoiceActorAnimeResponse = {
  success: boolean
  voiceActor: {
    id: number
    name: VoiceActorPersonName
    image: VoiceActorImage
  }
  items: VoiceActorAnimeItem[]
  pageInfo: {
    limit: number
    titleLanguage: 'ko' | 'en' | 'ja'
    status: 'all' | 'completed'
    hasNext: boolean
    nextCursor: string | null
  }
}

export type StudioRankingSort = 'count' | 'score' | 'watchTime'

export type AnimeStudio = {
  id: number
  anilistId: number
  name: string
  isAnimationStudio: boolean
  siteUrl: string | null
}

export type StudioRankingItem = {
  studio: AnimeStudio
  animeCount: number
  completedAnimeCount: number
  ratedAnimeCount: number
  scoreSum: number | null
  averageScore: number | null
  communityAverageScore: number | null
  totalWatchedEpisodes: number
  totalWatchMinutes: number
  totalWatchHours: number | null
  firstReleaseYear: number | null
  latestReleaseYear: number | null
}

export type StudioRankingResponse = {
  success: boolean
  items: StudioRankingItem[]
  pageInfo: {
    limit: number
    sort: StudioRankingSort
    status: 'completed' | 'all'
    mainOnly: boolean
    minAnimeCount: number
    minRatedAnimeCount: number
    hasNext: boolean
    nextCursor: string | null
  }
  summary: {
    studioCount: number
    source: {
      status: 'completed' | 'all'
      mainOnly: boolean
    }
  }
}

export type StudioAnimeItem = {
  anime: {
    id: number
    anilistId: number
    title: string | null
    titles: {
      korean: string | null
      english: string | null
      native: string | null
      romaji: string | null
      userPreferred: string | null
    }
    coverImageLarge: string | null
    coverImageExtraLarge: string | null
    bannerImage: string | null
    seasonYear: number | null
    format: string | null
    status: string | null
    episodes: number | null
    duration: number | null
    averageScore: number | null
    popularity?: number | null
  }
  userList: {
    status: string
    score: number | null
    progress: number
    updatedAt: string
  }
  studioRelation: {
    isMain: boolean
  }
}

export type StudioAnimeResponse = {
  success: boolean
  studio: AnimeStudio
  items: StudioAnimeItem[]
  pageInfo: {
    limit: number
    titleLanguage: 'ko' | 'en' | 'ja'
    status: 'completed' | 'all'
    mainOnly: boolean
    hasNext: boolean
    nextCursor: string | null
  }
}
