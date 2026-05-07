import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CollectionButton } from '../components/CollectionButton'
import { useAuth } from '../contexts/AuthContext'
import {
  addToCollection,
  COLLECTION_CACHE_UPDATED_EVENT,
  getCachedCollectionEntry,
  updateCollectionEntry,
} from '../lib/collection'
import {
  fetchAnimeList,
  genreOptions,
  getDisplayTitle,
  getPrimaryPoster,
  searchAnime,
  sortOptions,
} from '../lib/anime'
import { loadExploreViewSnapshot, saveExploreViewSnapshot } from '../lib/viewState'
import type { AnimeGenre, AnimeListItem, AnimeSort } from '../types/anime'
import '../styles/pages/CatalogPage.css'
import '../styles/pages/ExplorePage.css'

type ExploreState = {
  animeItems: AnimeListItem[]
  nextCursor: string | null
  hasNext: boolean
  isLoading: boolean
  isLoadingMore: boolean
  error: string | null
  requestKey: string
}

type HoverRatingProps = {
  animeId: number
  maxProgress?: number | null
}

const createInitialExploreState = (requestKey: string): ExploreState => ({
  animeItems: [],
  nextCursor: null,
  hasNext: false,
  isLoading: true,
  isLoadingMore: false,
  error: null,
  requestKey,
})

function formatFivePointScore(score?: number | null) {
  if (typeof score !== 'number') {
    return null
  }

  return (score / 20).toFixed(1)
}

function getOverlayScore(score?: number | null) {
  if (typeof score !== 'number' || score <= 0) {
    return 0
  }

  return Math.min(10, Math.max(0, score))
}

function getStarFillPercent(score: number, starIndex: number) {
  const scoreInStars = score / 2
  const fill = Math.max(0, Math.min(1, scoreInStars - starIndex))
  return `${fill * 100}%`
}

