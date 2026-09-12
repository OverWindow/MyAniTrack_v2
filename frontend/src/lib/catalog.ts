import { authFetch } from './auth'
import { tr } from '../i18n'
import type { CatalogChangeKind, CatalogEntityType, CatalogSearchItem, CatalogSubmission } from '../types/admin'

function endpoint(path: string) {
  const base = import.meta.env.VITE_API_BASE_URL
  if (!base) throw new Error('VITE_API_BASE_URL is not configured.')
  return new URL(path, base).toString()
}

async function decode<T>(response: Response, fallback: string): Promise<T> {
  const data = await response.json().catch(() => null) as { message?: string } | null
  if (!response.ok) throw new Error(data?.message || fallback)
  return data as T
}

export async function createCatalogSubmission(input: {
  entityType: CatalogEntityType
  kind?: CatalogChangeKind
  targetEntityId?: number
  displayName: string
  sourceUrl: string
  description: string
  payload?: Record<string, unknown>
}) {
  const response = await authFetch(endpoint('/api/me/catalog-submissions'), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  })
  return (await decode<{ submission: CatalogSubmission }>(response, tr('등록 요청을 보내지 못했어요.'))).submission
}

export async function searchCatalogEntities(type: CatalogEntityType, query: string) {
  const url = new URL(endpoint('/api/catalog/search'))
  url.searchParams.set('type', type)
  url.searchParams.set('q', query)
  url.searchParams.set('limit', '20')
  return (await decode<{ items: CatalogSearchItem[] }>(await authFetch(url.toString()), tr('카탈로그 검색에 실패했어요.'))).items
}

export async function fetchMyCatalogSubmissions() {
  return (await decode<{ submissions: CatalogSubmission[] }>(
    await authFetch(endpoint('/api/me/catalog-submissions')), tr('내 등록 요청을 불러오지 못했어요.'),
  )).submissions
}

export async function withdrawCatalogSubmission(id: number) {
  const response = await authFetch(endpoint(`/api/me/catalog-submissions/${id}`), { method: 'DELETE' })
  if (!response.ok) await decode(response, tr('등록 요청을 철회하지 못했어요.'))
}
