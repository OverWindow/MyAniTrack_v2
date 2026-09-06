import { getLocaleTag } from '../i18n'
import { getTitleLanguage, tr } from '../i18n'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { CollectionCarousel } from '../components/CollectionCarousel'
import { CollectionViewSwitch } from '../components/CollectionViewSwitch'
import { ConnectionErrorState } from '../components/ConnectionErrorState'
import { ErrorToast } from '../components/ErrorToast'
import { SeriesCollectionGrid, SeriesCollectionSkeleton } from '../components/SeriesCollectionGrid'
import { genreOptions } from '../lib/anime'
import { getFriendlyErrorMessage } from '../lib/errors'
import { fetchPublicUserCollection, fetchPublicUserSeriesCollection } from '../lib/users'
import type { AnimeGenre } from '../types/anime'
import type {
  AnimeSeriesScope,
  UserAnimeListItem,
  UserAnimeListSort,
  UserSeriesCollectionItem,
  UserSeriesCollectionStatus,
} from '../types/collection'
import type { PublicUserProfile } from '../types/users'
import '../styles/pages/CatalogPage.css'
import '../styles/pages/CollectionPage.css'
import '../styles/pages/UserCollectionPage.css'

type PublicCollectionState = {
  user: PublicUserProfile | null
  items: UserAnimeListItem[]
  nextCursor: string | null
  hasNext: boolean
  isLoading: boolean
  isLoadingMore: boolean
  error: string | null
  requestKey: string
}

type PublicCarouselState = {
  items: UserAnimeListItem[]
  isLoading: boolean
  error: string | null
}

type PublicSeriesCollectionState = {
  items: UserSeriesCollectionItem[]
  isLoading: boolean
  error: string | null
  requestKey: string
}

const sortOptions: Array<{ value: UserAnimeListSort; label: string }> = [
  { value: 'latest', label: tr("최근 수정순") },
  { value: 'added', label: tr("추가 최신순") },
  { value: 'score', label: tr("내 점수 높은 순") },
]

