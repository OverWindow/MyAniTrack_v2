import { localizeExternalMessage, tr } from '../i18n'
import { authFetch } from './auth'
import type { ManagedShare, ShareDescriptor, ShareExpiryDays, ShareResourceType } from '../types/share'

export function getApiBaseUrl() {
  const value = import.meta.env.VITE_API_BASE_URL
  if (!value) throw new Error(tr("VITE_API_BASE_URL이 설정되지 않았습니다."))
  return value
}

async function parseResponse<T>(response: Response, fallback: string): Promise<T> {
  const data = await response.json().catch(() => ({})) as { message?: string; code?: string }
  if (!response.ok) {
    const error = new Error(localizeExternalMessage(data.message, fallback)) as Error & { code?: string; status?: number }
    error.code = data.code
    error.status = response.status
    throw error
  }
  return data as T
}

export async function saveMyShare(resourceType: ShareResourceType, expiresInDays: ShareExpiryDays) {
  const response = await authFetch(new URL(`/api/me/shares/${resourceType.toLowerCase()}`, getApiBaseUrl()).toString(), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresInDays }),
  })
  const data = await parseResponse<{ item: ManagedShare }>(response, tr("공유 링크를 만들지 못했어요."))
  return data.item
}

export async function fetchShareDescriptor(token: string, signal?: AbortSignal) {
  const response = await authFetch(new URL(`/api/shares/${encodeURIComponent(token)}`, getApiBaseUrl()).toString(), { signal })
  return parseResponse<ShareDescriptor>(response, tr("공유 링크를 불러오지 못했어요."))
}

export function createShareApiUrl(token: string, suffix: string) {
  return new URL(`/api/shares/${encodeURIComponent(token)}${suffix}`, getApiBaseUrl())
}
