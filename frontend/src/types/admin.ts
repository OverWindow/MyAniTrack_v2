export type AdminSeriesRebuildScope = 'all' | 'mainline' | 'franchise'
export type AdminSeriesRebuildPayload = { scope: AdminSeriesRebuildScope }
export type AdminSeriesRebuildResponse = {
  success: boolean
  message: string
  result: { scope: AdminSeriesRebuildScope; rebuiltScopes: Array<'mainline' | 'franchise'>; durationMs: number; summaries: Array<{ scope: 'mainline' | 'franchise'; seriesCount: number; memberCount: number; updatedAt: string }> }
}
export type AdminUpdateKoreanTitlePayload = { title: string; subtitle?: string }
export type AdminUpdateKoreanTitleResponse = {
  success: boolean; message: string
  item: { id: number; animeId: number; title: string; subtitle: string | null; fullTitle: string; isPrimary: boolean; isLocked: boolean; lockedAt: string | null; lockedBy: number | null; source: string; createdAt: string; updatedAt: string }
}

export type CatalogEntityType = 'ANIME' | 'CHARACTER' | 'VOICE_ACTOR' | 'STUDIO'
export type CatalogChangeSource = 'USER' | 'AI'
export type CatalogChangeStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN'
export type CatalogChangeKind = 'CREATE_ENTITY' | 'UPDATE_ENTITY' | 'LINK_TO_ANIME'
export type CatalogSearchItem = { id: number; type: CatalogEntityType; displayName: string; subtitle: string | null; imageUrl: string | null }
export type CatalogTaxonomyOption = { value: string; usageCount: number }
export type CatalogTaxonomy = { genres: CatalogTaxonomyOption[]; tags: CatalogTaxonomyOption[] }
export type CatalogTagSelection = { name: string; rank: number | null; isSpoiler: boolean }
export type CatalogEntityDetail = {
  id: number
  type: CatalogEntityType
  displayName: string
  updatedAt: string
  payload: Record<string, unknown>
  images: { coverLarge?: string | null; coverExtraLarge?: string | null; banner?: string | null; large?: string | null; medium?: string | null }
}
export type CatalogConfidence = {
  overall: number; basic: number; airing: number; studios: number; characters: number; voiceActors: number; relations: number
}
export type CatalogSubmission = {
  id: number; source: CatalogChangeSource; kind: CatalogChangeKind; entityType: CatalogEntityType
  targetEntityId: number | null; submittedByUserId: number | null; submitterUsername: string | null
  status: CatalogChangeStatus; displayName: string; sourceUrl: string; description: string
  payload: Record<string, unknown>; confidence: CatalogConfidence | null; warnings: string[]
  rejectionReason: string | null; approvedEntityId: number | null
  duplicateResolution: 'USE_EXISTING' | 'CREATE_NEW' | null; createdAt: string; updatedAt: string
}
export type CatalogDiscoveryRun = {
  id: number; seasonYear: number; season: 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL'
  phase: 'INITIAL' | 'REFRESH' | 'MANUAL'; model: string; searchModel: string; status: string; candidateCount: number; processedCount: number
  createdRequestCount: number; failedCount: number; cancelRequested: number; autoRecoveryCount: number; lastError: string | null
  startedAt: string | null; finishedAt: string | null; createdAt: string
  items?: Array<{ id: number; displayName: string; status: string; requestId: number | null; attemptCount: number; lastError: string | null }>
}

export type PlatformStats = {
  registeredUserCount: number; storedAnimeCount: number; koreanTitleCount: number; studioCount: number
  mappedAnimeCount: number; animeRelationCount: number; characterCount: number; voiceActorCount: number; pendingSubmissionCount: number
}

export type AdminOverviewRun = {
  id: number; seasonYear: number; season: string; phase: string; model: string; searchModel: string; status: string
  candidateCount: number; processedCount: number; createdRequestCount: number; failedCount: number
  lastError: string | null; startedAt: string | null; finishedAt: string | null; createdAt: string
}
export type AdminOverview = {
  generatedAt: string
  counts: {
    registeredUsers: number; anime: number; characters: number; voiceActors: number; studios: number
    pendingCatalog: number; pendingUserCatalog: number; pendingAiCatalog: number
    pendingProfileReports: number; failedDiscoveryRuns: number
  }
  service: {
    maintenanceEnabled: boolean
    discovery: {
      activeRun: AdminOverviewRun | null
      latestRun: AdminOverviewRun | null
      nextSchedule: { scheduledAt: string; season: string; phase: 'INITIAL' | 'REFRESH' }
    }
  }
  recent: {
    submissions: Array<{
      id: number; displayName: string; source: CatalogChangeSource; entityType: CatalogEntityType
      status: string; createdAt: string
    }>
    discoveryRuns: AdminOverviewRun[]
  }
}

export type AdminUserRole = 'USER' | 'ADMIN'
export type AdminUserRoleFilter = 'ALL' | AdminUserRole
export type AdminUserListItem = {
  id: number; email: string; username: string; role: AdminUserRole; profileImageUrl: string | null
  emailVerified: boolean; emailVerifiedAt: string | null; supabaseLinked: boolean; animeListCount: number
  completedCount: number; activeSessionCount: number; createdAt: string; updatedAt: string
}
export type AdminUserListResponse = {
  success: boolean; items: AdminUserListItem[]
  pageInfo: { page: number; limit: number; totalItems: number; totalPages: number; hasPrevious: boolean; hasNext: boolean }
  filters: { search: string; role: AdminUserRoleFilter }
}
export type AdminUserDetail = AdminUserListItem & {
  bio: string | null
  collection: { totalCount: number; plannedCount: number; watchingCount: number; completedCount: number; pausedCount: number; droppedCount: number; totalWatchedEpisodes: number; totalWatchMinutes: number; averageScore: number | null; favoriteGenre: string | null; favoriteReleasePeriod: string | null; statsUpdatedAt: string | null }
}
export type AdminUserDetailResponse = { success: boolean; item: AdminUserDetail }
