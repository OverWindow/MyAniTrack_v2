export type TopGenreAnimeItem = {
  animeId: number
  title: string
  coverImageLarge: string | null
  score: number | null
  genre: string
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
  preferenceSummary: string | null
  recommendationContext: string | null
  updatedAt: string | null
}

export type AnimeStatsResponse = {
  success: boolean
  item: AnimeStatsItem
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
  pageInfo?: {
    hasNext?: boolean
    nextCursor?: string | null
  }
}
