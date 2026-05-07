import type { AnimeGenre, AnimeListItem, AnimeSort } from '../types/anime'
import type { UserAnimeListItem, UserAnimeListSort } from '../types/collection'

type ExploreViewSnapshot = {
  sort: AnimeSort
  genre: AnimeGenre | 'all'
  searchTerm: string
  debouncedSearchTerm: string
  searchLanguage: 'ko' | 'en'
  animeItems: AnimeListItem[]
  nextCursor: string | null
  hasNext: boolean
  requestKey: string
  scrollY: number
}

type CollectionViewSnapshot = {
  sort: UserAnimeListSort
  genre: AnimeGenre | 'all'
  searchTerm: string
  items: UserAnimeListItem[]
  nextCursor: string | null
  hasNext: boolean
  requestKey: string
  scrollY: number
}

const EXPLORE_VIEW_STATE_KEY = 'myanitrack:explore-view-state'
const COLLECTION_VIEW_STATE_KEY = 'myanitrack:collection-view-state'

function loadSnapshot<T>(key: string) {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.sessionStorage.getItem(key)

    if (!raw) {
      return null
    }

    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function saveSnapshot<T>(key: string, snapshot: T) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.sessionStorage.setItem(key, JSON.stringify(snapshot))
  } catch {
    return
  }
}

export function loadExploreViewSnapshot() {
  return loadSnapshot<ExploreViewSnapshot>(EXPLORE_VIEW_STATE_KEY)
}

export function saveExploreViewSnapshot(snapshot: ExploreViewSnapshot) {
  saveSnapshot(EXPLORE_VIEW_STATE_KEY, snapshot)
}

export function loadCollectionViewSnapshot() {
  return loadSnapshot<CollectionViewSnapshot>(COLLECTION_VIEW_STATE_KEY)
}

export function saveCollectionViewSnapshot(snapshot: CollectionViewSnapshot) {
  saveSnapshot(COLLECTION_VIEW_STATE_KEY, snapshot)
}
