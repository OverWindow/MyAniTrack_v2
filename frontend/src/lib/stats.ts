import { authFetch } from './auth'
import { genreOptions } from './anime'
import type {
  AnimeStatsResponse,
  GenreBubbleResponse,
  StudioAnimeResponse,
  StudioRankingResponse,
  StudioRankingSort,
  TopGenreAnimeItem,
  VoiceActorAnimeResponse,
  VoiceActorRankingResponse,
  VoiceActorRankingSort,
} from '../types/stats'

function getApiBaseUrl() {
  const baseUrl = import.meta.env.VITE_API_BASE_URL

  if (!baseUrl) {
    throw new Error('VITE_API_BASE_URL이 설정되지 않았습니다.')
  }

  return baseUrl
}

function extractStatsItem(payload: unknown) {
  if (
    payload &&
    typeof payload === 'object' &&
    'item' in payload &&
    (payload as { item?: unknown }).item &&
    typeof (payload as { item?: unknown }).item === 'object'
  ) {
    return (payload as AnimeStatsResponse).item
  }

  throw new Error('분석 응답 형식이 올바르지 않아요.')
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

function normalizeTopGenreAnimeItems(value: unknown) {
  let source: unknown = value

  if (typeof source === 'string') {
    try {
      source = JSON.parse(source)
    } catch {
      return [] as TopGenreAnimeItem[]
    }
  }

  if (!Array.isArray(source)) {
    return [] as TopGenreAnimeItem[]
  }

  return source.flatMap((entry): TopGenreAnimeItem[] => {
    if (!entry || typeof entry !== 'object') {
      return []
    }

    const rawEntry = entry as Record<string, unknown>
    const animeId = toFiniteNumber(rawEntry.animeId)
    const title = typeof rawEntry.title === 'string' ? rawEntry.title.trim() : ''
    const genre = typeof rawEntry.genre === 'string' ? rawEntry.genre : ''

    if (animeId === null || !title) {
      return []
    }

    return [
      {
        animeId,
        title,
        coverImageLarge:
          typeof rawEntry.coverImageLarge === 'string' && rawEntry.coverImageLarge.trim()
            ? rawEntry.coverImageLarge
            : null,
        score: toFiniteNumber(rawEntry.score),
        genre,
      },
    ]
  })
}

function normalizeStatsItem(payload: unknown) {
  const item = extractStatsItem(payload)

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
    topWatchedGenreTopAnime: normalizeTopGenreAnimeItems(item.topWatchedGenreTopAnime),
    topRatedGenreTopAnime: normalizeTopGenreAnimeItems(item.topRatedGenreTopAnime),
  }
}

export async function fetchMyAnimeStats(signal?: AbortSignal) {
  const response = await authFetch(new URL('/api/me/anime-stats', getApiBaseUrl()).toString(), {
    signal,
  })

  if (response.status === 401) {
    throw new Error('로그인이 필요해요.')
  }

  if (!response.ok) {
    throw new Error(`분석 정보를 불러오지 못했습니다. (${response.status})`)
  }

  const payload = await response.json()
  return normalizeStatsItem(payload)
}

export async function recalculateMyAnimeStats() {
  const response = await authFetch(
    new URL('/api/me/anime-stats/recalculate', getApiBaseUrl()).toString(),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: '{}',
    },
  )

  if (response.status === 401) {
    throw new Error('로그인이 필요해요.')
  }

  if (!response.ok) {
    throw new Error(`분석을 다시 계산하지 못했습니다. (${response.status})`)
  }

  const payload = await response.json()
  console.log('[MyAniTrack] POST /api/me/anime-stats/recalculate response', payload)
  return normalizeStatsItem(payload)
}

type GenreBubbleParams = {
  userId?: string
  minCount?: number
  weighting?: 'fractional' | 'full'
  status?: 'completed' | 'all'
  communityScore?: 'average' | 'mean'
  titleLanguage?: 'ko' | 'en' | 'ja'
  topLimit?: number
  signal?: AbortSignal
}

function createGenreBubbleUrl(params: GenreBubbleParams = {}) {
  const path = params.userId
    ? `/api/users/${params.userId}/anime-stats/genre-bubble`
    : '/api/me/anime-stats/genre-bubble'
  const url = new URL(path, getApiBaseUrl())

  url.searchParams.set('minCount', String(params.minCount ?? 5))
  url.searchParams.set('weighting', params.weighting ?? 'fractional')
  url.searchParams.set('status', params.status ?? 'completed')
  url.searchParams.set('communityScore', params.communityScore ?? 'average')
  url.searchParams.set('titleLanguage', params.titleLanguage ?? 'ko')

  url.searchParams.set('topLimit', String(params.topLimit ?? 3))

  return url
}

export async function fetchGenreBubbleStats(params: GenreBubbleParams = {}) {
  const response = await authFetch(createGenreBubbleUrl(params).toString(), {
    signal: params.signal,
  })

  if (response.status === 401) {
    throw new Error('로그인이 필요해요.')
  }

  if (!response.ok) {
    throw new Error(`장르 취향 버블 차트를 불러오지 못했습니다. (${response.status})`)
  }

  const payload = (await response.json()) as GenreBubbleResponse

  return payload.item
}

type VoiceActorRankingParams = {
  userId?: string
  sort: VoiceActorRankingSort
  limit?: number
  minRatedAnimeCount?: number
  signal?: AbortSignal
}

type VoiceActorAnimeParams = {
  userId?: string
  voiceActorId: number
  titleLanguage?: 'ko' | 'en' | 'romaji'
  limit?: number
  cursor?: string | null
  signal?: AbortSignal
}

