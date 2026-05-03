import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CollectionButton } from '../components/CollectionButton'
import {
  fetchAnimeList,
  genreOptions,
  getDisplayTitle,
  getPrimaryPoster,
  searchAnime,
  sortOptions,
} from '../lib/anime'
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

export function ExplorePage() {
  const [sort, setSort] = useState<AnimeSort>('score')
  const [genre, setGenre] = useState<AnimeGenre | 'all'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [searchLanguage, setSearchLanguage] = useState<'ko' | 'en'>('ko')
  const normalizedQuery = debouncedSearchTerm.trim()
  const selectedGenre = genre === 'all' ? null : genre
  const selectedGenreLabel =
    genre === 'all'
      ? '전체 장르'
      : genreOptions.find((option) => option.value === genre)?.label ?? genre
  const requestKey = `${sort}:${normalizedQuery}:${searchLanguage}:${genre}`
  const [state, setState] = useState<ExploreState>(() =>
    createInitialExploreState(requestKey),
  )
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const { animeItems, nextCursor, hasNext, isLoading, isLoadingMore, error } = state
  const isRefreshingQuery = state.requestKey !== requestKey

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 300)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [searchTerm])

  useEffect(() => {
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
        <div className="explore-summary">
          <span className="summary-label">애니 총</span>
          <strong>{animeItems.length.toLocaleString()}</strong>
          <span className="summary-label">편</span>
          <span className="search-hint-tooltip" title="한국어로 검색이 안 될 시 영어로 검색해보세요.">
            i
          </span>
        </div>

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
          <div className="results-meta minimalist-meta">
            <span>{animeItems.length}개의 작품 표시 중</span>
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
                <Link className="anime-card anime-card-link" key={item.id} to={`/anime/${item.id}`}>
                  <div className="anime-poster-wrap">
                    <div
                      className="anime-card-quick-action"
                      onClick={(event) => event.preventDefault()}
                    >
                      <CollectionButton animeId={item.id} />
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
