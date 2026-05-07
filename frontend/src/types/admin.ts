export type AdminSyncPagePayload = {
  page: number
  perPage: number
}

export type AdminSyncAllPayload = {
  startPage: number
  perPage: number
  maxPages: number
}

export type AdminSyncChunkedPayload = {
  startPage: number
  perPage: number
  pagesPerChunk: number
  chunkDelayMs: number
  maxChunks: number
}

export type AdminSeason = 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL'

export type AdminSyncSeasonPayload = {
  season: AdminSeason
  seasonYear: number
  startPage: number
  perPage: number
  maxPages: number
}

export type AdminTranslateKoreanTitlesPayload = {
  batchSize: number
  maxBatches: number
}

export type AdminActionResponse = {
  success: boolean
  message: string
  result: Record<string, unknown>
}

export type PlatformStats = {
  registeredUserCount: number
  storedAnimeCount: number
  translatedKoreanTitleCount: number
}
