import { getTitleLanguage, tr } from '../i18n'
import type {
  AnimeDetailItem,
  AnimeDetailResponse,
  AnimeCastResponse,
  AnimeCastRole,
  AnimeCastVoiceLanguage,
  AnimeGenre,
  AnimeListItem,
  AnimeListResponse,
  AnimeRelationType,
  AnimeSeriesListResponse,
  AnimeSeriesScope,
  AnimeSearchWithRelationsResponse,
  AnimeSort,
  PopularAnimeItem,
  PopularAnimeResponse,
} from '../types/anime'
import { authFetch } from './auth'

export const sortOptions: Array<{ value: AnimeSort; label: string }> = [
  { value: 'latest', label: tr("최신 등록순") },
  { value: 'score', label: tr("평점 높은 순") },
  { value: 'popularity', label: tr("인기 높은 순") },
  { value: 'season', label: tr("시즌 순") },
]

export const genreOptions: Array<{ value: AnimeGenre; label: string }> = [
  { value: 'Action', label: tr("액션") },
  { value: 'Adventure', label: tr("모험") },
  { value: 'Drama', label: tr("드라마") },
  { value: 'Sci-Fi', label: 'SF' },
  { value: 'Mystery', label: tr("미스터리") },
  { value: 'Comedy', label: tr("코미디") },
  { value: 'Supernatural', label: tr("초자연") },
  { value: 'Fantasy', label: tr("판타지") },
  { value: 'Sports', label: tr("스포츠") },
  { value: 'Romance', label: tr("로맨스") },
  { value: 'Slice of Life', label: tr("일상") },
  { value: 'Horror', label: tr("호러") },
  { value: 'Psychological', label: tr("심리") },
  { value: 'Thriller', label: tr("스릴러") },
  { value: 'Ecchi', label: tr("에치") },
  { value: 'Mecha', label: tr("메카") },
  { value: 'Music', label: tr("음악") },
  { value: 'Mahou Shoujo', label: tr("마법소녀") },
  { value: 'Hentai', label: tr("헨타이") },
]

type AnimeSearchItemResponse = AnimeListItem & {
  my_collection?: RawMyCollection
  myCollection?: RawMyCollection
}

type RawMyCollection = {
  exists?: boolean | string | number | null
  status?: string | null
  score?: number | string | null
  progress?: number | string | null
}

function getApiBaseUrl() {
  const baseUrl = import.meta.env.VITE_API_BASE_URL

  if (!baseUrl) {
    throw new Error(tr("VITE_API_BASE_URL이 설정되지 않았습니다."))
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
  return item.titles.korean?.find((title) => title.isPrimary)?.fullTitle || item.title
}

export function getPrimaryPoster(item: { coverImageExtraLarge?: string | null; coverImageLarge: string }) {
  return item.coverImageExtraLarge || item.coverImageLarge
}

export function getGenreLabel(genre?: string | null) {
  if (!genre) {
    return tr("정보 없음")
  }

  return genreOptions.find((option) => option.value === genre)?.label ?? genre
}

function normalizeBoolean(value: boolean | string | number | null | undefined) {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    return value > 0
  }

  if (typeof value === 'string') {
    return value.toLowerCase() === 'true' || value === '1'
  }

  return false
}

function normalizeNullableNumber(value: number | string | null | undefined) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function normalizeMyCollection(collection: RawMyCollection | null | undefined) {
  if (!collection) {
    return undefined
  }

  return {
    exists: normalizeBoolean(collection.exists),
    status: collection.status ?? null,
    score: normalizeNullableNumber(collection.score),
    progress: normalizeNullableNumber(collection.progress),
  }
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
  url.searchParams.set('titleLanguage', getTitleLanguage())
  url.searchParams.set('limit', String(params.limit))

  if (params.genre) {
    url.searchParams.set('genre', params.genre)
  }

  if (params.cursor) {
    url.searchParams.set('cursor', params.cursor)
  }

  const response = await authFetch(url.toString(), { signal: params.signal })

  if (!response.ok) {
    throw new Error(tr("애니 목록을 불러오지 못했습니다. ({{v0}})", { v0: response.status }))
  }

  const data = (await response.json()) as AnimeListResponse

  return {
    ...data,
    items: data.items.filter((item) => item.coverImageExtraLarge || item.coverImageLarge),
  }
}

export async function fetchAnimeSeries(params: {
  scope: AnimeSeriesScope
  sort: AnimeSort
  titleLanguage: 'ko' | 'en' | 'ja'
  limit: number
  query?: string
  genre?: AnimeGenre | null
  cursor?: string | null
  signal?: AbortSignal
}) {
  const url = new URL('/api/anime/series', getApiBaseUrl())
  url.searchParams.set('scope', params.scope)
  url.searchParams.set('sort', params.sort)
  url.searchParams.set('titleLanguage', params.titleLanguage)
  url.searchParams.set('limit', String(params.limit))

  if (params.query?.trim()) url.searchParams.set('query', params.query.trim())
  if (params.genre) url.searchParams.set('genre', params.genre)
  if (params.cursor) url.searchParams.set('cursor', params.cursor)

  const response = await authFetch(url.toString(), { signal: params.signal })
  if (!response.ok) throw new Error(tr("시리즈 목록을 불러오지 못했습니다. ({{v0}})", { v0: response.status }))

  return response.json() as Promise<AnimeSeriesListResponse>
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
    throw new Error(tr("애니 검색에 실패했습니다. ({{v0}})", { v0: response.status }))
  }

  const data = (await response.json()) as AnimeListResponse

  return {
    ...data,
    items: data.items.filter((item) => item.coverImageExtraLarge || item.coverImageLarge),
  }
}

