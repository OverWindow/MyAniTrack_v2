import type { AnimeGenre, AnimeListItem, AnimeListResponse } from '../types/anime'
import type { AnimeDetailItem } from '../types/anime'
import type { UserAnimeListItem, UserAnimeListResponse, UserAnimeListSort } from '../types/collection'
import type {
  AnimeStatsItem,
  FormatDistributionStats,
  GenreBubbleResponse,
  StudioRankingSort,
  StudioRankingResponse,
  YearlyScoreStats,
} from '../types/stats'
import { normalizeStatsItem } from './stats'

function getApiBaseUrl() {
  const baseUrl = import.meta.env.VITE_API_BASE_URL

  if (!baseUrl) {
    throw new Error('VITE_API_BASE_URL이 설정되지 않았습니다.')
  }

  return baseUrl
}

function getItem<T>(payload: unknown): T {
  if (payload && typeof payload === 'object' && 'item' in payload) {
    return (payload as { item: T }).item
  }

  return payload as T
}

function createSampleCoverDataUri(title: string) {
  const safeTitle = title.replace(/[<&>]/g, '')
  const hue = Array.from(safeTitle).reduce((sum, character) => sum + character.charCodeAt(0), 0) % 360
  const accent = `hsl(${hue} 72% 42%)`
  const secondary = `hsl(${(hue + 56) % 360} 58% 28%)`
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1080" viewBox="0 0 720 1080">',
    '<defs>',
    `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${accent}"/><stop offset="1" stop-color="${secondary}"/></linearGradient>`,
    '<radialGradient id="glow" cx="50%" cy="18%" r="70%"><stop offset="0" stop-color="white" stop-opacity=".3"/><stop offset="1" stop-color="white" stop-opacity="0"/></radialGradient>',
    '</defs>',
    '<rect width="720" height="1080" fill="url(#bg)"/>',
    '<rect width="720" height="1080" fill="url(#glow)"/>',
    '<path d="M58 780 C184 620 286 700 380 560 C478 414 564 472 662 338 L662 1080 L58 1080 Z" fill="rgba(255,255,255,.18)"/>',
    '<path d="M0 185 C150 118 260 250 398 184 C508 132 610 128 720 172 L720 0 L0 0 Z" fill="rgba(255,255,255,.13)"/>',
    '<text x="58" y="768" fill="white" font-family="Arial, sans-serif" font-size="50" font-weight="800">',
    safeTitle,
    '</text>',
    '<text x="58" y="832" fill="rgba(255,255,255,.78)" font-family="Arial, sans-serif" font-size="28" font-weight="700">MyAniTrack sample</text>',
    '</svg>',
  ].join('')

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

function withSampleCover(item: UserAnimeListItem): UserAnimeListItem {
  const title = item.anime.titles?.korean || item.anime.titles?.english || item.anime.title
  const coverImage = item.anime.coverImageExtraLarge || item.anime.coverImageLarge || createSampleCoverDataUri(title)

  return {
    ...item,
    anime: {
      ...item.anime,
      coverImageLarge: item.anime.coverImageLarge || coverImage,
      coverImageExtraLarge: item.anime.coverImageExtraLarge || coverImage,
      bannerImage: item.anime.bannerImage || coverImage,
    },
  }
}

function getItemsResponse(payload: unknown): UserAnimeListResponse {
  if (payload && typeof payload === 'object' && 'items' in payload && 'pageInfo' in payload) {
    const response = payload as UserAnimeListResponse

    return {
      ...response,
      items: response.items.map(withSampleCover),
    }
  }

  throw new Error('샘플 컬렉션 응답 형식이 올바르지 않아요.')
}

async function fetchAnimeCatalogPage(cursor?: string | null) {
  const url = new URL('/api/anime', getApiBaseUrl())
  url.searchParams.set('sort', 'popularity')
  url.searchParams.set('titleLanguage', 'ko')
  url.searchParams.set('limit', '50')

  if (cursor) {
    url.searchParams.set('cursor', cursor)
  }

  const response = await fetch(url.toString())

  if (!response.ok) {
    throw new Error(`애니 목록을 불러오지 못했습니다. (${response.status})`)
  }

  return response.json() as Promise<AnimeListResponse>
}

async function getAnimeMatchesByAniListId(anilistIds: number[]) {
  const remainingIds = new Set(anilistIds)
  const matches = new Map<number, AnimeListItem>()
  let cursor: string | null | undefined = null

  for (let page = 0; page < 8 && remainingIds.size > 0; page += 1) {
    const response = await fetchAnimeCatalogPage(cursor)

    for (const item of response.items) {
      if (remainingIds.has(item.anilistId)) {
        matches.set(item.anilistId, item)
        remainingIds.delete(item.anilistId)
      }
    }

    if (!response.pageInfo.hasNext || !response.pageInfo.nextCursor) {
      break
    }

    cursor = response.pageInfo.nextCursor
  }

  return matches
}

async function enrichSampleResponse(response: UserAnimeListResponse) {
  const anilistIds = Array.from(new Set(response.items.map((item) => item.anime.anilistId)))
  const matches = await getAnimeMatchesByAniListId(anilistIds)

  return {
    ...response,
    items: response.items.map((item) => {
      const match = matches.get(item.anime.anilistId)

      if (!match) {
        return withSampleCover(item)
      }

      return {
        ...item,
        animeId: match.id,
        anime: {
          ...item.anime,
          ...match,
          titles: {
            ...item.anime.titles,
            ...match.titles,
          },
        },
      }
    }),
  }
}

