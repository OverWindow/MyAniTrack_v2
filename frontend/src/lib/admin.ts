import { authFetch } from './auth'
import type {
  AdminActionResponse,
  AdminCastSyncAnimePayload,
  AdminCastSyncBatchPayload,
  AdminCastSyncChunkedPayload,
  AdminCastSyncStatusPayload,
  AdminFullSyncPayload,
  AdminRelationSyncPayload,
  AdminSeriesRebuildPayload,
  AdminSeriesRebuildResponse,
  AdminStudioSyncMissingPayload,
  AdminStudioSyncMissingResult,
  AdminSyncAllPayload,
  AdminSyncChunkedPayload,
  AdminSyncPagePayload,
  AdminSyncSeasonPayload,
  AdminTranslateKoreanTitlesPayload,
  AdminUpdateKoreanTitlePayload,
  AdminUpdateKoreanTitleResponse,
  AdminUserDetailResponse,
  AdminUserListResponse,
  AdminUserRoleFilter,
  PlatformStats,
  CatalogImageSyncMode,
  CatalogImageSyncSnapshot,
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
    return fallback
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

async function postAdminRaw<TPayload, TResult>(path: string, payload: TPayload, fallback: string) {
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

  return (await response.json()) as TResult
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

export async function fetchAdminUsers(params: {
  page?: number
  limit?: number
  search?: string
  role?: AdminUserRoleFilter
  signal?: AbortSignal
} = {}) {
  const url = new URL('/admin/users', getApiBaseUrl())
  url.searchParams.set('page', String(params.page ?? 1))
  url.searchParams.set('limit', String(params.limit ?? 20))
  url.searchParams.set('role', params.role ?? 'ALL')

  if (params.search?.trim()) {
    url.searchParams.set('search', params.search.trim())
  }

  const response = await authFetch(url.toString(), { signal: params.signal })

  if (!response.ok) {
    throw new Error(getAdminErrorMessage(response.status, '사용자 목록을 불러오지 못했어요.'))
  }

  return (await response.json()) as AdminUserListResponse
}

export async function fetchAdminUserDetail(userId: number, signal?: AbortSignal) {
  const response = await authFetch(createAdminUrl(`/admin/users/${userId}`), { signal })

  if (response.status === 404) {
    throw new Error('해당 사용자를 찾을 수 없어요.')
  }

  if (!response.ok) {
    throw new Error(getAdminErrorMessage(response.status, '사용자 상세 정보를 불러오지 못했어요.'))
  }

  return ((await response.json()) as AdminUserDetailResponse).item
}

export interface AdminProfileReport {
  id: number
  reporterUserId: number
  reportedUserId: number
  reporterUsername: string
  reportedUsername: string
  profileImageUrl: string | null
  reason: string
  status: string
  requestCount: number
  createdAt: string
}

export async function fetchProfileReports() {
  const response = await authFetch(createAdminUrl('/admin/profile-reports'))
  if (!response.ok) throw new Error(getAdminErrorMessage(response.status, '프로필 신고를 불러오지 못했어요.'))
  const data = await response.json() as { reports: AdminProfileReport[] }
  return data.reports
}

export async function resolveProfileReport(id: number, action: 'DISMISS' | 'REMOVE_PROFILE' | 'SUSPEND_USER') {
  const response = await authFetch(createAdminUrl(`/admin/profile-reports/${id}`), {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
  })
  if (!response.ok) throw new Error(getAdminErrorMessage(response.status, '프로필 신고 처리에 실패했어요.'))
}

export async function setAnimeVisibility(animeId: number, visible: boolean, reason: string) {
  const response = await authFetch(createAdminUrl(`/admin/anime/${animeId}/visibility`), {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visible, reason }),
  })
  if (!response.ok) throw new Error(getAdminErrorMessage(response.status, '작품 노출 상태를 저장하지 못했어요.'))
}

export function syncAnimePage(payload: AdminSyncPagePayload) {
  return postAdminAction('/admin/anime/sync/page', payload, '애니 페이지 동기화에 실패했어요.')
}

export function syncAllAnimePages(payload: AdminSyncAllPayload) {
  return postAdminAction('/admin/anime/sync/all', payload, '연속 페이지 동기화에 실패했어요.')
}

export async function syncAnimeRelations(payload: AdminRelationSyncPayload) {
  const data = await postAdminRaw<AdminRelationSyncPayload, Record<string, unknown>>(
    '/admin/anime/sync/relations',
    payload,
    '애니 연관 작품 동기화에 실패했어요.',
  )
  const nestedResult = data.result
  const result = nestedResult && typeof nestedResult === 'object' && !Array.isArray(nestedResult)
    ? nestedResult as Record<string, unknown>
    : data

  return {
    success: typeof data.success === 'boolean' ? data.success : true,
    message: typeof data.message === 'string'
      ? data.message
      : payload.mode === 'missing'
        ? '미동기화 연관 작품을 처리했어요.'
        : '연관 작품 전체 재동기화를 처리했어요.',
    result,
  } satisfies AdminActionResponse
}

export async function rebuildAnimeSeries(payload: AdminSeriesRebuildPayload) {
  const response = await authFetch(createAdminUrl('/admin/anime/series/rebuild'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => null) as { message?: unknown } | null

    if (response.status === 409) {
      throw new Error(typeof data?.message === 'string'
        ? data.message
        : '애니 시리즈 재계산이 이미 실행 중이에요.')
    }

    throw new Error(getAdminErrorMessage(response.status, '애니 시리즈 재계산에 실패했어요.'))
  }

  const data = (await response.json()) as AdminSeriesRebuildResponse

  return {
    success: data.success,
    message: data.message,
    result: data.result as unknown as Record<string, unknown>,
  } satisfies AdminActionResponse
}

