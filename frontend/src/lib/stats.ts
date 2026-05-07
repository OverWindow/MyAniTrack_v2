import { authFetch } from './auth'
import { genreOptions } from './anime'
import type { AnimeStatsResponse } from '../types/stats'

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
