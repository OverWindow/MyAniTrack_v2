import type {
  VoiceActorDetailResponse,
  VoiceActorTitleLanguage,
} from '../types/voiceActor'

function getApiBaseUrl() {
  const baseUrl = import.meta.env.VITE_API_BASE_URL

  if (!baseUrl) {
    throw new Error('VITE_API_BASE_URL이 설정되지 않았습니다.')
  }

  return baseUrl
}

export function getVoiceActorDisplayName(name?: {
  full?: string | null
  native?: string | null
  userPreferred?: string | null
} | null) {
  return name?.userPreferred || name?.full || name?.native || '이름 정보 없음'
}

export function getVoiceActorImage(image?: { large?: string | null; medium?: string | null } | null) {
  return image?.large || image?.medium || null
}

export async function fetchVoiceActorDetail(params: {
  voiceActorId: string | number
  titleLanguage?: VoiceActorTitleLanguage
  limit?: number
  cursor?: string | null
  signal?: AbortSignal
}) {
  const url = new URL(`/api/voice-actors/${params.voiceActorId}`, getApiBaseUrl())
  url.searchParams.set('titleLanguage', params.titleLanguage ?? 'ko')
  url.searchParams.set('limit', String(params.limit ?? 20))

  if (params.cursor) {
    url.searchParams.set('cursor', params.cursor)
  }

  const response = await fetch(url.toString(), { signal: params.signal })

  if (response.status === 404) {
    throw new Error('해당 성우를 찾을 수 없어요.')
  }

  if (!response.ok) {
    throw new Error(`성우 상세 정보를 불러오지 못했습니다. (${response.status})`)
  }

  const payload = (await response.json()) as VoiceActorDetailResponse
  return payload.item
}
