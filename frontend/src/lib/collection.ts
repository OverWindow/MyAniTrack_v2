import { authFetch, getStoredSession } from './auth'
import type { AnimeGenre } from '../types/anime'
import type {
  UserAnimeListEntry,
  UserAnimeListEntryResponse,
  UserAnimeListPayload,
  UserAnimeListResponse,
  UserAnimeListSort,
} from '../types/collection'

const COLLECTION_STORAGE_KEY_PREFIX = 'myanitrack.collection.cache'
const COLLECTION_PAGE_STORAGE_KEY_PREFIX = 'myanitrack.collection.page-cache'
export const COLLECTION_CACHE_UPDATED_EVENT = 'myanitrack:collection-cache-updated'

function getApiBaseUrl() {
  const baseUrl = import.meta.env.VITE_API_BASE_URL

  if (!baseUrl) {
    throw new Error('VITE_API_BASE_URL이 설정되지 않았습니다.')
  }

  return baseUrl
}

function createUrl(path: string) {
  return new URL(path, getApiBaseUrl()).toString()
}

function getCollectionStorageKey() {
  const session = getStoredSession()
  const userId = session?.user?.id

  return userId
    ? `${COLLECTION_STORAGE_KEY_PREFIX}:${String(userId)}`
    : `${COLLECTION_STORAGE_KEY_PREFIX}:guest`
}

function getCollectionPageStorageKey(params: {
  sort: UserAnimeListSort
  genre?: AnimeGenre | null
}) {
  const session = getStoredSession()
  const userId = session?.user?.id
  const genreKey = params.genre ?? 'all'

  return userId
    ? `${COLLECTION_PAGE_STORAGE_KEY_PREFIX}:${String(userId)}:${params.sort}:${genreKey}`
    : `${COLLECTION_PAGE_STORAGE_KEY_PREFIX}:guest:${params.sort}:${genreKey}`
}

function dispatchCollectionCacheUpdated(animeId?: number) {
  window.dispatchEvent(
    new CustomEvent(COLLECTION_CACHE_UPDATED_EVENT, {
      detail: {
        animeId,
        storageKey: getCollectionStorageKey(),
      },
    }),
  )
}

export function getCollectionCache() {
  const raw = window.localStorage.getItem(getCollectionStorageKey())

  if (!raw) {
    return {} as Record<number, UserAnimeListEntry>
  }

  try {
    return JSON.parse(raw) as Record<number, UserAnimeListEntry>
  } catch {
    window.localStorage.removeItem(getCollectionStorageKey())
    return {} as Record<number, UserAnimeListEntry>
  }
}

function saveCollectionCache(cache: Record<number, UserAnimeListEntry>) {
  window.localStorage.setItem(getCollectionStorageKey(), JSON.stringify(cache))
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

export function getCachedCollectionEntry(animeId: number) {
  return getCollectionCache()[animeId] ?? null
}

export function getCachedCollectionPage(params: {
  sort: UserAnimeListSort
  genre?: AnimeGenre | null
}) {
  const raw = window.localStorage.getItem(getCollectionPageStorageKey(params))

  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as UserAnimeListResponse
  } catch {
    window.localStorage.removeItem(getCollectionPageStorageKey(params))
    return null
  }
}

export function saveCollectionPageCache(
  params: {
    sort: UserAnimeListSort
    genre?: AnimeGenre | null
  },
  data: UserAnimeListResponse,
) {
  window.localStorage.setItem(getCollectionPageStorageKey(params), JSON.stringify(data))
}

function updateCachedCollectionEntry(entry: UserAnimeListEntry) {
  const cache = getCollectionCache()
  cache[entry.animeId] = entry
  saveCollectionCache(cache)
  dispatchCollectionCacheUpdated(entry.animeId)
}

export function removeCachedCollectionEntry(animeId: number) {
  const cache = getCollectionCache()
  delete cache[animeId]
  saveCollectionCache(cache)
  dispatchCollectionCacheUpdated(animeId)
}

export function syncCollectionCacheFromSearchItems(
  items: Array<{
    id: number
    myCollection?: {
      exists: boolean
      status: string | null
      score: number | null
      progress: number | null
    }
  }>,
) {
  const cache = getCollectionCache()
  let didChange = false

  for (const item of items) {
    const collection = item.myCollection

    if (!collection) {
      continue
    }

    if (!collection.exists) {
      if (cache[item.id]) {
        delete cache[item.id]
        didChange = true
      }

      continue
    }

    cache[item.id] = {
      ...cache[item.id],
      animeId: item.id,
      status: (collection.status as UserAnimeListEntry['status'] | null) ?? cache[item.id]?.status ?? 'planned',
      score: normalizeNullableNumber(collection.score),
      progress: normalizeNullableNumber(collection.progress),
    }
    didChange = true
  }

  if (didChange) {
    saveCollectionCache(cache)
    dispatchCollectionCacheUpdated()
  }
}

function normalizePayload(payload: UserAnimeListPayload) {
  return {
    animeId: payload.animeId,
    status: payload.status ?? 'planned',
    ...(payload.score !== undefined ? { score: payload.score } : {}),
    ...(payload.progress !== undefined ? { progress: payload.progress } : {}),
    ...(payload.startedAt !== undefined ? { startedAt: payload.startedAt } : {}),
    ...(payload.completedAt !== undefined ? { completedAt: payload.completedAt } : {}),
    ...(payload.notes ? { notes: payload.notes } : {}),
  }
}

