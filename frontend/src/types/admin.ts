export type AdminSyncPagePayload = {
  page: number
  perPage: number
}

export type AdminSyncAllPayload = {
  startPage: number
  perPage: number
  maxPages: number
}

export type AdminRelationSyncMode = 'missing' | 'all'

export type AdminRelationSyncPayload = {
  mode: AdminRelationSyncMode
  limit: number
  batchSize: number
  retryFailed?: boolean
  afterAnimeId?: number
}

export type AdminSeriesRebuildScope = 'all' | 'mainline' | 'franchise'

export type AdminSeriesRebuildPayload = {
  scope: AdminSeriesRebuildScope
}

export type AdminSeriesRebuildSummary = {
  scope: Exclude<AdminSeriesRebuildScope, 'all'>
  seriesCount: number
  memberCount: number
  updatedAt: string
}

export type AdminSeriesRebuildResult = {
  scope: AdminSeriesRebuildScope
  rebuiltScopes: Array<Exclude<AdminSeriesRebuildScope, 'all'>>
  durationMs: number
  summaries: AdminSeriesRebuildSummary[]
}

export type AdminSeriesRebuildResponse = {
  success: boolean
  message: string
  result: AdminSeriesRebuildResult
}

export type AdminSyncChunkedPayload = {
  startPage: number
  perPage: number
  pagesPerChunk: number
  chunkDelayMs: number
  maxChunks: number
}

export type AdminFullSyncPayload = {
  startPage: number
  perPage: number
  maxPages?: number
  language: AdminCastLanguage
  castPerPage: number
  animeDelayMs: number
}

export type AdminSeason = 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL'

export type AdminSyncSeasonPayload = {
  season: AdminSeason
  seasonYear: number
  startPage: number
  perPage: number
  maxPages: number
  syncCast: boolean
  language: AdminCastLanguage
  castPerPage: number
  animeDelayMs: number
}

export type AdminTranslateKoreanTitlesPayload = {
  batchSize: number
  maxBatches: number
}

export type AdminCastLanguage = 'JAPANESE' | 'ENGLISH' | 'KOREAN'

export type AdminCastSyncAnimePayload = {
  animeId: number
  language: AdminCastLanguage
  perPage: number
}

export type AdminCastSyncBatchPayload = {
  limit: number
  language: AdminCastLanguage
  perPage: number
  onlyMissing: boolean
  retryFailed: boolean
  delayMs: number
}

export type AdminCastSyncChunkedPayload = {
  totalLimit: number
  chunkSize: number
  maxChunks: number
  chunkDelayMs: number
  language: AdminCastLanguage
  perPage: number
  onlyMissing: boolean
  retryFailed: boolean
  delayMs: number
}

export type AdminCastSyncStatusPayload = {
  animeId: number
}

export type AdminStudioSyncMissingPayload = {
  limit: number
  batchSize: number
  retryFailed: boolean
  delayMs: number
}

export type AdminStudioSyncMissingResult = {
  selectedAnimeCount: number
  processedAnimeCount: number
  syncedAnimeCount: number
  failedAnimeCount: number
  failed?: Array<{ anilistId: number; message: string }>
  retryFailed: boolean
  limit: number
  batchSize: number
  delayMs: number
  hasMore: boolean
}

export type AdminUpdateKoreanTitlePayload = {
  title: string
  subtitle?: string
}

export type AdminKoreanTitleItem = {
  id: number
  animeId: number
  title: string
  subtitle: string | null
  fullTitle: string
  isPrimary: boolean
  isLocked: boolean
  lockedAt: string | null
  lockedBy: number | null
  source: string
  createdAt: string
  updatedAt: string
}

export type AdminUpdateKoreanTitleResponse = {
  success: boolean
  message: string
  item: AdminKoreanTitleItem
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
  translationProgressRate: number
  castSyncedAnimeCount: number
  castSyncProgressRate: number
  studioCount: number
  studioSyncedAnimeCount: number
  studioMappedAnimeCount: number
  studioPendingAnimeCount: number
  studioFailedAnimeCount: number
  studioSyncProgressRate: number
  relationSyncedAnimeCount?: number
  relationPendingAnimeCount?: number
  relationSyncingAnimeCount?: number
  relationFailedAnimeCount?: number
  animeRelationCount?: number
  relationSyncProgressRate?: number
  characterCount: number
  voiceActorCount: number
}

export type AdminUserRole = 'USER' | 'ADMIN'
export type AdminUserRoleFilter = 'ALL' | AdminUserRole

export type AdminUserListItem = {
  id: number
  email: string
  username: string
  role: AdminUserRole
  profileImageUrl: string | null
  emailVerified: boolean
  emailVerifiedAt: string | null
  supabaseLinked: boolean
  animeListCount: number
  completedCount: number
  activeSessionCount: number
  createdAt: string
  updatedAt: string
}

export type AdminUserListResponse = {
  success: boolean
  items: AdminUserListItem[]
  pageInfo: {
    page: number
    limit: number
    totalItems: number
    totalPages: number
    hasPrevious: boolean
    hasNext: boolean
  }
  filters: {
    search: string
    role: AdminUserRoleFilter
  }
}

export type AdminUserDetail = AdminUserListItem & {
  bio: string | null
  collection: {
    totalCount: number
    plannedCount: number
    watchingCount: number
    completedCount: number
    pausedCount: number
    droppedCount: number
    totalWatchedEpisodes: number
    totalWatchMinutes: number
    averageScore: number | null
    favoriteGenre: string | null
    favoriteReleasePeriod: string | null
    statsUpdatedAt: string | null
  }
}

export type AdminUserDetailResponse = {
  success: boolean
  item: AdminUserDetail
}
