import { authFetch } from './auth'
import type { AnimeGenre } from '../types/anime'
import type { AnimeStatsItem } from '../types/stats'
import type { UserAnimeListItem, UserAnimeListSort } from '../types/collection'
import type {
  PublicUserAnimeListPage,
  PublicUserAnimeListResponse,
  PublicUserAnimeStatsPage,
  PublicUserAnimeStatsResponse,
  PublicUserProfile,
  PublicUserProfileResponse,
} from '../types/users'

function getApiBaseUrl() {
  const baseUrl = import.meta.env.VITE_API_BASE_URL

  if (!baseUrl) {
    throw new Error('VITE_API_BASE_URL이 설정되지 않았습니다.')
  }

  return baseUrl
}

function getErrorMessage(status: number, fallback: string) {
  if (status === 400) {
    return '요청 형식이 올바르지 않아요.'
  }

  if (status === 401) {
    return '로그인이 필요해요.'
  }

  if (status === 404) {
    return '해당 사용자를 찾을 수 없어요.'
  }

  if (status >= 500) {
    return '서버 오류가 발생했어요. 잠시 후 다시 시도해주세요.'
  }

  return fallback
}

function toFiniteNumber(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function normalizeNumericMap(value: unknown) {
  let source: unknown = value

  if (typeof source === 'string') {
    try {
      source = JSON.parse(source)
    } catch {
      return {} as Record<string, number>
    }
  }

  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return {} as Record<string, number>
  }

  const normalized: Record<string, number> = {}

  for (const [key, rawValue] of Object.entries(source as Record<string, unknown>)) {
    const numericValue = toFiniteNumber(rawValue)

    if (numericValue !== null) {
      normalized[key] = numericValue
    }
  }

  return normalized
}

function normalizeStatsItem(item: AnimeStatsItem) {
  return {
    ...item,
    totalCount: toFiniteNumber(item.totalCount) ?? 0,
    completedCount: toFiniteNumber(item.completedCount) ?? 0,
    watchingCount: toFiniteNumber(item.watchingCount) ?? 0,
    droppedCount: toFiniteNumber(item.droppedCount) ?? 0,
    totalWatchedEpisodes: toFiniteNumber(item.totalWatchedEpisodes) ?? 0,
    totalWatchMinutes: toFiniteNumber(item.totalWatchMinutes) ?? 0,
    avgScore: toFiniteNumber(item.avgScore),
    genreDistribution: normalizeNumericMap(item.genreDistribution),
    genreWatchMinutes: normalizeNumericMap(item.genreWatchMinutes),
    genreAvgScore: normalizeNumericMap(item.genreAvgScore),
    releaseYearDistribution: normalizeNumericMap(item.releaseYearDistribution),
    avgReleaseYear: toFiniteNumber(item.avgReleaseYear),
    scoreDistribution: normalizeNumericMap(item.scoreDistribution),
  }
}

function normalizePublicUserProfile(value: unknown) {
  if (!value || typeof value !== 'object') {
    return null
  }

  const source = value as Record<string, unknown>
  const id = toFiniteNumber(source.id)
  const username = typeof source.username === 'string' ? source.username : ''

  if (id === null || !username.trim()) {
    return null
  }

  return {
    id,
    username,
    profileImageUrl:
      typeof source.profileImageUrl === 'string' || source.profileImageUrl === null
        ? source.profileImageUrl
        : null,
    bio: typeof source.bio === 'string' || source.bio === null ? source.bio : null,
    animeListCount: toFiniteNumber(source.animeListCount) ?? 0,
    createdAt: typeof source.createdAt === 'string' ? source.createdAt : '',
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : '',
  } as PublicUserProfile
}

export async function fetchPublicUserProfile(userId: string, signal?: AbortSignal) {
  const response = await authFetch(new URL(`/api/users/${userId}/profile`, getApiBaseUrl()).toString(), {
    signal,
  })

  if (!response.ok) {
    throw new Error(getErrorMessage(response.status, '사용자 프로필을 불러오지 못했어요.'))
  }

  const data = (await response.json()) as PublicUserProfileResponse
  const user = normalizePublicUserProfile(data.user)

  if (!user) {
    throw new Error('사용자 정보를 찾을 수 없어요.')
  }

  return user
}

export async function fetchPublicUserCollection(params: {
  userId: string
  sort: UserAnimeListSort
  limit: number
  genre?: AnimeGenre | null
  cursor?: string | null
  signal?: AbortSignal
}) {
  const url = new URL(`/api/users/${params.userId}/anime-list`, getApiBaseUrl())
  url.searchParams.set('sort', params.sort)
  url.searchParams.set('titleLanguage', 'ko')
  url.searchParams.set('limit', String(params.limit))

  if (params.genre) {
    url.searchParams.set('genre', params.genre)
  }

  if (params.cursor) {
    url.searchParams.set('cursor', params.cursor)
  }

  const response = await authFetch(url.toString(), { signal: params.signal })

  if (!response.ok) {
    throw new Error(getErrorMessage(response.status, '사용자 컬렉션을 불러오지 못했어요.'))
  }

  const data = (await response.json()) as PublicUserAnimeListResponse
  const filteredItems = data.items.filter(
    (item: UserAnimeListItem) => item.anime.coverImageExtraLarge || item.anime.coverImageLarge,
  )

  return {
    user: data.user,
    items: filteredItems,
    pageInfo: data.pageInfo,
  } as PublicUserAnimeListPage
}

export async function fetchPublicUserAnimeStats(userId: string, signal?: AbortSignal) {
  const response = await authFetch(new URL(`/api/users/${userId}/anime-stats`, getApiBaseUrl()).toString(), {
    signal,
  })

  if (!response.ok) {
    throw new Error(getErrorMessage(response.status, '사용자 분석 정보를 불러오지 못했어요.'))
  }

  const data = (await response.json()) as PublicUserAnimeStatsResponse

  return {
    user: data.user,
    item: normalizeStatsItem(data.item),
  } as PublicUserAnimeStatsPage
}

export function getPublicUserDisplayName(user?: PublicUserProfile | null) {
  return user?.username?.trim() || 'Anime friend'
}
