import type { AuthUser } from '../types/auth'
import type { RecapAssetMap, RecapData, RecapScene } from '../types/recap'
import type { AnimeStatsItem, FormatDistributionStats, GenreBubbleResponse, ViewingDnaItem } from '../types/stats'
import { getAnalysisCache, getAnalysisCacheKey, setAnalysisCache } from './analysisCache'
import { fetchMyCollection } from './collection'
import {
  fetchFormatDistributionStats,
  fetchGenreBubbleStats,
  fetchMyAnimeStats,
  fetchViewingDnaStats,
} from './stats'

async function cachedOrFetch<T>(cacheKey: string, fetcher: () => Promise<T>) {
  const cached = await getAnalysisCache<T>(cacheKey)

  if (cached) {
    return cached
  }

  const value = await fetcher()
  await setAnalysisCache(cacheKey, value)
  return value
}

export async function fetchRecapData(user: AuthUser, signal?: AbortSignal): Promise<RecapData> {
  const userId = user.id
  const statsPromise = cachedOrFetch<AnimeStatsItem>(
    getAnalysisCacheKey(userId, 'myStats'),
    () => fetchMyAnimeStats(signal),
  )
  const viewingDnaPromise = cachedOrFetch<ViewingDnaItem>(
    getAnalysisCacheKey(userId, 'viewingDna', 'series-completion-v2'),
    () => fetchViewingDnaStats({ signal }),
  )
  const genreBubblePromise = cachedOrFetch<GenreBubbleResponse['item']>(
    getAnalysisCacheKey(userId, 'genreBubble'),
    () => fetchGenreBubbleStats({ signal }),
  )
  const formatPromise = cachedOrFetch<FormatDistributionStats>(
    getAnalysisCacheKey(userId, 'formatDistribution'),
    () => fetchFormatDistributionStats({ signal }),
  )
  const favoritesPromise = fetchMyCollection({ sort: 'score', score: 10, limit: 12, signal })

  const [stats, viewingDna, genreBubble, formatDistribution, favorites] = await Promise.allSettled([
    statsPromise,
    viewingDnaPromise,
    genreBubblePromise,
    formatPromise,
    favoritesPromise,
  ])

  if (stats.status === 'rejected') {
    throw stats.reason
  }

  return {
    user,
    stats: stats.value,
    favorites: favorites.status === 'fulfilled' ? favorites.value.items : [],
    viewingDna: viewingDna.status === 'fulfilled' ? viewingDna.value : null,
    genreBubble: genreBubble.status === 'fulfilled' ? genreBubble.value : null,
    formatDistribution: formatDistribution.status === 'fulfilled' ? formatDistribution.value : null,
  }
}

export function getRecapScenes(hasFavorites: boolean): RecapScene[] {
  return [
    { key: 'cover', label: '표지' },
    { key: 'totals', label: '감상 기록' },
    ...(hasFavorites ? [{ key: 'favorites' as const, label: '최애 애니' }] : []),
    { key: 'dna', label: '감상 DNA' },
    { key: 'genre', label: '장르 취향' },
    { key: 'series', label: '시리즈와 포맷' },
    { key: 'closing', label: '공유 카드' },
  ]
}

export function getRecapImageUrl(item: RecapData['favorites'][number]) {
  return item.anime.coverImageExtraLarge || item.anime.coverImageLarge || null
}

export function getRecapAnimeTitle(item: RecapData['favorites'][number]) {
  return item.anime.titles?.korean || item.anime.titles?.english || item.anime.title
}

export async function imageUrlToDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { mode: 'cors' })

    if (!response.ok) {
      return null
    }

    const blob = await response.blob()

    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

export async function prepareRecapAssets(data: RecapData): Promise<RecapAssetMap> {
  const urls = [
    data.user.profileImageUrl ?? null,
    ...data.favorites.map(getRecapImageUrl),
  ].filter((url): url is string => Boolean(url))
  const uniqueUrls = Array.from(new Set(urls))
  const resolved = await Promise.all(uniqueUrls.map(async (url) => [url, await imageUrlToDataUrl(url)] as const))

  return Object.fromEntries(resolved)
}
