import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { CollectionCarousel } from '../components/CollectionCarousel'
import { ConnectionErrorState } from '../components/ConnectionErrorState'
import { useAuth } from '../contexts/AuthContext'
import {
  fetchMyCollection,
  fetchMySeriesCollection,
  getCachedCollectionPage,
  getCachedSeriesCollection,
  saveCollectionPageCache,
  saveSeriesCollectionCache,
} from '../lib/collection'
import { genreOptions } from '../lib/anime'
import { SERVER_CONNECTION_ERROR_MESSAGE, getFriendlyErrorMessage } from '../lib/errors'
import { fetchSampleCollection } from '../lib/sample'
import type { AnimeGenre } from '../types/anime'
import type {
  AnimeSeriesScope,
  UserAnimeListItem,
  UserAnimeListSort,
  UserSeriesCollectionItem,
  UserSeriesCollectionStatus,
} from '../types/collection'
import '../styles/pages/CatalogPage.css'
import '../styles/pages/CollectionPage.css'

type CollectionState = {
  items: UserAnimeListItem[]
  nextCursor: string | null
  hasNext: boolean
  isLoading: boolean
  isLoadingMore: boolean
  error: string | null
  requestKey: string
}

type PerfectScoreState = {
  items: UserAnimeListItem[]
  isLoading: boolean
  error: string | null
}

type SeriesCollectionState = {
  items: UserSeriesCollectionItem[]
  isLoading: boolean
  error: string | null
}

const sortOptions: Array<{ value: UserAnimeListSort; label: string }> = [
  { value: 'latest', label: '최근 수정순' },
  { value: 'added', label: '추가 최신순' },
  { value: 'score', label: '내 점수 높은 순' },
  { value: 'scoreAsc', label: '내 점수 낮은 순' },
]

const createInitialCollectionState = (requestKey: string): CollectionState => ({
  items: [],
  nextCursor: null,
  hasNext: false,
  isLoading: true,
  isLoadingMore: false,
  error: null,
  requestKey,
})

function getCollectionDisplayTitle(item: UserAnimeListItem) {
  return item.anime.titles?.korean || item.anime.titles?.english || item.anime.title
}