async function fetchSampleJson(path: string, signal?: AbortSignal) {
  const response = await fetch(new URL(path, getApiBaseUrl()).toString(), { signal })

  if (!response.ok) {
    throw new Error(`샘플 데이터를 불러오지 못했습니다. (${response.status})`)
  }

  return response.json() as Promise<unknown>
}

export type SampleOverview = {
  collection: UserAnimeListResponse
  stats: AnimeStatsItem
  genreBubble: GenreBubbleResponse['item']
  yearlyScores: YearlyScoreStats
  formatDistribution: FormatDistributionStats
  studios?: StudioRankingResponse
}

export async function fetchSampleOverview(signal?: AbortSignal): Promise<SampleOverview> {
  const payload = await fetchSampleJson('/api/sample/overview', signal)
  const overview = payload && typeof payload === 'object' && 'item' in payload
    ? (payload as { item: Record<string, unknown> }).item
    : payload as Record<string, unknown>

  return {
    collection: await enrichSampleResponse(getItemsResponse(overview.collection)),
    stats: normalizeStatsItem(getItem(overview.stats)),
    genreBubble: getItem<GenreBubbleResponse['item']>(overview.genreBubble),
    yearlyScores: getItem<YearlyScoreStats>(overview.yearlyScores),
    formatDistribution: getItem<FormatDistributionStats>(overview.formatDistribution),
    studios: overview.studios ? getItem<StudioRankingResponse>(overview.studios) : undefined,
  }
}

export async function fetchSampleCollection(params: {
  sort?: UserAnimeListSort
  limit?: number
  genre?: AnimeGenre | string | null
  year?: number | string | null
  score?: number | string | null
  cursor?: string | null
  signal?: AbortSignal
} = {}) {
  const url = new URL('/api/sample/anime-list', getApiBaseUrl())
  url.searchParams.set('sort', params.sort ?? 'latest')
  url.searchParams.set('titleLanguage', 'ko')
  url.searchParams.set('limit', String(params.limit ?? 50))

  if (params.genre) {
    url.searchParams.set('genre', String(params.genre))
  }

  if (params.year) {
    url.searchParams.set('year', String(params.year))
  }

  if (params.score) {
    url.searchParams.set('score', String(params.score))
  }

  if (params.cursor) {
    url.searchParams.set('cursor', params.cursor)
  }

  const response = await fetch(url.toString(), { signal: params.signal })

  if (!response.ok) {
    throw new Error(`샘플 컬렉션을 불러오지 못했습니다. (${response.status})`)
  }

  return enrichSampleResponse(getItemsResponse(await response.json()))
}

export async function fetchSampleStudioRanking(params: {
  sort?: StudioRankingSort
  limit?: number
  signal?: AbortSignal
} = {}) {
  const url = new URL('/api/sample/anime-stats/studios', getApiBaseUrl())
  url.searchParams.set('sort', params.sort ?? 'count')
  url.searchParams.set('limit', String(params.limit ?? 12))

  const response = await fetch(url.toString(), { signal: params.signal })

  if (!response.ok) {
    throw new Error(`샘플 스튜디오 랭킹을 불러오지 못했습니다. (${response.status})`)
  }

  return getItem<StudioRankingResponse>(await response.json())
}

export function createSampleAnimeDetail(item: UserAnimeListItem): AnimeDetailItem {
  const title = item.anime.titles?.korean || item.anime.titles?.english || item.anime.title

  return {
    id: item.anime.id,
    anilistId: item.anime.anilistId,
    title,
    titles: {
      korean: [{
        title,
        subtitle: null,
        fullTitle: title,
        isPrimary: true,
      }],
      english: item.anime.titles?.english ?? null,
      native: item.anime.titles?.native ?? null,
      romaji: item.anime.titles?.romaji ?? null,
      userPreferred: item.anime.titles?.userPreferred ?? null,
    },
    episodes: item.anime.episodes ?? null,
    duration: item.anime.duration ?? null,
    season: item.anime.season ?? null,
    seasonYear: item.anime.seasonYear ?? null,
    format: item.anime.format ?? null,
    status: item.anime.status ?? null,
    source: 'Sample',
    countryOfOrigin: 'JP',
    isAdult: item.anime.isAdult ?? false,
    averageScore: item.anime.averageScore ?? null,
    meanScore: item.anime.meanScore ?? null,
    popularity: item.anime.popularity ?? null,
    favourites: item.anime.favourites ?? null,
    coverImageLarge: item.anime.coverImageLarge,
    coverImageExtraLarge: item.anime.coverImageExtraLarge,
    bannerImage: item.anime.bannerImage ?? item.anime.coverImageExtraLarge ?? item.anime.coverImageLarge,
    siteUrl: item.anime.siteUrl ?? null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    sourceUpdatedAt: item.updatedAt,
    description: '샘플 컬렉션 미리보기에 사용되는 작품 정보입니다. 로그인하면 실제 컬렉션 기록과 함께 더 자세한 정보를 확인할 수 있어요.',
    genres: [],
    tags: [],
    synonyms: [item.anime.title, item.anime.titles?.english, item.anime.titles?.romaji].filter(Boolean) as string[],
  }
}
