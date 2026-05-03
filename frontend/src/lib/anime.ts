import type {
  AnimeDetailItem,
  AnimeDetailResponse,
  AnimeListItem,
  AnimeListResponse,
  AnimeSort,
} from '../types/anime'
import { authFetch } from './auth'

export const sortOptions: Array<{ value: AnimeSort; label: string }> = [
  { value: 'latest', label: '최신 등록순' },
  { value: 'score', label: '평점 높은 순' },
  { value: 'season', label: '시즌 순' },
]

function getApiBaseUrl() {
  const baseUrl = import.meta.env.VITE_API_BASE_URL

  if (!baseUrl) {
    throw new Error('VITE_API_BASE_URL이 설정되지 않았습니다.')
  }

  return baseUrl
}

export function getDisplayTitle(item: AnimeListItem) {
  return item.titles?.korean || item.titles?.english || item.title
}

export function getSearchableTitle(item: AnimeListItem) {
  return [
    item.title,
    item.titles?.korean,
    item.titles?.english,
    item.titles?.native,
    item.titles?.romaji,
    item.titles?.userPreferred,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export function getDetailMetaTitle(item: AnimeDetailItem) {
  return item.title
}

export function getPrimaryPoster(item: { coverImageExtraLarge?: string | null; coverImageLarge: string }) {
  return item.coverImageExtraLarge || item.coverImageLarge
}

export function stripDescriptionMarkup(description?: string | null) {
  if (!description) {
    return '아직 등록된 설명이 없어요.'
  }

  return description
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .trim()
}

export async function fetchAnimeList(params: {
  sort: AnimeSort
  limit: number
  cursor?: string | null
  signal?: AbortSignal
}) {
  const url = new URL('/api/anime', getApiBaseUrl())
  url.searchParams.set('sort', params.sort)
  url.searchParams.set('titleLanguage', 'ko')
  url.searchParams.set('limit', String(params.limit))

  if (params.cursor) {
    url.searchParams.set('cursor', params.cursor)
  }

  const response = await authFetch(url.toString(), { signal: params.signal })

  if (!response.ok) {
    throw new Error(`애니 목록을 불러오지 못했습니다. (${response.status})`)
  }

  const data = (await response.json()) as AnimeListResponse

  return {
    ...data,
    items: data.items.filter((item) => item.coverImageExtraLarge || item.coverImageLarge),
  }
}

export async function searchAnime(params: {
  query: string
  sort: AnimeSort
  titleLanguage: 'ko' | 'en' | 'ja'
  limit: number
  cursor?: string | null
  signal?: AbortSignal
}) {
  const url = new URL('/api/anime/search', getApiBaseUrl())
  url.searchParams.set('query', params.query)
  url.searchParams.set('sort', params.sort)
  url.searchParams.set('titleLanguage', params.titleLanguage)
  url.searchParams.set('limit', String(params.limit))

  if (params.cursor) {
    url.searchParams.set('cursor', params.cursor)
  }

  const response = await authFetch(url.toString(), { signal: params.signal })

  if (!response.ok) {
    throw new Error(`애니 검색에 실패했습니다. (${response.status})`)
  }

  const data = (await response.json()) as AnimeListResponse

  return {
    ...data,
    items: data.items.filter((item) => item.coverImageExtraLarge || item.coverImageLarge),
  }
}

export async function fetchAnimeDetail(id: string, signal?: AbortSignal) {
  const url = new URL(`/api/anime/${id}`, getApiBaseUrl())
  url.searchParams.set('titleLanguage', 'ko')

  const response = await authFetch(url.toString(), { signal })

  if (response.status === 404) {
    throw new Error('해당 애니를 찾을 수 없어요.')
  }

  if (response.status === 400) {
    throw new Error('잘못된 요청으로 애니 정보를 불러오지 못했어요.')
  }

  if (!response.ok) {
    throw new Error(`애니 상세 정보를 불러오지 못했습니다. (${response.status})`)
  }

  const data = (await response.json()) as AnimeDetailResponse
  return data.item
}
