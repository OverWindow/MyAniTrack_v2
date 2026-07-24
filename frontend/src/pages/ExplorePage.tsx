import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Film, Layers3 } from 'lucide-react'
import { CollectionButton } from '../components/CollectionButton'
import { ConnectionErrorState } from '../components/ConnectionErrorState'
import { useAuth } from '../contexts/AuthContext'
import {
  addToCollection,
  syncCollectionCacheFromSearchItems,
  updateCollectionEntry,
} from '../lib/collection'
import {
  fetchAnimeList,
  fetchAnimeSeries,
  genreOptions,
  getDisplayTitle,
  getPrimaryPoster,
  searchAnime,
  searchMyAnime,
  sortOptions,
} from '../lib/anime'
import { SERVER_CONNECTION_ERROR_MESSAGE, getFriendlyErrorMessage } from '../lib/errors'
import type {
  AnimeGenre,
  AnimeListItem,
  AnimeSeriesListItem,
  AnimeSeriesScope,
  AnimeSort,
} from '../types/anime'
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

type SeriesExploreState = {
  items: AnimeSeriesListItem[]
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
  collection?: AnimeListItem['myCollection']
  onCollectionChange: (collection: NonNullable<AnimeListItem['myCollection']>) => void
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

const createInitialSeriesState = (requestKey: string): SeriesExploreState => ({
  items: [],
  nextCursor: null,
  hasNext: false,
  isLoading: true,
  isLoadingMore: false,
  error: null,
  requestKey,
})

function formatTenPointScore(score?: number | null) {
  if (typeof score !== 'number') {
    return null
  }

  return (score / 10).toFixed(1)
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

// function getUserRatingLabel(score: number) {
//   if (score <= 0) {
//     return '내 평점 없음'
//   }

//   return `내 평점 ${score.toFixed(1)} / 10`
// }

function logExploreCollectionOnHover(item: AnimeListItem, collection: AnimeListItem['myCollection']) {
  if (!import.meta.env.DEV) {
    return
  }

  console.debug('[Explore] hover myCollection', {
    animeId: item.id,
    title: getDisplayTitle(item),
    rawItemCollection: item.myCollection,
    renderedCollection: collection,
    scoreType: typeof collection?.score,
    existsType: typeof collection?.exists,
  })
}

function HoverRating({ animeId, maxProgress, collection, onCollectionChange }: HoverRatingProps) {
  const { isAuthenticated } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const score = getOverlayScore(collection?.score)
  const isAdded = Boolean(collection?.exists)

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
      }

      onCollectionChange({
        exists: true,
        status: 'completed',
        score: nextScore,
        progress: maxProgress && maxProgress > 0 ? maxProgress : collection?.progress ?? null,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className={isAdded ? 'anime-hover-rating is-added' : 'anime-hover-rating'} aria-label="탐색 빠른 별점">
      {/* {isAdded && <strong className="anime-hover-rating-label">{getUserRatingLabel(score)}</strong>} */}
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

type ExploreAnimeCardProps = {
  item: AnimeListItem
  location: ReturnType<typeof useLocation>
}

function ExploreAnimeCard({ item, location }: ExploreAnimeCardProps) {
  const [localCollection, setLocalCollection] = useState<AnimeListItem['myCollection']>(undefined)
  const collection = localCollection ?? item.myCollection

  return (
    <Link
      className="anime-card anime-card-link"
      key={item.id}
      to={`/anime/${item.id}`}
      state={{ fromPage: 'explore', backgroundLocation: location }}
    >
      <div
        className="anime-poster-wrap"
        onMouseEnter={() => logExploreCollectionOnHover(item, collection)}
        onFocus={() => logExploreCollectionOnHover(item, collection)}
      >
        <div
          className="anime-card-quick-action"
          onClick={(event) => event.preventDefault()}
        >
          <CollectionButton
            animeId={item.id}
            maxProgress={item.episodes}
            initialIsAdded={collection?.exists}
            useCacheState={false}
            onAddedChange={(exists) => {
              setLocalCollection((current) => ({
                exists,
                status: exists ? current?.status ?? item.myCollection?.status ?? 'completed' : null,
                score: exists ? current?.score ?? item.myCollection?.score ?? null : null,
                progress: exists ? current?.progress ?? item.myCollection?.progress ?? null : null,
              }))
            }}
          />
        </div>
        {formatTenPointScore(item.averageScore) && (
          <div className="anime-card-rating">
            {formatTenPointScore(item.averageScore)}
          </div>
        )}
        <img
          className="anime-poster"
          src={getPrimaryPoster(item)}
          alt={getDisplayTitle(item)}
          loading="lazy"
        />
        <HoverRating
          animeId={item.id}
          maxProgress={item.episodes}
          collection={collection}
          onCollectionChange={setLocalCollection}
        />
      </div>
      <div className="anime-copy">
        <h3>{getDisplayTitle(item)}</h3>
      </div>
    </Link>
  )
}

function ExploreSeriesCard({
  item,
  location,
}: {
  item: AnimeSeriesListItem
  location: ReturnType<typeof useLocation>
}) {
  const coverImage = item.coverImageExtraLarge || item.coverImageLarge

  return (
    <article className="explore-series-card">
      <Link
        className="explore-series-cover-link"
        to={`/anime/${item.canonicalAnimeId}`}
        state={{ fromPage: 'explore', backgroundLocation: location }}
      >
        {coverImage ? (
          <img className="explore-series-cover" src={coverImage} alt={item.title} loading="lazy" />
        ) : (
          <span className="explore-series-cover-placeholder">No image</span>
        )}
        {typeof item.averageScore === 'number' && (
          <span className="anime-card-rating">{formatTenPointScore(item.averageScore)}</span>
        )}
      </Link>

      <div className="explore-series-copy">
        <div className="explore-series-heading">
          <span>{item.scope === 'mainline' ? '본편 시리즈' : '관련 작품 전체'}</span>
          <strong>{item.memberCount.toLocaleString('ko-KR')}편</strong>
        </div>
        <h3>{item.title}</h3>
        <div className="explore-series-members" aria-label={`${item.title} 작품 목록`}>
          {item.items.map((member) => {
            const memberCover = member.coverImageExtraLarge || member.coverImageLarge

            return (
              <Link
                className="explore-series-member"
                key={member.id}
                to={`/anime/${member.id}`}
                state={{ fromPage: 'explore', backgroundLocation: location }}
                aria-label={`${member.title} 상세 보기`}
                title={member.title}
              >
                {memberCover ? (
                  <img src={memberCover} alt="" loading="lazy" />
                ) : (
                  <span>No image</span>
                )}
              </Link>
            )
          })}
        </div>
      </div>
    </article>
  )
}

export function ExplorePage() {
  const location = useLocation()
  const { isAuthenticated } = useAuth()
  const [viewMode, setViewMode] = useState<'anime' | 'series'>('anime')
  const [seriesScope, setSeriesScope] = useState<AnimeSeriesScope>('mainline')
  const [sort, setSort] = useState<AnimeSort>('score')
  const [genre, setGenre] = useState<AnimeGenre | 'all'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [searchLanguage, setSearchLanguage] = useState<'ko' | 'en'>('ko')
  const normalizedQuery = debouncedSearchTerm.trim()
  const selectedGenre = genre === 'all' ? null : genre
  const requestKey = `anime:${sort}:${normalizedQuery}:${searchLanguage}:${genre}:${isAuthenticated ? 'auth' : 'guest'}`
  const seriesRequestKey = `series:${seriesScope}:${sort}:${normalizedQuery}:${searchLanguage}:${genre}`
  const [state, setState] = useState<ExploreState>(() => createInitialExploreState(requestKey))
  const [seriesState, setSeriesState] = useState<SeriesExploreState>(
    () => createInitialSeriesState(seriesRequestKey),
  )
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const seriesSentinelRef = useRef<HTMLDivElement | null>(null)
  const isLoadingMoreRef = useRef(false)
  const isLoadingMoreSeriesRef = useRef(false)
  const loadedCursorRef = useRef<Set<string>>(new Set())
  const loadedSeriesCursorRef = useRef<Set<string>>(new Set())
  const { animeItems, nextCursor, hasNext, isLoading, isLoadingMore, error } = state
  const {
    items: seriesItems,
    hasNext: hasNextSeries,
    isLoading: isLoadingSeries,
    isLoadingMore: isLoadingMoreSeries,
    error: seriesError,
  } = seriesState
  const isRefreshingQuery = state.requestKey !== requestKey
  const isRefreshingSeriesQuery = seriesState.requestKey !== seriesRequestKey

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 550)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [searchTerm])

  useEffect(() => {
    if (viewMode !== 'anime') {
      return
    }

    const controller = new AbortController()

    const loadFirstPage = async () => {
      try {
        isLoadingMoreRef.current = false
        loadedCursorRef.current = new Set()

        const data = isAuthenticated
          ? await searchMyAnime({
              query: normalizedQuery,
              sort,
              genre: selectedGenre,
              titleLanguage: searchLanguage,
              limit: 24,
              signal: controller.signal,
            })
          : normalizedQuery
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

        if (isAuthenticated) {
          syncCollectionCacheFromSearchItems(data.items)
        }

        setState({
          animeItems: data.items,
          nextCursor: data.pageInfo.nextCursor,
          hasNext: data.pageInfo.hasNext,
          isLoading: false,
          isLoadingMore: false,
          error: null,
          requestKey,
        })
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
            getFriendlyErrorMessage(fetchError, '알 수 없는 오류로 목록을 가져오지 못했습니다.'),
          requestKey,
        })
      }
    }

    void loadFirstPage()

    return () => controller.abort()
  }, [isAuthenticated, normalizedQuery, requestKey, searchLanguage, selectedGenre, sort, viewMode])

  useEffect(() => {
    if (viewMode !== 'anime') {
      return
    }

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

        if (!entry?.isIntersecting || isLoadingMoreRef.current) {
          return
        }

        const cursorForRequest = nextCursor

        if (loadedCursorRef.current.has(cursorForRequest)) {
          setState((current) => (
            current.requestKey === requestKey
              ? { ...current, hasNext: false, nextCursor: null, isLoadingMore: false }
              : current
          ))
          return
        }

        loadedCursorRef.current.add(cursorForRequest)
        isLoadingMoreRef.current = true
        setState((current) => ({ ...current, isLoadingMore: true }))

        const loadMore = async () => {
          try {
            const data = isAuthenticated
              ? await searchMyAnime({
                  query: normalizedQuery,
                  sort,
                  genre: selectedGenre,
                  titleLanguage: searchLanguage,
                  limit: 24,
                  cursor: cursorForRequest,
                })
              : normalizedQuery
                ? await searchAnime({
                    query: normalizedQuery,
                    sort,
                    genre: selectedGenre,
                    titleLanguage: searchLanguage,
                    limit: 24,
                    cursor: cursorForRequest,
                  })
              : await fetchAnimeList({
                  sort,
                  genre: selectedGenre,
                  limit: 24,
                  cursor: cursorForRequest,
                })

            if (isAuthenticated) {
              syncCollectionCacheFromSearchItems(data.items)
            }

            setState((current) => {
              if (current.requestKey !== requestKey) {
                return current
              }

              const merged = [...current.animeItems, ...data.items]
              const seen = new Set<number>()
              const deduped = merged.filter((item) => {
                if (seen.has(item.id)) {
                  return false
                }

                seen.add(item.id)
                return true
              })
              const responseNextCursor = data.pageInfo.nextCursor
              const canLoadAnotherPage =
                data.pageInfo.hasNext &&
                Boolean(responseNextCursor) &&
                responseNextCursor !== cursorForRequest

              return {
                ...current,
                animeItems: deduped,
                nextCursor: canLoadAnotherPage ? responseNextCursor : null,
                hasNext: canLoadAnotherPage,
                isLoadingMore: false,
              }
            })
          } catch (fetchError) {
            setState((current) => {
              if (current.requestKey !== requestKey) {
                return current
              }

              return {
                ...current,
                isLoadingMore: false,
                error:
                  getFriendlyErrorMessage(fetchError, '추가 목록을 불러오지 못했습니다.'),
              }
            })
          } finally {
            isLoadingMoreRef.current = false
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
    isAuthenticated,
    nextCursor,
    normalizedQuery,
    requestKey,
    searchLanguage,
    selectedGenre,
    sort,
    viewMode,
  ])

  useEffect(() => {
    if (viewMode !== 'series') {
      return
    }

    const controller = new AbortController()

    const loadFirstSeriesPage = async () => {
      try {
        isLoadingMoreSeriesRef.current = false
        loadedSeriesCursorRef.current = new Set()
        const data = await fetchAnimeSeries({
          scope: seriesScope,
          sort,
          titleLanguage: searchLanguage,
          query: normalizedQuery || undefined,
          genre: selectedGenre,
          limit: 12,
          signal: controller.signal,
        })

        setSeriesState({
          items: data.items,
          nextCursor: data.pageInfo.nextCursor,
          hasNext: data.pageInfo.hasNext,
          isLoading: false,
          isLoadingMore: false,
          error: null,
          requestKey: seriesRequestKey,
        })
      } catch (fetchError) {
        if (fetchError instanceof DOMException && fetchError.name === 'AbortError') return

        setSeriesState({
          items: [],
          nextCursor: null,
          hasNext: false,
          isLoading: false,
          isLoadingMore: false,
          error: getFriendlyErrorMessage(fetchError, '시리즈 목록을 가져오지 못했습니다.'),
          requestKey: seriesRequestKey,
        })
      }
    }

    void loadFirstSeriesPage()
    return () => controller.abort()
  }, [normalizedQuery, searchLanguage, selectedGenre, seriesRequestKey, seriesScope, sort, viewMode])

  useEffect(() => {
    if (viewMode !== 'series') {
      return
    }

    const node = seriesSentinelRef.current
    const {
      hasNext: hasNextSeries,
      isLoading: isLoadingSeries,
      isLoadingMore: isLoadingMoreSeries,
      nextCursor: seriesNextCursor,
    } = seriesState

    if (
      !node || !hasNextSeries || isLoadingSeries || isLoadingMoreSeries ||
      !seriesNextCursor || isRefreshingSeriesQuery
    ) {
      return
    }

    const observer = new IntersectionObserver((entries) => {
      const [entry] = entries
      if (!entry?.isIntersecting || isLoadingMoreSeriesRef.current) return

      const cursorForRequest = seriesNextCursor
      if (loadedSeriesCursorRef.current.has(cursorForRequest)) {
        setSeriesState((current) => current.requestKey === seriesRequestKey
          ? { ...current, hasNext: false, nextCursor: null, isLoadingMore: false }
          : current)
        return
      }

      loadedSeriesCursorRef.current.add(cursorForRequest)
      isLoadingMoreSeriesRef.current = true
      setSeriesState((current) => ({ ...current, isLoadingMore: true }))

      const loadMoreSeries = async () => {
        try {
          const data = await fetchAnimeSeries({
            scope: seriesScope,
            sort,
            titleLanguage: searchLanguage,
            query: normalizedQuery || undefined,
            genre: selectedGenre,
            limit: 12,
            cursor: cursorForRequest,
          })

          setSeriesState((current) => {
            if (current.requestKey !== seriesRequestKey) return current

            const seen = new Set<number>()
            const items = [...current.items, ...data.items].filter((item) => {
              if (seen.has(item.seriesId)) return false
              seen.add(item.seriesId)
              return true
            })
            const responseNextCursor = data.pageInfo.nextCursor
            const canLoadAnotherPage = data.pageInfo.hasNext &&
              Boolean(responseNextCursor) && responseNextCursor !== cursorForRequest

            return {
              ...current,
              items,
              nextCursor: canLoadAnotherPage ? responseNextCursor : null,
              hasNext: canLoadAnotherPage,
              isLoadingMore: false,
            }
          })
        } catch (fetchError) {
          setSeriesState((current) => current.requestKey === seriesRequestKey
            ? {
                ...current,
                isLoadingMore: false,
                error: getFriendlyErrorMessage(fetchError, '시리즈를 더 불러오지 못했습니다.'),
              }
            : current)
        } finally {
          isLoadingMoreSeriesRef.current = false
        }
      }

      void loadMoreSeries()
    }, { rootMargin: '280px 0px' })

    observer.observe(node)
    return () => observer.disconnect()
  }, [
    isRefreshingSeriesQuery,
    normalizedQuery,
    searchLanguage,
    selectedGenre,
    seriesRequestKey,
    seriesScope,
    seriesState,
    sort,
    viewMode,
  ])

  return (
    <section className="explore-page">
      <div className="explore-toolbar-shell">
        <div className="explore-toolbar">
          <div className="search-group">
            <div className="explore-view-switch" role="group" aria-label="탐색 단위 선택">
              <button
                className={viewMode === 'anime' ? 'is-active' : ''}
                type="button"
                aria-pressed={viewMode === 'anime'}
                onClick={() => {
                  if (viewMode === 'anime') return
                  setState((current) => ({ ...current, isLoading: true, error: null }))
                  setViewMode('anime')
                }}
              >
                <Film size={17} aria-hidden="true" />
                작품
              </button>
              <button
                className={viewMode === 'series' ? 'is-active' : ''}
                type="button"
                aria-pressed={viewMode === 'series'}
                onClick={() => {
                  if (viewMode === 'series') return
                  setSeriesState((current) => ({ ...current, isLoading: true, error: null }))
                  setViewMode('series')
                }}
              >
                <Layers3 size={17} aria-hidden="true" />
                시리즈
              </button>
            </div>
            <label className="search-field minimalist-search" htmlFor="anime-search">
              <input
                id="anime-search"
                type="search"
                placeholder={viewMode === 'series' ? '시리즈 또는 작품 제목 검색' : '제목으로 검색하기'}
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

          <div className={`catalog-control-group${viewMode === 'series' ? ' is-series' : ''}`}>
            {viewMode === 'series' && (
              <label className="sort-field" htmlFor="anime-series-scope">
                <select
                  id="anime-series-scope"
                  value={seriesScope}
                  onChange={(event) => setSeriesScope(event.target.value as AnimeSeriesScope)}
                >
                  <option value="mainline">본편 시리즈</option>
                  <option value="franchise">관련 작품 전체</option>
                </select>
              </label>
            )}
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

      {viewMode === 'anime' && error && (
        error === SERVER_CONNECTION_ERROR_MESSAGE
          ? <ConnectionErrorState message={error} />
          : <div className="feedback-card is-error">{error}</div>
      )}

      {viewMode === 'anime' && !error && (isLoading || isRefreshingQuery) && (
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

      {viewMode === 'anime' && !isLoading && !isRefreshingQuery && !error && (
        <>
          {animeItems.length === 0 ? (
            <div className="feedback-card">
              {normalizedQuery
                ? '검색 결과가 없어요. 다른 제목으로 검색하거나 정렬을 바꿔서 다시 둘러보세요.'
                : '표시할 애니가 없어요. 잠시 후 다시 시도해주세요.'}
            </div>
          ) : (
            <div className="anime-grid">
              {animeItems.map((item) => (
                <ExploreAnimeCard
                  key={item.id}
                  item={item}
                  location={location}
                />
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

      {viewMode === 'series' && seriesError && (
        seriesError === SERVER_CONNECTION_ERROR_MESSAGE
          ? <ConnectionErrorState message={seriesError} />
          : <div className="feedback-card is-error">{seriesError}</div>
      )}

      {viewMode === 'series' && !seriesError && (isLoadingSeries || isRefreshingSeriesQuery) && (
        <div className="explore-series-grid">
          {Array.from({ length: 6 }).map((_, index) => (
            <article className="explore-series-card skeleton-card" key={`series-skeleton-${index}`}>
              <div className="skeleton-poster" />
              <div className="skeleton-line short" />
              <div className="skeleton-line long" />
            </article>
          ))}
        </div>
      )}

      {viewMode === 'series' && !isLoadingSeries && !isRefreshingSeriesQuery && !seriesError && (
        <>
          {seriesItems.length === 0 ? (
            <div className="feedback-card">
              {normalizedQuery
                ? '검색 결과가 없어요. 다른 시리즈 또는 작품 제목으로 검색해보세요.'
                : '표시할 시리즈가 없어요. 다른 범위나 필터를 선택해보세요.'}
            </div>
          ) : (
            <div className="explore-series-grid">
              {seriesItems.map((item) => (
                <ExploreSeriesCard key={item.seriesId} item={item} location={location} />
              ))}
            </div>
          )}

          <div ref={seriesSentinelRef} className="scroll-sentinel" aria-hidden="true" />

          {isLoadingMoreSeries && (
            <div className="feedback-inline">시리즈를 더 불러오는 중이에요.</div>
          )}

          {!hasNextSeries && seriesItems.length > 0 && (
            <div className="feedback-inline">마지막 시리즈까지 모두 확인했어요.</div>
          )}
        </>
      )}
    </section>
  )
}
