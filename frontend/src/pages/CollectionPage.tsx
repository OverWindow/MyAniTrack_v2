import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { CollectionCarousel } from '../components/CollectionCarousel'
import { ConnectionErrorState } from '../components/ConnectionErrorState'
import { useAuth } from '../contexts/AuthContext'
import { fetchMyCollection, getCachedCollectionPage, saveCollectionPageCache } from '../lib/collection'
import { genreOptions } from '../lib/anime'
import { SERVER_CONNECTION_ERROR_MESSAGE, getFriendlyErrorMessage } from '../lib/errors'
import { fetchSampleCollection } from '../lib/sample'
import type { AnimeGenre } from '../types/anime'
import type { UserAnimeListItem, UserAnimeListSort } from '../types/collection'
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

export function CollectionPage() {
  const location = useLocation()
  const { isAuthenticated, isBootstrapping } = useAuth()
  const isGuestPreview = !isBootstrapping && !isAuthenticated
  const [sort, setSort] = useState<UserAnimeListSort>('latest')
  const [genre, setGenre] = useState<AnimeGenre | 'all'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
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
          items: data.items,
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
    const firstPage = await fetchMyCollection({
      sort,
      genre: selectedGenre,
      limit: 50,
      signal,
    })
    const allItems = [...firstPage.items]
    let cursor = firstPage.pageInfo.nextCursor
    const seenCursors = new Set<string>()

    while (firstPage.pageInfo.hasNext && cursor && !seenCursors.has(cursor)) {
      seenCursors.add(cursor)

      const nextPage = await fetchMyCollection({
        sort,
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

      if (!nextPage.pageInfo.hasNext) {
        break
      }
    }

    const fullData = {
      ...firstPage,
      items: allItems,
      pageInfo: {
        ...firstPage.pageInfo,
        hasNext: false,
        nextCursor: null,
        limit: allItems.length,
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

          if (cachedPage) {
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
            <label className="search-field minimalist-search" htmlFor="collection-search">
              <input
                id="collection-search"
                type="search"
                placeholder="컬렉션에서 검색하기"
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
          </div>
        </div>
        </div>

      {!isGuestPreview && error && (
        error === SERVER_CONNECTION_ERROR_MESSAGE
          ? <ConnectionErrorState message={error} />
          : <div className="feedback-card is-error">{error}</div>
      )}

      {!isGuestPreview && !error && (isLoading || isRefreshingQuery) && (
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

      {(isGuestPreview || (!isLoading && !isRefreshingQuery && !error)) && (
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
                    <img
                      className="collection-poster"
                      src={item.anime.coverImageExtraLarge || item.anime.coverImageLarge}
                      alt={getCollectionDisplayTitle(item)}
                      loading="lazy"
                    />
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