function getCollectionSearchText(item: UserAnimeListItem) {
  return [
    item.anime.title,
    item.anime.titles?.korean,
    item.anime.titles?.english,
    item.anime.titles?.native,
    item.anime.titles?.romaji,
    item.anime.titles?.userPreferred,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function renderStars(score?: number | null) {
  const numericScore =
    typeof score === 'number'
      ? score
      : typeof score === 'string'
        ? Number(score)
        : NaN

  if (!Number.isFinite(numericScore) || numericScore <= 0) {
    return '평점 없음'
  }

  const filled = Math.round(numericScore / 2)
  return `${'★'.repeat(filled)}${'☆'.repeat(5 - filled)}`
}

function formatScore(score?: number | null) {
  const numericScore =
    typeof score === 'number'
      ? score
      : typeof score === 'string'
        ? Number(score)
        : NaN

  if (!Number.isFinite(numericScore)) {
    return ''
  }

  return numericScore.toFixed(1)
}

function sortCollectionItems(items: UserAnimeListItem[], sort: UserAnimeListSort) {
  const sortedItems = [...items]
  const getNumericScore = (item: UserAnimeListItem) => {
    if (item.score === null || item.score === undefined) {
      return null
    }

    const score = Number(item.score)
    return Number.isFinite(score) ? score : null
  }

  sortedItems.sort((left, right) => {
    if (sort === 'score' || sort === 'scoreAsc') {
      const leftScore = getNumericScore(left)
      const rightScore = getNumericScore(right)

      if (leftScore === null && rightScore !== null) {
        return 1
      }

      if (leftScore !== null && rightScore === null) {
        return -1
      }

      if (leftScore !== null && rightScore !== null && leftScore !== rightScore) {
        return sort === 'score' ? rightScore - leftScore : leftScore - rightScore
      }
    } else {
      const leftDate = sort === 'added' ? left.createdAt : left.updatedAt
      const rightDate = sort === 'added' ? right.createdAt : right.updatedAt
      const dateComparison = String(rightDate ?? '').localeCompare(String(leftDate ?? ''))

      if (dateComparison !== 0) {
        return dateComparison
      }
    }

    return right.animeId - left.animeId
  })

  return sortedItems
}

export function CollectionPage() {
  const location = useLocation()
  const { isAuthenticated, isBootstrapping } = useAuth()
  const isGuestPreview = !isBootstrapping && !isAuthenticated
  const [sort, setSort] = useState<UserAnimeListSort>('latest')
  const [genre, setGenre] = useState<AnimeGenre | 'all'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState<'anime' | 'series'>('anime')
  const [seriesScope, setSeriesScope] = useState<AnimeSeriesScope>('mainline')
  const [seriesStatus, setSeriesStatus] = useState<UserSeriesCollectionStatus>('all')
  const [seriesState, setSeriesState] = useState<SeriesCollectionState>({
    items: [],
    isLoading: false,
    error: null,
  })
  const [reloadKey, setReloadKey] = useState(0)
  const [perfectScoreState, setPerfectScoreState] = useState<PerfectScoreState>({
    items: [],
    isLoading: true,
    error: null,
  })
  const selectedGenre = genre === 'all' ? null : genre
  const requestKey = `${sort}:${genre}`
  const [state, setState] = useState<CollectionState>(() => createInitialCollectionState(requestKey))
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const isLoadingMoreRef = useRef(false)
  const consumedReloadKeyRef = useRef(0)
  const consumedSeriesReloadKeyRef = useRef(0)
  const { items, nextCursor, hasNext, isLoading, isLoadingMore, error } = state
  const isRefreshingQuery = state.requestKey !== requestKey

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 550)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [searchTerm])

  const filteredItems = items.filter((item) =>
    getCollectionSearchText(item).includes(debouncedSearchTerm.trim().toLowerCase()),
  )

  useEffect(() => {
    if (viewMode !== 'series' || !isAuthenticated || isBootstrapping) {
      return
    }

    const controller = new AbortController()

    const loadSeries = async () => {
      const cacheParams = {
        scope: seriesScope,
        status: seriesStatus,
        titleLanguage: 'ko' as const,
        query: debouncedSearchTerm,
      }
      const shouldFetchFromApi = reloadKey !== consumedSeriesReloadKeyRef.current

      if (!shouldFetchFromApi) {
        const cachedSeries = getCachedSeriesCollection(cacheParams)

        if (cachedSeries) {
          setSeriesState({ items: cachedSeries.items, isLoading: false, error: null })
          return
        }
      }

      setSeriesState((current) => ({ ...current, isLoading: true, error: null }))
      consumedSeriesReloadKeyRef.current = reloadKey

      try {
        const firstPage = await fetchMySeriesCollection({
          scope: seriesScope,
          status: seriesStatus,
          query: debouncedSearchTerm,
          limit: 50,
          signal: controller.signal,
        })
        const allItems = [...firstPage.items]
        let cursor = firstPage.pageInfo.nextCursor
        let hasMore = firstPage.pageInfo.hasNext
        const seenCursors = new Set<string>()

        while (hasMore && cursor && !seenCursors.has(cursor)) {
          seenCursors.add(cursor)
          const nextPage = await fetchMySeriesCollection({
            scope: seriesScope,
            status: seriesStatus,
            query: debouncedSearchTerm,
            limit: 50,
            cursor,
            signal: controller.signal,
          })
          const seenSeriesIds = new Set(allItems.map((item) => item.seriesId))

          for (const item of nextPage.items) {
            if (!seenSeriesIds.has(item.seriesId)) {
              allItems.push(item)
              seenSeriesIds.add(item.seriesId)
            }
          }

          cursor = nextPage.pageInfo.nextCursor
          hasMore = nextPage.pageInfo.hasNext
        }

        saveSeriesCollectionCache(cacheParams, {
          ...firstPage,
          items: allItems,
          pageInfo: {
            ...firstPage.pageInfo,
            hasNext: false,
            nextCursor: null,
            limit: allItems.length,
          },
        })
        setSeriesState({ items: allItems, isLoading: false, error: null })
      } catch (fetchError) {
        if (fetchError instanceof DOMException && fetchError.name === 'AbortError') {
          return
        }

        setSeriesState({
          items: [],
          isLoading: false,
          error: getFriendlyErrorMessage(fetchError, '시리즈 컬렉션을 불러오지 못했어요.'),
        })
      }
    }

    void loadSeries()

    return () => controller.abort()
  }, [debouncedSearchTerm, isAuthenticated, isBootstrapping, reloadKey, seriesScope, seriesStatus, viewMode])

  useEffect(() => {
    if (isBootstrapping || (!isAuthenticated && !isGuestPreview)) {
      return
    }

    const controller = new AbortController()

    const loadPerfectScoreAnime = async () => {
      try {
        const data = isGuestPreview
          ? await fetchSampleCollection({
            sort: 'score',
            limit: 12,
            signal: controller.signal,
          })
          : await fetchMyCollection({
            sort: 'score',
            score: 10,
            limit: 12,
            signal: controller.signal,
          })

        setPerfectScoreState({
          items: data.items.filter((item) => item.anime.coverImageExtraLarge || item.anime.coverImageLarge),
          isLoading: false,
          error: null,
        })
      } catch (fetchError) {
        if (fetchError instanceof DOMException && fetchError.name === 'AbortError') {
          return
        }

        setPerfectScoreState({
          items: [],
          isLoading: false,
          error:
            getFriendlyErrorMessage(fetchError, '만점 작품을 불러오지 못했어요.'),
        })
      }
    }

    void loadPerfectScoreAnime()

    return () => controller.abort()
  }, [isAuthenticated, isBootstrapping, isGuestPreview, reloadKey])

  const fetchFullCollection = useCallback(async (signal?: AbortSignal) => {
    // The score cursor is based only on numeric score + anime ID, so it remains
    // stable across page boundaries. Date cursors and scoreAsc currently do not.
    const paginationSort: UserAnimeListSort = 'score'
    const firstPage = await fetchMyCollection({
      sort: paginationSort,
      genre: selectedGenre,
      limit: 50,
      signal,
    })
    const allItems = [...firstPage.items]
    let cursor = firstPage.pageInfo.nextCursor
    let hasMore = firstPage.pageInfo.hasNext
    const seenCursors = new Set<string>()

    while (hasMore && cursor && !seenCursors.has(cursor)) {
      seenCursors.add(cursor)

      const nextPage = await fetchMyCollection({
        sort: paginationSort,
        genre: selectedGenre,
        limit: 50,
        cursor,
        signal,
      })

      const seenItems = new Set(allItems.map((item) => item.id))
      for (const item of nextPage.items) {
        if (!seenItems.has(item.id)) {
          allItems.push(item)
          seenItems.add(item.id)
        }
      }

      cursor = nextPage.pageInfo.nextCursor
      hasMore = nextPage.pageInfo.hasNext
    }

    const fullData = {
      ...firstPage,
      items: sortCollectionItems(allItems, sort),
      pageInfo: {
        ...firstPage.pageInfo,
        hasNext: false,
        nextCursor: null,
        limit: allItems.length,
        sort,
      },
    }

    saveCollectionPageCache(
      {
        sort,
        genre: selectedGenre,
      },
      fullData,
    )

    return fullData
  }, [selectedGenre, sort])

  useEffect(() => {
    if (isBootstrapping || (!isAuthenticated && !isGuestPreview)) {
      return
    }

    const controller = new AbortController()

    const loadFirstPage = async () => {
      try {
        isLoadingMoreRef.current = false
        const shouldFetchFromApi = reloadKey !== consumedReloadKeyRef.current

        if (!isGuestPreview && !shouldFetchFromApi) {
          const cachedPage = getCachedCollectionPage({
            sort,
            genre: selectedGenre,
          })

          const isCompleteCachedPage = cachedPage
            && !cachedPage.pageInfo.hasNext
            && !cachedPage.pageInfo.nextCursor

          if (isCompleteCachedPage) {
            setState({
              items: cachedPage.items,
              nextCursor: null,
              hasNext: false,
              isLoading: false,
              isLoadingMore: false,
              error: null,
              requestKey,
            })
            return
          }
        }

        setState((current) => ({
          ...current,
          isLoading: true,
          isLoadingMore: false,
          error: null,
          requestKey,
        }))
        consumedReloadKeyRef.current = reloadKey

        const data = isGuestPreview
          ? await fetchSampleCollection({
            sort,
            genre: selectedGenre,
            limit: 50,
            signal: controller.signal,
          })
          : await fetchFullCollection(controller.signal)

        setState({
          items: data.items,
          nextCursor: null,
          hasNext: false,
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
          items: [],
          nextCursor: null,
          hasNext: false,
          isLoading: false,
          isLoadingMore: false,
          error:
            getFriendlyErrorMessage(fetchError, '컬렉션을 불러오지 못했어요.'),
          requestKey,
        })
      }
    }

    void loadFirstPage()

    return () => controller.abort()
  }, [fetchFullCollection, isAuthenticated, isBootstrapping, isGuestPreview, reloadKey, requestKey, selectedGenre, sort])

  useEffect(() => {
    const node = sentinelRef.current

    if (
      !isAuthenticated ||
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

        isLoadingMoreRef.current = true
        setState((current) => ({ ...current, isLoadingMore: true }))

        const loadMore = async () => {
          try {
            const data = await fetchMyCollection({
              sort,
              genre: selectedGenre,
              limit: 24,
              cursor: nextCursor,
            })

            setState((current) => {
              if (current.requestKey !== requestKey) {
                return current
              }

              const merged = [...current.items, ...data.items]
              const seen = new Set<number>()
              const deduped = merged.filter((item) => {
                if (seen.has(item.id)) {
                  return false
                }

                seen.add(item.id)
                return true
              })
              const nextState = {
                ...current,
                items: deduped,
                nextCursor: data.pageInfo.nextCursor,
                hasNext: data.pageInfo.hasNext,
                isLoadingMore: false,
              }

              saveCollectionPageCache(
                {
                  sort,
                  genre: selectedGenre,
                },
                {
                  success: data.success,
                  items: deduped,
                  pageInfo: {
                    ...data.pageInfo,
                    nextCursor: data.pageInfo.nextCursor,
                    hasNext: data.pageInfo.hasNext,
                  },
                },
              )

              return nextState
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
                  getFriendlyErrorMessage(fetchError, '추가 컬렉션을 불러오지 못했어요.'),
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
    isAuthenticated,
    isLoading,
    isLoadingMore,
    isRefreshingQuery,
    nextCursor,
    requestKey,
    selectedGenre,
    sort,
  ])

  if (isBootstrapping) {
    return (
      <section className="collection-page">
        <div className="collection-grid">
          {Array.from({ length: 8 }).map((_, index) => (
            <article className="collection-card skeleton-card" key={`collection-bootstrap-${index}`}>
              <div className="skeleton-poster" />
              <div className="skeleton-line short" />
              <div className="skeleton-line long" />
            </article>
          ))}
        </div>
      </section>
    )
  }

  return (
    <>
      <CollectionCarousel
        state={perfectScoreState}
        location={location}
        portalRootId="collection-carousel-root"
        recapHref={isAuthenticated ? '/recap' : undefined}
      />

      <section className={isGuestPreview ? 'collection-page is-sample-preview' : 'collection-page'}>
        {isGuestPreview && (
          <div className="guest-preview-banner">
            <div>
              <span className="guest-preview-eyebrow">Sample mode</span>
              <strong>샘플 컬렉션을 둘러보고 있어요</strong>
              <p>이 화면의 작품, 평점, 기록은 체험용 데이터입니다. 로그인하면 내 컬렉션으로 즉시 바뀝니다.</p>
            </div>
            <div className="guest-preview-actions">
              <Link className="primary-button" to="/signup">시작하기</Link>
              <Link className="secondary-button" to="/login">로그인</Link>
            </div>
          </div>
        )}

        <div className="explore-toolbar-shell">
        <div className="explore-toolbar">
          <div className="search-group">
            {isGuestPreview && <span className="sample-mode-chip">샘플 컬렉션</span>}
            {!isGuestPreview && (
              <div
                className="collection-view-switch"
                data-active-view={viewMode}
                role="group"
                aria-label="컬렉션 보기 방식"
              >
                <button
                  type="button"
                  className={viewMode === 'anime' ? 'is-active' : ''}
                  aria-pressed={viewMode === 'anime'}
                  onClick={() => setViewMode('anime')}
                >
                  <svg viewBox="0 0 20 20" aria-hidden="true">
                    <rect x="3" y="3" width="5" height="5" rx="1.25" />
                    <rect x="12" y="3" width="5" height="5" rx="1.25" />
                    <rect x="3" y="12" width="5" height="5" rx="1.25" />
                    <rect x="12" y="12" width="5" height="5" rx="1.25" />
                  </svg>
                  <span>작품별</span>
                </button>
                <button
                  type="button"
                  className={viewMode === 'series' ? 'is-active' : ''}
                  aria-pressed={viewMode === 'series'}
                  onClick={() => setViewMode('series')}
                >
                  <svg viewBox="0 0 20 20" aria-hidden="true">
                    <rect x="4" y="3" width="12" height="5" rx="1.5" />
                    <rect x="4" y="12" width="12" height="5" rx="1.5" />
                    <path d="M7 8v4M13 8v4" />
                  </svg>
                  <span>시리즈별</span>
                </button>
              </div>
            )}
            <label className="search-field minimalist-search" htmlFor="collection-search">
              <input
                id="collection-search"
                type="search"
                placeholder={viewMode === 'series' ? '시리즈 또는 작품 제목 검색' : '컬렉션에서 검색하기'}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </label>
            <button
              className="refresh-button"
              type="button"
              aria-label={isGuestPreview ? '샘플 컬렉션은 새로고침할 수 없어요' : '컬렉션 새로고침'}
              onClick={() => setReloadKey((value) => value + 1)}
              disabled={isGuestPreview}
            >
              ↻
            </button>
          </div>

          <div className="catalog-control-group">
            {viewMode === 'series' && !isGuestPreview ? (
              <>
                <label className="sort-field" htmlFor="collection-series-scope">
                  <select
                    id="collection-series-scope"
                    value={seriesScope}
                    onChange={(event) => setSeriesScope(event.target.value as AnimeSeriesScope)}
                  >
                    <option value="mainline">본편 시리즈</option>
                    <option value="franchise">관련 작품 전체</option>
                  </select>
                </label>
                <label className="sort-field" htmlFor="collection-series-status">
                  <select
                    id="collection-series-status"
                    value={seriesStatus}
                    onChange={(event) => setSeriesStatus(event.target.value as UserSeriesCollectionStatus)}
                  >
                    <option value="all">전체 시리즈</option>
                    <option value="started">시작한 시리즈</option>
                    <option value="watched">본 시리즈</option>
                    <option value="completed">완주한 시리즈</option>
                  </select>
                </label>
              </>
            ) : (
              <>
                <label className="sort-field" htmlFor="collection-genre">
                  <select
                    id="collection-genre"
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

                <label className="sort-field" htmlFor="collection-sort">
                  <select
                    id="collection-sort"
                    value={sort}
                    onChange={(event) => setSort(event.target.value as UserAnimeListSort)}
                  >
                    {sortOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
          </div>
        </div>
        </div>

      {viewMode === 'series' && !isGuestPreview && seriesState.error && (
        seriesState.error === SERVER_CONNECTION_ERROR_MESSAGE
          ? <ConnectionErrorState message={seriesState.error} />
          : <div className="feedback-card is-error">{seriesState.error}</div>
      )}

      {viewMode === 'series' && !isGuestPreview && !seriesState.error && seriesState.isLoading && (
        <div className="series-collection-grid">
          {Array.from({ length: 6 }).map((_, index) => (
            <article className="series-collection-card skeleton-card" key={`series-skeleton-${index}`}>
              <div className="skeleton-poster" />
              <div className="skeleton-line short" />
              <div className="skeleton-line long" />
            </article>
          ))}
        </div>
      )}

      {viewMode === 'series' && !isGuestPreview && !seriesState.error && !seriesState.isLoading && (
        seriesState.items.length === 0 ? (
          <div className="feedback-card">조건에 맞는 시리즈가 없어요.</div>
        ) : (
          <div className="series-collection-grid">
            {seriesState.items.map((series) => {
              const targetAnimeId = series.canonicalAnimeId ?? series.items[0]?.anime.id

              return (
                <article className="series-collection-card" key={series.seriesId}>
                  {targetAnimeId ? (
                    <Link
                      className="series-collection-cover-link"
                      to={`/anime/${targetAnimeId}`}
                      state={{ fromPage: 'collection', backgroundLocation: location }}
                    >
                      {series.coverImageExtraLarge || series.coverImageLarge ? (
                        <img
                          className="series-collection-cover"
                          src={series.coverImageExtraLarge || series.coverImageLarge || ''}
                          alt={series.title || '시리즈 대표 이미지'}
                          loading="lazy"
                        />
                      ) : (
                        <div className="series-collection-cover-placeholder">No image</div>
                      )}
                    </Link>
                  ) : null}
                  <div className="series-collection-copy">
                    <div className="series-collection-heading">
                      <div>
                        <span className="series-collection-scope">
                          {series.scope === 'mainline' ? '본편 시리즈' : '관련 작품 전체'}
                        </span>
                        <h3>{series.title || '이름 없는 시리즈'}</h3>
                      </div>
                      <strong>{series.completionRate}%</strong>
                    </div>
                    <div className="series-collection-progress" aria-label={`완주율 ${series.completionRate}%`}>
                      <span style={{ width: `${Math.min(100, Math.max(0, series.completionRate))}%` }} />
                    </div>
                    <p>
                      {series.completedRequiredMemberCount}/{series.requiredMemberCount} 필수 작품 완주
                      {' · '}
                      내 컬렉션 {series.collectedMemberCount}개
                    </p>
                    <div className="series-member-strip">
                      {series.items.map((member) => (
                        <Link
                          key={member.anime.id}
                          className={member.userList ? 'series-member-item is-collected' : 'series-member-item'}
                          to={`/anime/${member.anime.id}`}
                          state={{ fromPage: 'collection', backgroundLocation: location }}
                          title={`${member.anime.title}${member.userList ? ` · ${member.userList.status}` : ' · 미등록'}`}
                        >
                          {member.anime.coverImageLarge ? (
                            <img src={member.anime.coverImageLarge} alt={member.anime.title} loading="lazy" />
                          ) : (
                            <span>{member.anime.title.slice(0, 1)}</span>
                          )}
                        </Link>
                      ))}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )
      )}

      {viewMode === 'anime' && !isGuestPreview && error && (
        error === SERVER_CONNECTION_ERROR_MESSAGE
          ? <ConnectionErrorState message={error} />
          : <div className="feedback-card is-error">{error}</div>
      )}

      {viewMode === 'anime' && !isGuestPreview && !error && (isLoading || isRefreshingQuery) && (
        <div className="collection-grid">
          {Array.from({ length: 8 }).map((_, index) => (
            <article className="collection-card skeleton-card" key={`collection-skeleton-${index}`}>
              <div className="skeleton-poster" />
              <div className="skeleton-line short" />
              <div className="skeleton-line long" />
            </article>
          ))}
        </div>
      )}

      {viewMode === 'anime' && (isGuestPreview || (!isLoading && !isRefreshingQuery && !error)) && (
        <>
          {filteredItems.length === 0 ? (
            <div className="feedback-card">
              {isGuestPreview
                ? '샘플 컬렉션에서 검색 결과가 없어요.'
                : '아직 컬렉션에 담긴 작품이 없거나, 검색 결과가 없어요.'}
            </div>
          ) : (
            <div className="collection-grid">
              {filteredItems.map((item) => (
                <Link
                  className="collection-card"
                  key={item.id}
                  to={`/anime/${item.anime.id}`}
                  state={{
                    fromPage: 'collection',
                    backgroundLocation: location,
                  }}
                >
                  <div className="collection-poster-wrap">
                    {item.anime.coverImageExtraLarge || item.anime.coverImageLarge ? (
                      <img
                        className="collection-poster"
                        src={item.anime.coverImageExtraLarge || item.anime.coverImageLarge || ''}
                        alt={getCollectionDisplayTitle(item)}
                        loading="lazy"
                      />
                    ) : (
                      <div className="collection-poster-placeholder" aria-hidden="true">
                        <span>No image</span>
                      </div>
                    )}
                  </div>
                  <div className="collection-copy">
                    <h3>{getCollectionDisplayTitle(item)}</h3>
                    <div className="collection-rating-row">
                      <span className="collection-stars">{renderStars(item.score)}</span>
                      <span className="collection-score">
                        {formatScore(item.score)}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          <div ref={sentinelRef} className="scroll-sentinel" aria-hidden="true" />

          {!isGuestPreview && isLoadingMore && (
            <div className="feedback-inline">컬렉션을 더 불러오는 중이에요.</div>
          )}

          {!isGuestPreview && !hasNext && items.length > 0 && (
            <div className="feedback-inline">컬렉션의 마지막 작품까지 모두 확인했어요.</div>
          )}

          {isGuestPreview && (
            <div className="feedback-inline">샘플 컬렉션의 마지막 작품까지 모두 확인했어요.</div>
          )}
        </>
      )}
      </section>
    </>
  )
}
