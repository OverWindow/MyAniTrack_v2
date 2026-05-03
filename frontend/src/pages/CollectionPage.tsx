import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { fetchMyCollection } from '../lib/collection'
import { genreOptions } from '../lib/anime'
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

const sortOptions: Array<{ value: UserAnimeListSort; label: string }> = [
  { value: 'latest', label: '최근 수정순' },
  { value: 'added', label: '추가 최신순' },
  { value: 'score', label: '내 점수 높은 순' },
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
  const { isAuthenticated } = useAuth()
  const [sort, setSort] = useState<UserAnimeListSort>('latest')
  const [genre, setGenre] = useState<AnimeGenre | 'all'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const selectedGenre = genre === 'all' ? null : genre
  const selectedGenreLabel =
    genre === 'all'
      ? '전체 장르'
      : genreOptions.find((option) => option.value === genre)?.label ?? genre
  const requestKey = `${sort}:${genre}:${reloadKey}`
  const [state, setState] = useState<CollectionState>(() =>
    createInitialCollectionState(requestKey),
  )
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const { items, nextCursor, hasNext, isLoading, isLoadingMore, error } = state
  const isRefreshingQuery = state.requestKey !== requestKey

  const filteredItems = items.filter((item) =>
    getCollectionSearchText(item).includes(searchTerm.trim().toLowerCase()),
  )

  useEffect(() => {
    if (!isAuthenticated) {
      return
    }

    const controller = new AbortController()

    const loadFirstPage = async () => {
      try {
        const data = await fetchMyCollection({
          sort,
          genre: selectedGenre,
          limit: 24,
          signal: controller.signal,
        })

        setState({
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
          items: [],
          nextCursor: null,
          hasNext: false,
          isLoading: false,
          isLoadingMore: false,
          error:
            fetchError instanceof Error
              ? fetchError.message
              : '컬렉션을 불러오지 못했어요.',
          requestKey,
        })
      }
    }

    void loadFirstPage()

    return () => controller.abort()
  }, [isAuthenticated, requestKey, selectedGenre, sort])

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

        if (!entry?.isIntersecting) {
          return
        }

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
              error:
                fetchError instanceof Error
                  ? fetchError.message
                  : '추가 컬렉션을 불러오지 못했어요.',
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
    isAuthenticated,
    isLoading,
    isLoadingMore,
    isRefreshingQuery,
    nextCursor,
    selectedGenre,
    sort,
  ])

  if (!isAuthenticated) {
    return (
      <section className="collection-page">
        <div className="feedback-card">
          컬렉션은 로그인한 사용자만 볼 수 있어요. <Link to="/login">로그인</Link> 후
          다시 확인해주세요.
        </div>
      </section>
    )
  }

  return (
    <section className="collection-page">
      <div className="explore-toolbar-shell">
        <div className="explore-summary">
          <span className="summary-label">내 리스트</span>
          <strong>{items.length.toLocaleString()}</strong>
          <span className="summary-label">편</span>
        </div>

        <div className="explore-toolbar">
          <div className="search-group">
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
              aria-label="컬렉션 새로고침"
              onClick={() => setReloadKey((value) => value + 1)}
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

      {error && <div className="feedback-card is-error">{error}</div>}

      {!error && (isLoading || isRefreshingQuery) && (
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

      {!isLoading && !isRefreshingQuery && !error && (
        <>
          <div className="results-meta minimalist-meta">
            <span>{filteredItems.length}개의 작품 표시 중</span>
            <span>제목 우선순위: 한국어 → 영어</span>
            <span>{selectedGenreLabel}</span>
          </div>

          {filteredItems.length === 0 ? (
            <div className="feedback-card">
              아직 컬렉션에 담긴 작품이 없거나, 검색 결과가 없어요.
            </div>
          ) : (
            <div className="collection-grid">
              {filteredItems.map((item) => (
                <Link
                  className="collection-card"
                  key={item.id}
                  to={`/anime/${item.anime.id}`}
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

          {isLoadingMore && (
            <div className="feedback-inline">컬렉션을 더 불러오는 중이에요.</div>
          )}

          {!hasNext && items.length > 0 && (
            <div className="feedback-inline">컬렉션의 마지막 작품까지 모두 확인했어요.</div>
          )}
        </>
      )}
    </section>
  )
}
