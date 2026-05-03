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
  preferenceSummary: string | null
  recommendationContext: string | null
  updatedAt: string | null
}

export type AnimeStatsResponse = {
  success: boolean
  item: AnimeStatsItem
}