const createInitialState = (requestKey: string): PublicCollectionState => ({
  user: null,
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
  const numericScore = typeof score === 'number' ? score : typeof score === 'string' ? Number(score) : NaN

  if (!Number.isFinite(numericScore) || numericScore <= 0) {
    return tr("평점 없음")
  }

  const filled = Math.round(numericScore / 2)
  return `${'★'.repeat(filled)}${'☆'.repeat(5 - filled)}`
}

function formatScore(score?: number | null) {
  const numericScore = typeof score === 'number' ? score : typeof score === 'string' ? Number(score) : NaN

  if (!Number.isFinite(numericScore)) {
    return ''
  }

  return numericScore.toFixed(1)
}

export function UserCollectionPage({ shareToken }: { shareToken?: string } = {}) {
  const location = useLocation()
  const { userId: routeUserId } = useParams<{ userId: string }>()
  const userId = shareToken ? 'shared' : routeUserId
  const [sort, setSort] = useState<UserAnimeListSort>('latest')
  const [genre, setGenre] = useState<AnimeGenre | 'all'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const searchLanguage = getTitleLanguage()
  const [viewMode, setViewMode] = useState<'anime' | 'series'>('anime')
  const [seriesScope, setSeriesScope] = useState<AnimeSeriesScope>('mainline')
  const [seriesStatus, setSeriesStatus] = useState<UserSeriesCollectionStatus>('all')
  const selectedGenre = genre === 'all' ? null : genre
  const requestOwnerKey = shareToken ? `share:${shareToken}` : userId ?? 'unknown'
  const requestKey = `anime:${requestOwnerKey}:${sort}:${genre}:${searchLanguage}`
  const seriesRequestKey = `series:${requestOwnerKey}:${seriesScope}:${seriesStatus}:${searchLanguage}:${debouncedSearchTerm.trim()}`
  const [state, setState] = useState<PublicCollectionState>(() => createInitialState(requestKey))
  const [seriesState, setSeriesState] = useState<PublicSeriesCollectionState>({
    items: [],
    isLoading: true,
    error: null,
    requestKey: seriesRequestKey,
  })
  const [carouselState, setCarouselState] = useState<PublicCarouselState>({
    items: [],
    isLoading: true,
    error: null,
  })
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const { user, items, nextCursor, hasNext, isLoading, isLoadingMore, error } = state
  const isRefreshingQuery = state.requestKey !== requestKey
  const isRefreshingSeriesQuery = seriesState.requestKey !== seriesRequestKey
  const totalAnimeCount = user?.animeListCount ?? items.length

  const filteredItems = items.filter((item) =>
    getCollectionSearchText(item).includes(searchTerm.trim().toLowerCase()),
  )

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 550)

    return () => window.clearTimeout(timeoutId)
  }, [searchTerm])

  useEffect(() => {
    if (!shareToken) return

    const main = document.querySelector('main.landing-page')
    main?.classList.add('landing-page-user-collection')

    return () => main?.classList.remove('landing-page-user-collection')
  }, [shareToken])

  useEffect(() => {
    if (!userId || viewMode !== 'anime') {
      return
    }

    const controller = new AbortController()

    const loadFirstPage = async () => {
      try {
        const data = await fetchPublicUserCollection({
          userId,
          shareToken,
          sort,
          genre: selectedGenre,
          titleLanguage: searchLanguage,
          limit: 24,
          signal: controller.signal,
        })

        setState({
          user: data.user,
          items: data.items,
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
          user: null,
          items: [],
          nextCursor: null,
          hasNext: false,
          isLoading: false,
          isLoadingMore: false,
          error: getFriendlyErrorMessage(fetchError, tr("컬렉션을 불러오지 못했어요.")),
          requestKey,
        })
      }
    }

    void loadFirstPage()

    return () => controller.abort()
  }, [genre, requestKey, searchLanguage, selectedGenre, shareToken, sort, userId, viewMode])

  useEffect(() => {
    if (!userId || viewMode !== 'series') {
      return
    }

    const controller = new AbortController()

    const loadSeries = async () => {
      setSeriesState((current) => ({
        ...current,
        isLoading: true,
        error: null,
        requestKey: seriesRequestKey,
      }))

      try {
        const firstPage = await fetchPublicUserSeriesCollection({
          userId,
          shareToken,
          scope: seriesScope,
          status: seriesStatus,
          titleLanguage: searchLanguage,
          query: debouncedSearchTerm,
          limit: 50,
          signal: controller.signal,
        })
        const allItems = [...firstPage.items]
        const seenSeriesIds = new Set(allItems.map((item) => item.seriesId))
        const seenCursors = new Set<string>()
        let cursor = firstPage.pageInfo.nextCursor
        let hasMore = firstPage.pageInfo.hasNext

        while (hasMore && cursor && !seenCursors.has(cursor)) {
          seenCursors.add(cursor)
          const nextPage = await fetchPublicUserSeriesCollection({
            userId,
            shareToken,
            scope: seriesScope,
            status: seriesStatus,
            titleLanguage: searchLanguage,
            query: debouncedSearchTerm,
            limit: 50,
            cursor,
            signal: controller.signal,
          })

          for (const item of nextPage.items) {
            if (!seenSeriesIds.has(item.seriesId)) {
              seenSeriesIds.add(item.seriesId)
              allItems.push(item)
            }
          }

          const nextCursor = nextPage.pageInfo.nextCursor
          hasMore = nextPage.pageInfo.hasNext && Boolean(nextCursor) && nextCursor !== cursor
          cursor = nextCursor
        }

        if (controller.signal.aborted) return

        setState((current) => ({ ...current, user: firstPage.user }))
        setSeriesState({
          items: allItems,
          isLoading: false,
          error: null,
          requestKey: seriesRequestKey,
        })
      } catch (fetchError) {
        if (fetchError instanceof DOMException && fetchError.name === 'AbortError') return

        setSeriesState({
          items: [],
          isLoading: false,
          error: getFriendlyErrorMessage(fetchError, tr("시리즈 컬렉션을 불러오지 못했어요.")),
          requestKey: seriesRequestKey,
        })
      }
    }

    void loadSeries()

    return () => controller.abort()
  }, [debouncedSearchTerm, searchLanguage, seriesRequestKey, seriesScope, seriesStatus, shareToken, userId, viewMode])

  useEffect(() => {
    if (!userId) {
      return
    }

    const controller = new AbortController()

    const loadCarouselItems = async () => {
      setCarouselState((current) => ({ ...current, isLoading: true, error: null }))

      try {
        const data = await fetchPublicUserCollection({
          userId,
          shareToken,
          sort: 'score',
          score: 10,
          limit: 12,
          signal: controller.signal,
        })

        setCarouselState({
          items: data.items,
          isLoading: false,
          error: null,
        })
      } catch (fetchError) {
        if (fetchError instanceof DOMException && fetchError.name === 'AbortError') {
          return
        }

        setCarouselState({
          items: [],
          isLoading: false,
          error: getFriendlyErrorMessage(fetchError, tr("최애 애니를 불러오지 못했어요.")),
        })
      }
    }

    void loadCarouselItems()

    return () => controller.abort()
  }, [shareToken, userId])

  useEffect(() => {
    const node = sentinelRef.current

    if (
      viewMode !== 'anime'
      || !userId
      || !node
      || !hasNext
      || isLoading
      || isLoadingMore
      || !nextCursor
      || isRefreshingQuery
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
            const data = await fetchPublicUserCollection({
              userId,
              shareToken,
              sort,
              genre: selectedGenre,
              titleLanguage: searchLanguage,
              limit: 24,
              cursor: nextCursor,
            })

            setState((current) => {
              const merged = [...current.items, ...data.items]
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
                user: data.user,
                items: deduped,
                nextCursor: data.pageInfo.nextCursor,
                hasNext: data.pageInfo.hasNext,
                isLoadingMore: false,
              }
            })
          } catch (fetchError) {
            setState((current) => ({
              ...current,
              isLoadingMore: false,
              error: getFriendlyErrorMessage(fetchError, tr("추가 컬렉션을 불러오지 못했어요.")),
            }))
          }
        }

        void loadMore()
      },
      { rootMargin: '280px 0px' },
    )

    observer.observe(node)

    return () => observer.disconnect()
  }, [hasNext, isLoading, isLoadingMore, isRefreshingQuery, nextCursor, searchLanguage, selectedGenre, shareToken, sort, userId, viewMode])

  if (!userId) {
    return (
      <section className="collection-page">
        <ErrorToast message={tr("잘못된 사용자 경로예요.")} />
        <div className="feedback-card">{tr("요청한 컬렉션을 열 수 없어요.")}</div>
      </section>
    )
  }

  return (
    <>
    <section className="collection-page user-collection-page user-collection-page-header">
      <div className="user-catalog-header">
        <div className="user-catalog-title-group">
          {shareToken ? (
            <Link className="detail-back-link" to="/">
              {tr("홈으로 돌아가기")}
            </Link>
          ) : (
            <Link className="detail-back-link" to={`/users/${userId}/profile`}>
              {tr("프로필로 돌아가기")}
            </Link>
          )}
          {user && <h1>{user.username}{tr("님의 컬렉션")}</h1>}
        </div>
        <div className="user-collection-count-card">
          <span className="summary-label">{tr("공개 컬렉션")}</span>
          <strong>{totalAnimeCount.toLocaleString(getLocaleTag())}</strong>
          <span className="summary-label">{tr("편")}</span>
        </div>
      </div>
    </section>

    <CollectionCarousel
      state={carouselState}
      title={tr("{{v0}}님의 최애 애니", { v0: user?.username ?? '친구' })}
      ariaLabel={tr("{{v0}}님의 최애 애니", { v0: user?.username ?? '친구' })}
    />

    <section className="collection-page user-collection-page user-collection-page-content">
      <div className="explore-toolbar-shell">
        <div className="explore-toolbar">
          <div className="search-group">
            <CollectionViewSwitch value={viewMode} onChange={setViewMode} />
            <label className="search-field minimalist-search" htmlFor="user-collection-search">
              <input
                id="user-collection-search"
                type="search"
                placeholder={viewMode === 'series' ? tr("시리즈 또는 작품 제목 검색") : tr("컬렉션에서 검색하기")}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </label>
          </div>

          <div className="catalog-control-group">
            {viewMode === 'series' ? (
              <>
                <label className="sort-field" htmlFor="user-collection-series-scope">
                  <select
                    id="user-collection-series-scope"
                    value={seriesScope}
                    onChange={(event) => setSeriesScope(event.target.value as AnimeSeriesScope)}
                  >
                    <option value="mainline">{tr("본편 시리즈")}</option>
                    <option value="franchise">{tr("관련 작품 전체")}</option>
                  </select>
                </label>
                <label className="sort-field" htmlFor="user-collection-series-status">
                  <select
                    id="user-collection-series-status"
                    value={seriesStatus}
                    onChange={(event) => setSeriesStatus(event.target.value as UserSeriesCollectionStatus)}
                  >
                    <option value="all">{tr("전체 시리즈")}</option>
                    <option value="started">{tr("시작한 시리즈")}</option>
                    <option value="watched">{tr("본 시리즈")}</option>
                    <option value="completed">{tr("완주한 시리즈")}</option>
                  </select>
                </label>
              </>
            ) : (
              <>
                <label className="sort-field" htmlFor="user-collection-genre">
                  <select id="user-collection-genre" value={genre} onChange={(event) => setGenre(event.target.value as AnimeGenre | 'all')}>
                    <option value="all">{tr("전체 장르")}</option>
                    {genreOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>

                <label className="sort-field" htmlFor="user-collection-sort">
                  <select id="user-collection-sort" value={sort} onChange={(event) => setSort(event.target.value as UserAnimeListSort)}>
                    {sortOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </>
            )}
          </div>
        </div>
      </div>

      {viewMode === 'anime' && error && (
        <ConnectionErrorState message={error} />
      )}

      {viewMode === 'anime' && !error && (isLoading || isRefreshingQuery) && (
        <div className="collection-grid">
          {Array.from({ length: 8 }).map((_, index) => (
            <article className="collection-card skeleton-card" key={`user-collection-skeleton-${index}`}>
              <div className="skeleton-poster" />
              <div className="skeleton-line short" />
              <div className="skeleton-line long" />
            </article>
          ))}
        </div>
      )}

      {viewMode === 'anime' && !isLoading && !isRefreshingQuery && !error && (
        <>
          {filteredItems.length === 0 ? (
            <div className="feedback-card">{tr("아직 공개된 컬렉션이 없거나, 검색 결과가 없어요.")}</div>
          ) : (
            <div className="collection-grid">
              {filteredItems.map((item) => (
                <Link className="collection-card" key={item.id} to={`/anime/${item.anime.id}`}>
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
                      <span className="collection-score">{formatScore(item.score)}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          <div ref={sentinelRef} className="scroll-sentinel" aria-hidden="true" />

          {isLoadingMore && <div className="feedback-inline">{tr("컬렉션을 더 불러오는 중이에요.")}</div>}
          {!hasNext && items.length > 0 && <div className="feedback-inline">{tr("마지막 작품까지 모두 확인했어요.")}</div>}
        </>
      )}

      {viewMode === 'series' && seriesState.error && (
        <ConnectionErrorState message={seriesState.error} />
      )}

      {viewMode === 'series' && !seriesState.error && (seriesState.isLoading || isRefreshingSeriesQuery) && (
        <SeriesCollectionSkeleton />
      )}

      {viewMode === 'series' && !seriesState.error && !seriesState.isLoading && !isRefreshingSeriesQuery && (
        seriesState.items.length === 0 ? (
          <div className="feedback-card">{tr("조건에 맞는 시리즈가 없어요.")}</div>
        ) : (
          <SeriesCollectionGrid
            items={seriesState.items}
            location={location}
            fromPage="user-collection"
            collectionLabel={tr("컬렉션")}
          />
        )
      )}
    </section>
    </>
  )
}
