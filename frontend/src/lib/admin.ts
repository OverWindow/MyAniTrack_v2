import { authFetch } from './auth'
import type {
  AdminSeriesRebuildPayload, AdminSeriesRebuildResponse, AdminUpdateKoreanTitlePayload,
  AdminOverview, AdminUpdateKoreanTitleResponse, AdminUserDetailResponse, AdminUserListResponse, AdminUserRoleFilter,
  CatalogChangeSource, CatalogChangeStatus, CatalogDiscoveryRun, CatalogEntityDetail, CatalogEntityType, CatalogSearchItem,
  CatalogTaxonomy,
  CatalogSubmission, PlatformStats,
} from '../types/admin'

function apiBase() {
  const value = import.meta.env.VITE_API_BASE_URL
  if (!value) throw new Error('VITE_API_BASE_URL이 설정되지 않았습니다.')
  return value
}
function url(path: string) { return new URL(path, apiBase()).toString() }
async function parse<T>(response: Response, fallback: string): Promise<T> {
  const data = await response.json().catch(() => null) as { message?: string; candidates?: CatalogSearchItem[] } | null
  if (!response.ok) throw Object.assign(new Error(data?.message || fallback), { candidates: data?.candidates ?? [] })
  return data as T
}
async function jsonRequest<T>(path: string, method: string, body?: unknown) {
  return parse<T>(await authFetch(url(path), {
    method, headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), '요청을 처리하지 못했어요.')
}

export async function fetchPlatformStats() {
  return (await parse<{ item: PlatformStats }>(await fetch(url('/api/stats/platform')), '플랫폼 통계를 불러오지 못했어요.')).item
}
export async function fetchAdminOverview(signal?: AbortSignal) {
  return (await parse<{ item: AdminOverview }>(
    await authFetch(url('/admin/overview'), { signal }),
    '관리자 현황을 불러오지 못했어요.',
  )).item
}
export async function fetchAdminUsers(params: { page?: number; limit?: number; search?: string; role?: AdminUserRoleFilter; signal?: AbortSignal } = {}) {
  const target = new URL('/admin/users', apiBase())
  target.searchParams.set('page', String(params.page ?? 1)); target.searchParams.set('limit', String(params.limit ?? 20)); target.searchParams.set('role', params.role ?? 'ALL')
  if (params.search?.trim()) target.searchParams.set('search', params.search.trim())
  return parse<AdminUserListResponse>(await authFetch(target.toString(), { signal: params.signal }), '사용자 목록을 불러오지 못했어요.')
}
export async function fetchAdminUserDetail(userId: number, signal?: AbortSignal) {
  return (await parse<AdminUserDetailResponse>(await authFetch(url(`/admin/users/${userId}`), { signal }), '사용자 상세 정보를 불러오지 못했어요.')).item
}

export interface AdminProfileReport { id: number; reporterUserId: number; reportedUserId: number; reporterUsername: string; reportedUsername: string; profileImageUrl: string | null; reason: string; status: string; requestCount: number; createdAt: string }
export async function fetchProfileReports() { return (await parse<{ reports: AdminProfileReport[] }>(await authFetch(url('/admin/profile-reports')), '프로필 신고를 불러오지 못했어요.')).reports }
export async function resolveProfileReport(id: number, action: 'DISMISS' | 'REMOVE_PROFILE' | 'SUSPEND_USER') { await jsonRequest(`/admin/profile-reports/${id}`, 'PATCH', { action }) }
export async function setAnimeVisibility(animeId: number, visible: boolean, reason: string) { await jsonRequest(`/admin/anime/${animeId}/visibility`, 'PATCH', { visible, reason }) }
export async function rebuildAnimeSeries(payload: AdminSeriesRebuildPayload) { return jsonRequest<AdminSeriesRebuildResponse>('/admin/anime/series/rebuild', 'POST', payload) }
export async function updateAnimeKoreanTitle(animeId: number, payload: AdminUpdateKoreanTitlePayload) { return jsonRequest<AdminUpdateKoreanTitleResponse>(`/admin/anime/${animeId}/korean-title`, 'PATCH', payload) }

export async function searchCatalog(type: CatalogEntityType, query: string, limit = 20, signal?: AbortSignal) {
  const target = new URL('/admin/catalog/entities/search', apiBase()); target.searchParams.set('type', type); target.searchParams.set('q', query); target.searchParams.set('limit', String(limit))
  return (await parse<{ items: CatalogSearchItem[] }>(await authFetch(target.toString(), { signal }), '카탈로그 검색에 실패했어요.')).items
}
export async function fetchCatalogTaxonomy(signal?: AbortSignal) {
  return (await parse<{ item: CatalogTaxonomy }>(await authFetch(url('/admin/catalog/taxonomy'), { signal }), '분류 목록을 불러오지 못했어요.')).item
}
export async function fetchCatalogEntity(type: CatalogEntityType, id: number, signal?: AbortSignal) {
  return (await parse<{ item: CatalogEntityDetail }>(await authFetch(url(`/admin/catalog/entities/${type}/${id}`), { signal }), '엔티티 상세 정보를 불러오지 못했어요.')).item
}
export async function writeCatalogEntity(type: CatalogEntityType, payload: Record<string, unknown>, id?: number) {
  return jsonRequest<{ result: { entityId: number } }>(`/admin/catalog/entities/${type}${id ? `/${id}` : ''}`, id ? 'PATCH' : 'POST', payload)
}
export async function uploadCatalogEntityImage(type: CatalogEntityType, id: number, variant: string, file: File) {
  const form = new FormData(); form.append('variant', variant); form.append('image', file)
  return parse<{ result: { publicUrl: string } }>(await authFetch(url(`/admin/catalog/entities/${type}/${id}/images`), { method: 'POST', body: form }), '이미지 업로드에 실패했어요.')
}
export async function fetchCatalogSubmissions(filters: { status?: CatalogChangeStatus; source?: CatalogChangeSource; type?: CatalogEntityType; confidence?: 'high' | 'medium' | 'low' } = {}) {
  const target = new URL('/admin/catalog/submissions', apiBase())
  Object.entries(filters).forEach(([key, value]) => { if (value) target.searchParams.set(key, value) })
  return (await parse<{ submissions: CatalogSubmission[] }>(await authFetch(target.toString()), '검토함을 불러오지 못했어요.')).submissions
}
export async function fetchCatalogSubmission(id: number) { return (await parse<{ submission: CatalogSubmission }>(await authFetch(url(`/admin/catalog/submissions/${id}`)), '검토 요청을 불러오지 못했어요.')).submission }
export async function updateCatalogSubmission(id: number, payload: Partial<Pick<CatalogSubmission, 'displayName' | 'sourceUrl' | 'description' | 'payload' | 'kind' | 'targetEntityId' | 'duplicateResolution'>>) { return (await jsonRequest<{ submission: CatalogSubmission }>(`/admin/catalog/submissions/${id}`, 'PATCH', payload)).submission }
export async function approveCatalogSubmission(id: number) { return jsonRequest<{ result: { entityId: number } }>(`/admin/catalog/submissions/${id}/approve`, 'POST') }
export async function rejectCatalogSubmission(id: number, reason: string) { return jsonRequest(`/admin/catalog/submissions/${id}/reject`, 'POST', { reason }) }
export async function fetchDiscoveryRuns() { return (await parse<{ runs: CatalogDiscoveryRun[] }>(await authFetch(url('/admin/catalog/discovery-runs')), 'AI 실행 이력을 불러오지 못했어요.')).runs }
export async function fetchDiscoveryRun(id: number) { return (await parse<{ run: CatalogDiscoveryRun }>(await authFetch(url(`/admin/catalog/discovery-runs/${id}`)), 'AI 실행 상세를 불러오지 못했어요.')).run }
export async function createDiscoveryRun(payload: { seasonYear: number; season: CatalogDiscoveryRun['season'] }) { return (await jsonRequest<{ run: CatalogDiscoveryRun }>('/admin/catalog/discovery-runs', 'POST', payload)).run }
export async function cancelDiscoveryRun(id: number) { await jsonRequest(`/admin/catalog/discovery-runs/${id}/cancel`, 'POST') }
export async function retryDiscoveryRun(id: number) { return (await jsonRequest<{ run: CatalogDiscoveryRun }>(`/admin/catalog/discovery-runs/${id}/retry`, 'POST')).run }
