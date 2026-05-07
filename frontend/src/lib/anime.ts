import type {
  AnimeDetailItem,
  AnimeDetailResponse,
  AnimeGenre,
  AnimeListItem,
  AnimeListResponse,
  AnimeSort,
  PopularAnimeItem,
  PopularAnimeResponse,
} from '../types/anime'
import { authFetch } from './auth'

export const sortOptions: Array<{ value: AnimeSort; label: string }> = [
  { value: 'latest', label: '최신 등록순' },
  { value: 'score', label: '평점 높은 순' },
  { value: 'season', label: '시즌 순' },
]

export const genreOptions: Array<{ value: AnimeGenre; label: string }> = [
  { value: 'Action', label: '액션' },
  { value: 'Adventure', label: '모험' },
  { value: 'Drama', label: '드라마' },
  { value: 'Sci-Fi', label: 'SF' },
  { value: 'Mystery', label: '미스터리' },
  { value: 'Comedy', label: '코미디' },
  { value: 'Supernatural', label: '초자연' },
  { value: 'Fantasy', label: '판타지' },
  { value: 'Sports', label: '스포츠' },
  { value: 'Romance', label: '로맨스' },
  { value: 'Slice of Life', label: '일상' },
  { value: 'Horror', label: '호러' },
  { value: 'Psychological', label: '심리' },
  { value: 'Thriller', label: '스릴러' },
  { value: 'Ecchi', label: '에치' },
  { value: 'Mecha', label: '메카' },
  { value: 'Music', label: '음악' },
  { value: 'Mahou Shoujo', label: '마법소녀' },
  { value: 'Hentai', label: '헨타이' },
]

function getApiBaseUrl() {
  const baseUrl = import.meta.env.VITE_API_BASE_URL

  if (!baseUrl) {
    throw new Error('VITE_API_BASE_URL이 설정되지 않았습니다.')
  }

  return baseUrl
}

export function getDisplayTitle(item: AnimeListItem | PopularAnimeItem) {
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

export function getGenreLabel(genre?: string | null) {
  if (!genre) {
    return '정보 없음'
  }

  return genreOptions.find((option) => option.value === genre)?.label ?? genre
}

export async function fetchAnimeList(params: {
  sort: AnimeSort
  limit: number
  genre?: AnimeGenre | null
  cursor?: string | null
  signal?: AbortSignal
}) {
  const url = new URL('/api/anime', getApiBaseUrl())
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
  genre?: AnimeGenre | null
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

  if (params.genre) {
    url.searchParams.set('genre', params.genre)
  }

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

export async function fetchPopularAnime(signal?: AbortSignal) {
  const url = new URL('/api/stats/platform/popular-anime', getApiBaseUrl())
  const response = await fetch(url.toString(), { signal })

  if (!response.ok) {
    throw new Error(`인기 애니를 불러오지 못했습니다. (${response.status})`)
  }

  const data = (await response.json()) as PopularAnimeResponse
  return data.items.filter((item) => item.coverImageExtraLarge || item.coverImageLarge)
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
