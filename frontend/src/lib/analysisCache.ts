import { getTitleLanguage, tr } from '../i18n'
import type {
  AnimeStatsItem,
  FormatDistributionStats,
  GenreBubbleResponse,
  StudioAnimeResponse,
  StudioRankingResponse,
  StudioRankingSort,
  VoiceActorAnimeResponse,
  VoiceActorRankingItem,
  ViewingDnaItem,
  YearlyScoreStats,
} from '../types/stats'
import type { UserAnimeListItem } from '../types/collection'

const DB_NAME = 'myanitrack-analysis-cache'
const DB_VERSION = 1
const STORE_NAME = 'entries'
const VIEW_STATE_KEY_PREFIX = 'myanitrack.analysis.view'
const STUDIO_SORT_KEY_PREFIX = 'myanitrack.analysis.studio-sort'

type AnalysisCacheEntry<T> = {
  key: string
  value: T
  updatedAt: number
}

export type AnalysisViewState = {
  activeTab?: 'genre' | 'year' | 'score'
  selectedGenre?: string | null
  selectedYear?: string | null
  selectedScore?: string | null
}

export type AnalysisCachePayloadMap = {
  myStats: AnimeStatsItem
  genreBubble: GenreBubbleResponse['item']
  yearlyScores: YearlyScoreStats
  formatDistribution: FormatDistributionStats
  viewingDna: ViewingDnaItem
  studioRanking: StudioRankingResponse
  studioAnime: StudioAnimeResponse
  voiceActorRanking: {
    count: VoiceActorRankingItem[]
    score: VoiceActorRankingItem[]
  }
  voiceActorAnime: VoiceActorAnimeResponse
  filteredAnime: UserAnimeListItem[]
}

let dbPromise: Promise<IDBDatabase> | null = null

function openAnalysisDb() {
  if (dbPromise) {
    return dbPromise
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error(tr("분석 캐시를 열지 못했어요.")))
  })

  return dbPromise
}

function runEntryStoreTransaction<T>(
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T> | void,
) {
  return openAnalysisDb().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, mode)
        const store = transaction.objectStore(STORE_NAME)
        const request = callback(store)
        let result: T | undefined

        if (request) {
          request.onsuccess = () => {
            result = request.result
          }
          request.onerror = () => reject(request.error ?? new Error(tr("분석 캐시 작업에 실패했어요.")))
        }

        transaction.oncomplete = () => resolve(result)
        transaction.onerror = () => reject(transaction.error ?? new Error(tr("분석 캐시 작업에 실패했어요.")))
      }),
  )
}

export async function getAnalysisCache<T>(key: string) {
  if (!window.indexedDB) {
    return null
  }

  try {
    const entry = await runEntryStoreTransaction<AnalysisCacheEntry<T> | undefined>(
      'readonly',
      (store) => store.get(key) as IDBRequest<AnalysisCacheEntry<T> | undefined>,
    )

    return entry?.value ?? null
  } catch {
    return null
  }
}

export async function setAnalysisCache<T>(key: string, value: T) {
  if (!window.indexedDB) {
    return
  }

  try {
    await runEntryStoreTransaction('readwrite', (store) => {
      store.put({ key, value, updatedAt: Date.now() } satisfies AnalysisCacheEntry<T>)
    })
  } catch {
    // Cache writes are best-effort; the live UI should not fail because storage is unavailable.
  }
}

export async function deleteAnalysisCachePrefix(prefix: string) {
  if (!window.indexedDB) {
    return
  }

  try {
    const db = await openAnalysisDb()

    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.openCursor()

      request.onsuccess = () => {
        const cursor = request.result

        if (!cursor) {
          return
        }

        if (String(cursor.key).startsWith(prefix)) {
          cursor.delete()
        }

        cursor.continue()
      }

      request.onerror = () => reject(request.error ?? new Error(tr("분석 캐시 삭제에 실패했어요.")))
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error(tr("분석 캐시 삭제에 실패했어요.")))
    })
  } catch {
    // Best-effort cache maintenance.
  }
}

export function getAnalysisCacheKey(userId: number | string, name: keyof AnalysisCachePayloadMap, params = '') {
  return `my:${userId}:${getTitleLanguage()}:${name}${params ? `:${params}` : ''}`
}

export function getAnalysisCachePrefix(userId: number | string) {
  return `my:${userId}:`
}

function getViewStateKey(userId: number | string) {
  return `${VIEW_STATE_KEY_PREFIX}:${userId}`
}

export function getAnalysisViewState(userId?: number | string | null): AnalysisViewState | null {
  if (!userId) {
    return null
  }

  try {
    const raw = window.sessionStorage.getItem(getViewStateKey(userId))
    return raw ? JSON.parse(raw) as AnalysisViewState : null
  } catch {
    window.sessionStorage.removeItem(getViewStateKey(userId))
    return null
  }
}

export function saveAnalysisViewState(userId: number | string, state: AnalysisViewState) {
  window.sessionStorage.setItem(getViewStateKey(userId), JSON.stringify(state))
}

function getStudioSortKey(userId: number | string) {
  return `${STUDIO_SORT_KEY_PREFIX}:${userId}`
}

export function getStoredStudioSort(userId?: number | string | null): StudioRankingSort | null {
  if (!userId) {
    return null
  }

  const value = window.localStorage.getItem(getStudioSortKey(userId))

  if (value === 'count' || value === 'score' || value === 'watchTime') {
    return value
  }

  return null
}

export function saveStoredStudioSort(userId: number | string, sort: StudioRankingSort) {
  window.localStorage.setItem(getStudioSortKey(userId), sort)
}
