import { authFetch } from './auth'
import type {
  AdminActionResponse,
  AdminSyncAllPayload,
  AdminSyncChunkedPayload,
  AdminSyncPagePayload,
  AdminSyncSeasonPayload,
  AdminTranslateKoreanTitlesPayload,
  AdminUpdateKoreanTitlePayload,
  AdminUpdateKoreanTitleResponse,
  PlatformStats,
} from '../types/admin'

function getApiBaseUrl() {
  const baseUrl = import.meta.env.VITE_API_BASE_URL

  if (!baseUrl) {
    throw new Error('VITE_API_BASE_URL이 설정되지 않았습니다.')
  }

  return baseUrl
}

function createAdminUrl(path: string) {
  return new URL(path, getApiBaseUrl()).toString()
}

function getAdminErrorMessage(status: number, fallback: string) {
  if (status === 400) {
    return '요청 값이 올바르지 않아요.'
  }

  if (status === 401) {
    return '관리자 인증이 필요해요. 다시 로그인해주세요.'
  }

  if (status === 403) {
    return '관리자 권한이 있는 계정만 사용할 수 있어요.'
  }

  if (status === 404) {
    return '해당 애니를 찾을 수 없어요.'
  }

  if (status >= 500) {
    return '서버 오류가 발생했어요. 잠시 후 다시 시도해주세요.'
  }

  return fallback
}

async function postAdminAction<TPayload>(path: string, payload: TPayload, fallback: string) {
  const response = await authFetch(createAdminUrl(path), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(getAdminErrorMessage(response.status, fallback))
  }

  return (await response.json()) as AdminActionResponse
}

export async function fetchPlatformStats() {
  const response = await fetch(createAdminUrl('/api/stats/platform'))

  if (!response.ok) {
    throw new Error(getAdminErrorMessage(response.status, '플랫폼 통계를 불러오지 못했어요.'))
  }

  const data = (await response.json()) as {
    success: boolean
    item: PlatformStats
  }

  return data.item
}

export function syncAnimePage(payload: AdminSyncPagePayload) {
  return postAdminAction('/admin/anime/sync/page', payload, '애니 페이지 동기화에 실패했어요.')
}

export function syncAllAnimePages(payload: AdminSyncAllPayload) {
  return postAdminAction('/admin/anime/sync/all', payload, '연속 페이지 동기화에 실패했어요.')
}

export function syncAnimeChunked(payload: AdminSyncChunkedPayload) {
  return postAdminAction('/admin/anime/sync/chunked', payload, '청크 동기화에 실패했어요.')
}

export function syncAnimeSeason(payload: AdminSyncSeasonPayload) {
  return postAdminAction('/admin/anime/sync/season', payload, '시즌 동기화에 실패했어요.')
}

export function translateKoreanTitles(payload: AdminTranslateKoreanTitlesPayload) {
  return postAdminAction('/admin/anime/korean-titles/translate', payload, '한국어 제목 번역 배치 실행에 실패했어요.')
}

export async function updateAnimeKoreanTitle(animeId: number, payload: AdminUpdateKoreanTitlePayload) {
  const response = await authFetch(createAdminUrl(`/admin/anime/${animeId}/korean-title`), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(getAdminErrorMessage(response.status, '한국어 제목 수정에 실패했어요.'))
  }

  return (await response.json()) as AdminUpdateKoreanTitleResponse
}