function HoverRating({ animeId, maxProgress }: HoverRatingProps) {
  const { isAuthenticated, user } = useAuth()
  const [score, setScore] = useState(0)
  const [isAdded, setIsAdded] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) {
      setScore(0)
      setIsAdded(false)
      return
    }

    const syncFromCache = () => {
      const entry = getCachedCollectionEntry(animeId)
      setScore(getOverlayScore(entry?.score))
      setIsAdded(Boolean(entry))
    }

    const handleCollectionUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{ animeId?: number }>
      const updatedAnimeId = customEvent.detail?.animeId

      if (updatedAnimeId && updatedAnimeId !== animeId) {
        return
      }

      syncFromCache()
    }

    syncFromCache()
    window.addEventListener(COLLECTION_CACHE_UPDATED_EVENT, handleCollectionUpdated as EventListener)

    return () => {
      window.removeEventListener(COLLECTION_CACHE_UPDATED_EVENT, handleCollectionUpdated as EventListener)
    }
  }, [animeId, isAuthenticated, user?.id])

  const handleRate = async (nextScore: number, event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()

    if (!isAuthenticated || isSubmitting) {
      return
    }

    setIsSubmitting(true)

    try {
      if (isAdded) {
        await updateCollectionEntry(animeId, {
          status: 'completed',
          score: nextScore,
          ...(maxProgress && maxProgress > 0 ? { progress: maxProgress } : {}),
        })
      } else {
        await addToCollection({
          animeId,
          status: 'completed',
          score: nextScore,
          ...(maxProgress && maxProgress > 0 ? { progress: maxProgress } : {}),
        })
        setIsAdded(true)
      }

      setScore(nextScore)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="anime-hover-rating" aria-label="탐색 빠른 별점">
      <div className="anime-hover-rating-stars">
        {Array.from({ length: 5 }).map((_, index) => {
          const leftValue = index * 2 + 1
          const rightValue = index * 2 + 2

          return (
            <div className="anime-hover-star" key={`${animeId}-star-${index + 1}`}>
              <span className="anime-hover-star-base" aria-hidden="true">★</span>
              <span
                className="anime-hover-star-fill"
                aria-hidden="true"
                style={{ width: getStarFillPercent(score, index) }}
              >
                ★
              </span>
              <button
                className="anime-hover-star-hit is-left"
                type="button"
                aria-label={`${leftValue.toFixed(1)}점 주기`}
                onClick={(event) => {
                  void handleRate(leftValue, event)
                }}
                disabled={isSubmitting}
              />
              <button
                className="anime-hover-star-hit is-right"
                type="button"
                aria-label={`${rightValue.toFixed(1)}점 주기`}
                onClick={(event) => {
                  void handleRate(rightValue, event)
                }}
                disabled={isSubmitting}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ExplorePage() {
  const initialSnapshotRef = useRef(loadExploreViewSnapshot())
  const initialSnapshot = initialSnapshotRef.current
  const [sort, setSort] = useState<AnimeSort>(() => initialSnapshot?.sort ?? 'score')
  const [genre, setGenre] = useState<AnimeGenre | 'all'>(() => initialSnapshot?.genre ?? 'all')
  const [searchTerm, setSearchTerm] = useState(() => initialSnapshot?.searchTerm ?? '')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(() => initialSnapshot?.debouncedSearchTerm ?? '')
  const [searchLanguage, setSearchLanguage] = useState<'ko' | 'en'>(() => initialSnapshot?.searchLanguage ?? 'ko')
  const normalizedQuery = debouncedSearchTerm.trim()
  const selectedGenre = genre === 'all' ? null : genre
  const selectedGenreLabel =
    genre === 'all'
      ? '전체 장르'
      : genreOptions.find((option) => option.value === genre)?.label ?? genre
  const requestKey = `${sort}:${normalizedQuery}:${searchLanguage}:${genre}`
  const hydratedSnapshot = initialSnapshot?.requestKey === requestKey ? initialSnapshot : null
  const [state, setState] = useState<ExploreState>(() => (
    hydratedSnapshot
      ? {
          animeItems: hydratedSnapshot.animeItems,
          nextCursor: hydratedSnapshot.nextCursor,
          hasNext: hydratedSnapshot.hasNext,
          isLoading: false,
          isLoadingMore: false,
          error: null,
          requestKey,
        }
      : createInitialExploreState(requestKey)
  ))
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const latestSnapshotRef = useRef({
    sort,
    genre,
    searchTerm,
    debouncedSearchTerm,
    searchLanguage,
    animeItems: state.animeItems,
    nextCursor: state.nextCursor,
    hasNext: state.hasNext,
    requestKey,
  })
  const shouldSkipInitialFetchRef = useRef(Boolean(hydratedSnapshot))
  const pendingScrollRestoreRef = useRef<number | null>(hydratedSnapshot?.scrollY ?? null)
  const { animeItems, nextCursor, hasNext, isLoading, isLoadingMore, error } = state
  const isRefreshingQuery = state.requestKey !== requestKey

  latestSnapshotRef.current = {
    sort,
    genre,
    searchTerm,
    debouncedSearchTerm,
    searchLanguage,
    animeItems,
    nextCursor,
    hasNext,
    requestKey,
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 550)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [searchTerm])

  useEffect(() => {
    if (!isRefreshingQuery) {
      saveExploreViewSnapshot({
        ...latestSnapshotRef.current,
        scrollY: window.scrollY,
      })
    }
  }, [animeItems, debouncedSearchTerm, genre, hasNext, isRefreshingQuery, nextCursor, requestKey, searchLanguage, searchTerm, sort])

  useEffect(() => {
    const handleScroll = () => {
      saveExploreViewSnapshot({
        ...latestSnapshotRef.current,
        scrollY: window.scrollY,
      })
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (pendingScrollRestoreRef.current === null || isLoading || isRefreshingQuery || animeItems.length === 0) {
      return
    }

    const nextScrollY = pendingScrollRestoreRef.current
    pendingScrollRestoreRef.current = null

    window.requestAnimationFrame(() => {
      window.scrollTo({ top: nextScrollY, behavior: 'auto' })
    })
  }, [animeItems.length, isLoading, isRefreshingQuery])

  useEffect(() => {
    if (shouldSkipInitialFetchRef.current) {
      shouldSkipInitialFetchRef.current = false
      return
    }

    const controller = new AbortController()

    const loadFirstPage = async () => {
      try {
        const data = normalizedQuery
          ? await searchAnime({
              query: normalizedQuery,
              sort,
              genre: selectedGenre,
              titleLanguage: searchLanguage,
              limit: 24,
              signal: controller.signal,
            })
          : await fetchAnimeList({
              sort,
              genre: selectedGenre,
              limit: 24,
              signal: controller.signal,
            })

        setState({
          animeItems: data.items,
          nextCursor: data.pageInfo.nextCursor,
          hasNext: data.pageInfo.hasNext,
          isLoading: false,
          isLoadingMore: false,
          error: null,
          requestKey,
        })
        pendingScrollRestoreRef.current = 0
      } catch (fetchError) {
        if (fetchError instanceof DOMException && fetchError.name === 'AbortError') {
          return
        }

        setState({
          animeItems: [],
          nextCursor: null,
          hasNext: false,
          isLoading: false,
          isLoadingMore: false,
          error:
            fetchError instanceof Error
              ? fetchError.message
              : '알 수 없는 오류로 목록을 가져오지 못했습니다.',
          requestKey,
        })
      }
    }

    void loadFirstPage()

    return () => controller.abort()
  }, [normalizedQuery, requestKey, searchLanguage, selectedGenre, sort])

  useEffect(() => {
    const node = sentinelRef.current

    if (
      !node ||
      !hasNext ||
      isLoading ||
      isLoadingMore ||
      !nextCursor ||
      isRefreshingQuery
    ) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries

        if (!entry?.isIntersecting) {
          return
        }

        setState((current) => ({ ...current, isLoadingMore: true }))

        const loadMore = async () => {
          try {
            const data = normalizedQuery
              ? await searchAnime({
                  query: normalizedQuery,
                  sort,
                  genre: selectedGenre,
                  titleLanguage: searchLanguage,
                  limit: 24,
                  cursor: nextCursor,
                })
              : await fetchAnimeList({
                  sort,
                  genre: selectedGenre,
                  limit: 24,
                  cursor: nextCursor,
                })

            setState((current) => {
              const merged = [...current.animeItems, ...data.items]
              const seen = new Set<number>()
              const deduped = merged.filter((item) => {
                if (seen.has(item.id)) {
                  return false
                }

                seen.add(item.id)
                return true
              })

              return {
                ...current,
                animeItems: deduped,
                nextCursor: data.pageInfo.nextCursor,
                hasNext: data.pageInfo.hasNext,
                isLoadingMore: false,
              }
            })
          } catch (fetchError) {
            setState((current) => ({
              ...current,
              isLoadingMore: false,
              error:
                fetchError instanceof Error
                  ? fetchError.message
                  : '추가 목록을 불러오지 못했습니다.',
            }))
          }
        }

        void loadMore()
      },
      { rootMargin: '280px 0px' },
    )

    observer.observe(node)

    return () => observer.disconnect()
  }, [
    hasNext,
    isLoading,
    isLoadingMore,
    isRefreshingQuery,
    nextCursor,
    normalizedQuery,
    searchLanguage,
    selectedGenre,
    sort,
  ])

  return (
    <section className="explore-page">
      <div className="explore-toolbar-shell">
        <div className="explore-toolbar">
          <div className="search-group">
            <label className="search-field minimalist-search" htmlFor="anime-search">
              <input
                id="anime-search"
                type="search"
                placeholder="제목으로 검색하기"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </label>
            <div className="search-language-switch" aria-label="검색 언어 선택">
              <button
                className={
                  searchLanguage === 'ko'
                    ? 'search-language-button is-active'
                    : 'search-language-button'
                }
                type="button"
                onClick={() => setSearchLanguage('ko')}
              >
                한
              </button>
              <button
                className={
                  searchLanguage === 'en'
                    ? 'search-language-button is-active'
                    : 'search-language-button'
                }
                type="button"
                onClick={() => setSearchLanguage('en')}
              >
                EN
              </button>

            </div>
          </div>

          <div className="catalog-control-group">
            <label className="sort-field" htmlFor="anime-genre">
              <select
                id="anime-genre"
                value={genre}
                onChange={(event) => setGenre(event.target.value as AnimeGenre | 'all')}
              >
                <option value="all">전체 장르</option>
                {genreOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="sort-field" htmlFor="anime-sort">
              <select
                id="anime-sort"
                value={sort}
                onChange={(event) => setSort(event.target.value as AnimeSort)}
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      {error && <div className="feedback-card is-error">{error}</div>}

      {!error && (isLoading || isRefreshingQuery) && (
        <div className="anime-grid">
          {Array.from({ length: 10 }).map((_, index) => (
            <article className="anime-card skeleton-card" key={`skeleton-${index}`}>
              <div className="skeleton-poster" />
              <div className="skeleton-line short" />
              <div className="skeleton-line long" />
            </article>
          ))}
        </div>
      )}

      {!isLoading && !isRefreshingQuery && !error && (
        <>
          <p className="mobile-rating-hint">포스터를 꾹 누르면 별점을 빠르게 남길 수 있어요.</p>

          <div className="results-meta minimalist-meta">
            <span>
              {normalizedQuery
                ? `"${normalizedQuery}" 검색 결과 · ${searchLanguage === 'ko' ? '한국어' : '영어'}`
                : '전체 작품 목록'}
            </span>
            <span>{selectedGenreLabel}</span>
          </div>

          {animeItems.length === 0 ? (
            <div className="feedback-card">
              {normalizedQuery
                ? '검색 결과가 없어요. 다른 제목으로 검색하거나 정렬을 바꿔서 다시 둘러보세요.'
                : '표시할 애니가 없어요. 잠시 후 다시 시도해주세요.'}
            </div>
          ) : (
            <div className="anime-grid">
              {animeItems.map((item) => (
                <Link className="anime-card anime-card-link" key={item.id} to={`/anime/${item.id}`} state={{ fromPage: 'explore' }}>
                  <div className="anime-poster-wrap">
                    <div
                      className="anime-card-quick-action"
                      onClick={(event) => event.preventDefault()}
                    >
                      <CollectionButton animeId={item.id} maxProgress={item.episodes} />
                    </div>
                    {formatFivePointScore(item.averageScore) && (
                      <div className="anime-card-rating">
                        {formatFivePointScore(item.averageScore)} / 5
                      </div>
                    )}
                    <img
                      className="anime-poster"
                      src={getPrimaryPoster(item)}
                      alt={getDisplayTitle(item)}
                      loading="lazy"
                    />
                    <HoverRating animeId={item.id} maxProgress={item.episodes} />
                  </div>
                  <div className="anime-copy">
                    <h3>{getDisplayTitle(item)}</h3>
                  </div>
                </Link>
              ))}
            </div>
          )}

          <div ref={sentinelRef} className="scroll-sentinel" aria-hidden="true" />

          {isLoadingMore && (
            <div className="feedback-inline">작품을 더 불러오는 중이에요.</div>
          )}

          {!hasNext && animeItems.length > 0 && (
            <div className="feedback-inline">마지막 작품까지 모두 확인했어요.</div>
          )}
        </>
      )}
    </section>
  )
}