type StudioRankingParams = {
  userId?: string
  status?: 'completed' | 'all'
  sort?: StudioRankingSort
  mainOnly?: boolean
  minAnimeCount?: number
  minRatedAnimeCount?: number
  limit?: number
  cursor?: string | null
  signal?: AbortSignal
}

type StudioAnimeParams = {
  userId?: string
  studioId: number
  status?: 'completed' | 'all'
  mainOnly?: boolean
  titleLanguage?: 'ko' | 'en' | 'ja'
  limit?: number
  cursor?: string | null
  signal?: AbortSignal
}

function createVoiceActorRankingUrl(params: VoiceActorRankingParams) {
  const path = params.userId
    ? `/api/users/${params.userId}/voice-actors/ranking`
    : '/api/me/voice-actors/ranking'
  const url = new URL(path, getApiBaseUrl())

  url.searchParams.set('sort', params.sort)
  url.searchParams.set('limit', String(params.limit ?? 20))

  if (params.minRatedAnimeCount !== undefined) {
    url.searchParams.set('minRatedAnimeCount', String(params.minRatedAnimeCount))
  }

  return url
}

function createVoiceActorAnimeUrl(params: VoiceActorAnimeParams) {
  const path = params.userId
    ? `/api/users/${params.userId}/voice-actors/${params.voiceActorId}/anime`
    : `/api/me/voice-actors/${params.voiceActorId}/anime`
  const url = new URL(path, getApiBaseUrl())

  url.searchParams.set('titleLanguage', params.titleLanguage ?? 'ko')
  url.searchParams.set('limit', String(params.limit ?? 20))

  if (params.cursor) {
    url.searchParams.set('cursor', params.cursor)
  }

  return url
}

function createStudioRankingUrl(params: StudioRankingParams = {}) {
  const path = params.userId
    ? `/api/users/${params.userId}/anime-stats/studios`
    : '/api/me/anime-stats/studios'
  const url = new URL(path, getApiBaseUrl())

  url.searchParams.set('status', params.status ?? 'completed')
  url.searchParams.set('sort', params.sort ?? 'count')
  url.searchParams.set('mainOnly', String(params.mainOnly ?? true))
  url.searchParams.set('minAnimeCount', String(params.minAnimeCount ?? 1))
  url.searchParams.set('minRatedAnimeCount', String(params.minRatedAnimeCount ?? 1))
  url.searchParams.set('limit', String(params.limit ?? 20))

  if (params.cursor) {
    url.searchParams.set('cursor', params.cursor)
  }

  return url
}

function createStudioAnimeUrl(params: StudioAnimeParams) {
  const path = params.userId
    ? `/api/users/${params.userId}/anime-stats/studios/${params.studioId}/anime`
    : `/api/me/anime-stats/studios/${params.studioId}/anime`
  const url = new URL(path, getApiBaseUrl())

  url.searchParams.set('status', params.status ?? 'completed')
  url.searchParams.set('mainOnly', String(params.mainOnly ?? true))
  url.searchParams.set('titleLanguage', params.titleLanguage ?? 'ko')
  url.searchParams.set('limit', String(params.limit ?? 20))

  if (params.cursor) {
    url.searchParams.set('cursor', params.cursor)
  }

  return url
}

export async function fetchVoiceActorRanking(params: VoiceActorRankingParams) {
  const response = await authFetch(createVoiceActorRankingUrl(params).toString(), {
    signal: params.signal,
  })

  if (response.status === 401) {
    throw new Error('로그인이 필요해요.')
  }

  if (!response.ok) {
    throw new Error(`성우 랭킹을 불러오지 못했습니다. (${response.status})`)
  }

  const payload = (await response.json()) as VoiceActorRankingResponse

  return payload.items ?? []
}

export async function fetchVoiceActorAnime(params: VoiceActorAnimeParams) {
  const response = await authFetch(createVoiceActorAnimeUrl(params).toString(), {
    signal: params.signal,
  })

  if (response.status === 401) {
    throw new Error('로그인이 필요해요.')
  }

  if (!response.ok) {
    throw new Error(`성우 상세 작품을 불러오지 못했습니다. (${response.status})`)
  }

  return (await response.json()) as VoiceActorAnimeResponse
}

export async function fetchStudioRanking(params: StudioRankingParams = {}) {
  const response = await authFetch(createStudioRankingUrl(params).toString(), {
    signal: params.signal,
  })

  if (response.status === 401) {
    throw new Error('로그인이 필요해요.')
  }

  if (!response.ok) {
    throw new Error(`스튜디오 랭킹을 불러오지 못했습니다. (${response.status})`)
  }

  return (await response.json()) as StudioRankingResponse
}

export async function fetchStudioAnime(params: StudioAnimeParams) {
  const response = await authFetch(createStudioAnimeUrl(params).toString(), {
    signal: params.signal,
  })

  if (response.status === 401) {
    throw new Error('로그인이 필요해요.')
  }

  if (!response.ok) {
    throw new Error(`스튜디오 작품 목록을 불러오지 못했습니다. (${response.status})`)
  }

  return (await response.json()) as StudioAnimeResponse
}

export function getGenreLabel(genre?: string | null) {
  if (!genre) {
    return '정보 없음'
  }

  return genreOptions.find((option) => option.value === genre)?.label ?? genre
}

export function formatWatchHours(totalMinutes?: number | null) {
  if (!totalMinutes || totalMinutes <= 0) {
    return '0시간'
  }

  return `${Math.round(totalMinutes / 60).toLocaleString()}시간`
}

export function formatUpdatedAt(updatedAt?: string | null) {
  if (!updatedAt) {
    return '업데이트 정보 없음'
  }

  const normalized = updatedAt.replace(' ', 'T')
  const date = new Date(normalized)

  if (Number.isNaN(date.getTime())) {
    return updatedAt
  }

  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