function getErrorMessage(status: number, fallback: string) {
  if (status === 400) {
    return '입력 형식이 올바르지 않아요.'
  }

  if (status === 401) {
    return '로그인이 필요해요.'
  }

  if (status === 404) {
    return '애니를 찾을 수 없어요.'
  }

  if (status === 409) {
    return '이미 컬렉션에 추가된 작품이에요.'
  }

  if (status >= 500) {
    return '서버 오류가 발생했어요. 잠시 후 다시 시도해주세요.'
  }

  return fallback
}

function isCollectionEntry(value: unknown): value is UserAnimeListEntry {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<UserAnimeListEntry>
  return typeof candidate.animeId === 'number' && typeof candidate.status === 'string'
}

function extractCollectionEntry(payload: unknown) {
  if (isCollectionEntry(payload)) {
    return payload
  }

  if (
    payload &&
    typeof payload === 'object' &&
    'item' in payload &&
    isCollectionEntry((payload as { item?: unknown }).item)
  ) {
    return (payload as { item: UserAnimeListEntry }).item
  }

  throw new Error('컬렉션 응답 형식이 올바르지 않아요.')
}

export async function addToCollection(payload: UserAnimeListPayload) {
  const response = await authFetch(createUrl('/api/me/anime-list'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(normalizePayload(payload)),
  })

  if (!response.ok) {
    throw new Error(getErrorMessage(response.status, '컬렉션 추가에 실패했어요.'))
  }

  const entry = extractCollectionEntry(await response.json())
  updateCachedCollectionEntry(entry)
  return entry
}

export async function updateCollectionEntry(
  animeId: number,
  payload: Omit<UserAnimeListPayload, 'animeId'>,
) {
  const response = await authFetch(createUrl(`/api/me/anime-list/${animeId}`), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...(payload.status !== undefined ? { status: payload.status } : {}),
      ...(payload.score !== undefined ? { score: payload.score } : {}),
      ...(payload.progress !== undefined ? { progress: payload.progress } : {}),
      ...(payload.startedAt !== undefined ? { startedAt: payload.startedAt } : {}),
      ...(payload.completedAt !== undefined ? { completedAt: payload.completedAt } : {}),
      ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
    }),
  })

  if (!response.ok) {
    throw new Error(getErrorMessage(response.status, '컬렉션 수정에 실패했어요.'))
  }

  const entry = extractCollectionEntry(await response.json())
  updateCachedCollectionEntry(entry)
  return entry
}

export async function deleteCollectionEntry(animeId: number) {
  const response = await authFetch(createUrl(`/api/me/anime-list/${animeId}`), {
    method: 'DELETE',
  })

  if (!response.ok) {
    throw new Error(getErrorMessage(response.status, '컬렉션 삭제에 실패했어요.'))
  }

  removeCachedCollectionEntry(animeId)
}

export async function fetchMyCollectionEntry(animeId: number, signal?: AbortSignal) {
  const url = new URL(`/api/me/anime-list/${animeId}`, getApiBaseUrl())
  url.searchParams.set('titleLanguage', 'ko')

  const response = await authFetch(url.toString(), { signal })

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error(getErrorMessage(response.status, '내 기록을 불러오지 못했어요.'))
  }

  const data = (await response.json()) as UserAnimeListEntryResponse

  if (!data.item) {
    return null
  }

  const entry = {
    animeId: data.item.animeId,
    status: data.item.status,
    score: normalizeNullableNumber(data.item.score),
    progress: normalizeNullableNumber(data.item.progress),
    startedAt: data.item.startedAt,
    completedAt: data.item.completedAt,
    notes: data.item.notes,
  }

  updateCachedCollectionEntry(entry)
  return {
    ...data.item,
    score: entry.score,
    progress: entry.progress,
  }
}

export async function fetchMyCollection(params: {
  sort: UserAnimeListSort
  limit: number
  genre?: AnimeGenre | null
  cursor?: string | null
  signal?: AbortSignal
}) {
  const url = new URL('/api/me/anime-list', getApiBaseUrl())
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
    throw new Error(getErrorMessage(response.status, '컬렉션 목록을 불러오지 못했어요.'))
  }

  const data = (await response.json()) as UserAnimeListResponse
  const filteredItems = data.items.filter(
    (item) => item.anime.coverImageExtraLarge || item.anime.coverImageLarge,
  )

  const cache = getCollectionCache()

  for (const item of filteredItems) {
    cache[item.animeId] = {
      animeId: item.animeId,
      status: item.status,
      score: normalizeNullableNumber(item.score),
      progress: normalizeNullableNumber(item.progress),
      startedAt: item.startedAt,
      completedAt: item.completedAt,
      notes: item.notes,
    }
  }

  saveCollectionCache(cache)
  saveCollectionPageCache(
    {
      sort: params.sort,
      genre: params.genre,
    },
    {
      ...data,
      items: filteredItems,
    },
  )
  dispatchCollectionCacheUpdated()

  return {
    ...data,
    items: filteredItems,
  }
}