export function syncAnimeChunked(payload: AdminSyncChunkedPayload) {
  return postAdminAction('/admin/anime/sync/chunked', payload, '청크 동기화에 실패했어요.')
}

export function syncAnimeFull(payload: AdminFullSyncPayload) {
  return postAdminAction('/admin/anime/sync/full', payload, '전체 통합 동기화에 실패했어요.')
}

export function syncAnimeSeason(payload: AdminSyncSeasonPayload) {
  return postAdminAction('/admin/anime/sync/season', payload, '시즌 동기화에 실패했어요.')
}

export function translateKoreanTitles(payload: AdminTranslateKoreanTitlesPayload) {
  return postAdminAction('/admin/anime/korean-titles/translate', payload, '한국어 제목 번역 배치 실행에 실패했어요.')
}

export function syncAnimeCast(payload: AdminCastSyncAnimePayload) {
  const { animeId, ...body } = payload
  return postAdminAction(`/admin/anime/${animeId}/sync/cast`, body, '캐릭터/성우 단건 동기화에 실패했어요.')
}

export function syncAnimeCastBatch(payload: AdminCastSyncBatchPayload) {
  return postAdminAction('/admin/anime/sync/cast/batch', payload, '캐릭터/성우 배치 동기화에 실패했어요.')
}

export function syncAnimeCastChunked(payload: AdminCastSyncChunkedPayload) {
  return postAdminAction('/admin/anime/sync/cast/chunked', payload, '캐릭터/성우 청크 동기화에 실패했어요.')
}

export async function syncMissingAnimeStudios(payload: AdminStudioSyncMissingPayload) {
  const result = await postAdminRaw<AdminStudioSyncMissingPayload, AdminStudioSyncMissingResult>(
    '/admin/anime/sync/studios/missing',
    payload,
    '스튜디오 미동기화 애니 처리에 실패했어요.',
  )

  return {
    success: result.failedAnimeCount === 0,
    message: result.hasMore
      ? '스튜디오 동기화를 처리했어요. 아직 남은 항목이 있어요.'
      : '스튜디오 동기화를 모두 처리했어요.',
    result: result as unknown as Record<string, unknown>,
  } satisfies AdminActionResponse
}

export async function fetchAnimeCastSyncStatus(payload: AdminCastSyncStatusPayload) {
  const response = await authFetch(createAdminUrl(`/admin/anime/${payload.animeId}/sync/cast`))

  if (!response.ok) {
    throw new Error(getAdminErrorMessage(response.status, '캐릭터/성우 동기화 상태 조회에 실패했어요.'))
  }

  const data = await response.json()

  return {
    success: Boolean(data?.success ?? true),
    message: typeof data?.message === 'string' ? data.message : '캐릭터/성우 동기화 상태를 조회했어요.',
    result: data,
  } as AdminActionResponse
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

async function requestCatalogImageSync(
  path: string,
  options: RequestInit = {},
) {
  const response = await authFetch(createAdminUrl(path), options)

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null) as { code?: string; storageStatus?: number | null } | null
    const fallback = getAdminErrorMessage(response.status, '카탈로그 이미지 동기화 요청에 실패했어요.')
    const storageMessage = errorBody?.code === 'IMAGE_STORAGE_UPLOAD_FAILED'
      ? 'S3 업로드에 실패했어요. 버킷 쓰기 권한과 AWS 자격 증명을 확인해주세요.'
      : errorBody?.code === 'IMAGE_STORAGE_VERIFY_FAILED'
        ? 'S3 업로드 검증에 실패했어요. HeadObject 권한과 객체 메타데이터를 확인해주세요.'
        : errorBody?.code === 'IMAGE_STORAGE_CDN_READ_FAILED'
          ? 'CloudFront에서 점검 객체를 읽지 못했어요. DNS, 인증서, 대체 도메인과 배포 동작을 확인해주세요.'
          : errorBody?.code === 'IMAGE_STORAGE_DELETE_FAILED'
            ? 'S3 점검 객체를 삭제하지 못했어요. 버킷 삭제 권한을 확인해주세요.'
            : null
    const message = response.status === 409
      ? '이미 실행 중이거나 일시정지된 이미지 동기화 작업이 있어요.'
      : response.status === 404
        ? '이미지 동기화 작업을 찾을 수 없어요.'
        : response.status === 502
          ? storageMessage ?? 'S3 또는 CloudFront 연결을 확인하지 못했어요. 버킷 권한과 CDN 주소를 확인해주세요.'
          : fallback
    throw new Error(message)
  }

  const data = await response.json() as { success: boolean; result: CatalogImageSyncSnapshot }
  return data.result
}

export function fetchCatalogImageSyncStatus(signal?: AbortSignal) {
  return requestCatalogImageSync('/admin/catalog-images/sync/jobs/current', { signal })
}

export function startCatalogImageSync(mode: Exclude<CatalogImageSyncMode, 'retry'>) {
  return requestCatalogImageSync('/admin/catalog-images/sync/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope: 'all', mode }),
  })
}

export function pauseCatalogImageSync(jobId: number) {
  return requestCatalogImageSync(`/admin/catalog-images/sync/jobs/${jobId}/pause`, { method: 'POST' })
}

export function resumeCatalogImageSync(jobId: number) {
  return requestCatalogImageSync(`/admin/catalog-images/sync/jobs/${jobId}/resume`, { method: 'POST' })
}

export function retryFailedCatalogImageSync(jobId: number) {
  return requestCatalogImageSync(`/admin/catalog-images/sync/jobs/${jobId}/retry-failed`, { method: 'POST' })
}