export async function searchAnimeWithRelations(params: {
  query: string
  relationType?: AnimeRelationType | null
  titleLanguage?: 'ko' | 'en' | 'ja'
  sort?: AnimeSort
  genre?: AnimeGenre | null
  limit?: number
  cursor?: string | null
  signal?: AbortSignal
}) {
  const url = new URL('/api/anime/search-with-relations', getApiBaseUrl())
  url.searchParams.set('query', params.query)
  url.searchParams.set('titleLanguage', params.titleLanguage ?? getTitleLanguage())
  url.searchParams.set('sort', params.sort ?? 'popularity')
  url.searchParams.set('limit', String(params.limit ?? 20))

  if (params.relationType) {
    url.searchParams.set('relationType', params.relationType)
  }

  if (params.genre) {
    url.searchParams.set('genre', params.genre)
  }

  if (params.cursor) {
    url.searchParams.set('cursor', params.cursor)
  }

  const response = await authFetch(url.toString(), { signal: params.signal })

  if (!response.ok) {
    throw new Error(tr("연관 작품을 불러오지 못했습니다. ({{v0}})", { v0: response.status }))
  }

  return (await response.json()) as AnimeSearchWithRelationsResponse
}

export async function searchMyAnime(params: {
  query: string
  sort: AnimeSort
  genre?: AnimeGenre | null
  titleLanguage: 'ko' | 'en' | 'ja'
  limit: number
  cursor?: string | null
  signal?: AbortSignal
}) {
  const url = new URL('/api/me/anime/search', getApiBaseUrl())
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
    throw new Error(tr("내 컬렉션 정보가 포함된 애니 검색에 실패했습니다. ({{v0}})", { v0: response.status }))
  }

  const data = (await response.json()) as AnimeListResponse & {
    items: AnimeSearchItemResponse[]
  }

  const items = data.items as AnimeSearchItemResponse[]
  const normalizedItems = items
    .map((item) => ({
      ...item,
      myCollection: normalizeMyCollection(item.myCollection ?? item.my_collection),
    }))
    .filter((item) => item.coverImageExtraLarge || item.coverImageLarge)

  if (import.meta.env.DEV) {
    console.debug(
      '[Explore] /api/me/anime/search myCollection',
      normalizedItems.map((item) => ({
        id: item.id,
        title: getDisplayTitle(item),
        myCollection: item.myCollection,
      })),
    )
  }

  return {
    ...data,
    items: normalizedItems,
  }
}

export async function fetchPopularAnime(params: { limit?: number; signal?: AbortSignal } = {}) {
  const url = new URL('/api/stats/platform/popular-anime', getApiBaseUrl())

  if (params.limit !== undefined) {
    url.searchParams.set('limit', String(params.limit))
  }

  const response = await fetch(url.toString(), { signal: params.signal })

  if (!response.ok) {
    throw new Error(tr("인기 애니를 불러오지 못했습니다. ({{v0}})", { v0: response.status }))
  }

  const data = (await response.json()) as PopularAnimeResponse
  return data.items.filter((item) => item.coverImageExtraLarge || item.coverImageLarge)
}

export async function fetchAnimeDetail(id: string, signal?: AbortSignal) {
  const url = new URL(`/api/anime/${id}`, getApiBaseUrl())
  url.searchParams.set('titleLanguage', getTitleLanguage())

  const response = await authFetch(url.toString(), { signal })

  if (response.status === 404) {
    throw new Error(tr("해당 애니를 찾을 수 없어요."))
  }

  if (response.status === 400) {
    throw new Error(tr("잘못된 요청으로 애니 정보를 불러오지 못했어요."))
  }

  if (!response.ok) {
    throw new Error(tr("애니 상세 정보를 불러오지 못했습니다. ({{v0}})", { v0: response.status }))
  }

  const data = (await response.json()) as AnimeDetailResponse
  return data.item
}

export async function fetchAnimeCast(params: {
  animeId: number | string
  role?: AnimeCastRole
  limit?: number
  voiceLanguage?: AnimeCastVoiceLanguage
  signal?: AbortSignal
}) {
  const url = new URL(`/api/anime/${params.animeId}/cast`, getApiBaseUrl())
  url.searchParams.set('role', params.role ?? 'MAIN')
  url.searchParams.set('limit', String(params.limit ?? 20))

  if (params.voiceLanguage) {
    url.searchParams.set('voiceLanguage', params.voiceLanguage)
  }

  const response = await authFetch(url.toString(), { signal: params.signal })

  if (response.status === 404) {
    throw new Error(tr("해당 애니를 찾을 수 없어요."))
  }

  if (!response.ok) {
    throw new Error(tr("캐릭터/성우 정보를 불러오지 못했습니다. ({{v0}})", { v0: response.status }))
  }

  const data = (await response.json()) as AnimeCastResponse
  return data.items ?? []
}
