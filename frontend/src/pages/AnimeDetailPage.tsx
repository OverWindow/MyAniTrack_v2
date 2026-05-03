import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CollectionEditor } from '../components/CollectionEditor'
import {
  fetchAnimeDetail,
  getDetailMetaTitle,
  getPrimaryPoster,
  stripDescriptionMarkup,
} from '../lib/anime'
import type { AnimeDetailItem } from '../types/anime'
import '../styles/pages/AnimeDetailPage.css'

type DetailState = {
  item: AnimeDetailItem | null
  isLoading: boolean
  error: string | null
  requestKey: string
}

const createInitialDetailState = (requestKey: string): DetailState => ({
  item: null,
  isLoading: true,
  error: null,
  requestKey,
})

function getQuarterLabel(season?: string | null, seasonYear?: number | null) {
  const labelMap: Record<string, string> = {
    SPRING: '1분기',
    SUMMER: '2분기',
    FALL: '3분기',
    WINTER: '4분기',
  }

  const seasonLabel = season ? labelMap[season] ?? season : null
  return [seasonYear, seasonLabel].filter(Boolean).join(' ') || '정보 없음'
}

export function AnimeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const requestKey = id ?? 'invalid'
  const [state, setState] = useState<DetailState>(() =>
    createInitialDetailState(requestKey),
  )
  const { item, isLoading, error } = state
  const isRefreshingDetail = state.requestKey !== requestKey

  useEffect(() => {
    if (!id) {
      return
    }

    const controller = new AbortController()

    const loadDetail = async () => {
      try {
        const detail = await fetchAnimeDetail(id, controller.signal)

        setState({
          item: detail,
          isLoading: false,
          error: null,
          requestKey,
        })
      } catch (fetchError) {
        if (fetchError instanceof DOMException && fetchError.name === 'AbortError') {
          return
        }

        setState({
          item: null,
          isLoading: false,
          error:
            fetchError instanceof Error
              ? fetchError.message
              : '상세 정보를 가져오지 못했습니다.',
          requestKey,
        })
      }
    }

    void loadDetail()

    return () => controller.abort()
  }, [id, requestKey])

  if (!id) {
    return (
      <section className="detail-page">
        <div className="feedback-card is-error">잘못된 경로로 접근했어요.</div>
      </section>
    )
  }

  if (isLoading || isRefreshingDetail) {
    return (
      <section className="detail-page">
        <div className="detail-loading-card">
          <div className="detail-loading-banner" />
          <div className="detail-loading-lines">
            <div className="skeleton-line long" />
            <div className="skeleton-line short" />
          </div>
        </div>
      </section>
    )
  }

  if (error || !item) {
    return (
      <section className="detail-page">
        <div className="feedback-card is-error">{error ?? '작품 정보를 찾을 수 없어요.'}</div>
      </section>
    )
  }

  const koreanTitles = item.titles.korean ?? []
  const heroImage = item.bannerImage || getPrimaryPoster(item)

  return (
    <section className="detail-page">
      <Link className="detail-back-link" to="/explore">
        탐색으로 돌아가기
      </Link>

      <div className="detail-hero">
        <div
          className="detail-hero-backdrop"
          style={{ backgroundImage: `linear-gradient(180deg, rgba(18, 15, 18, 0.08), rgba(18, 15, 18, 0.74)), url(${heroImage})` }}
        />

        <div className="detail-hero-content">
          <div className="detail-cover-card">
            <img
              className="detail-cover"
              src={getPrimaryPoster(item)}
              alt={getDetailMetaTitle(item)}
            />
          </div>

          <div className="detail-copy">
            <span className="section-kicker">Anime detail</span>
            <h1 className="detail-title">{item.title}</h1>
            <p className="detail-subtitle">
              {item.titles.native || item.titles.romaji || item.titles.english}
            </p>

            <div className="detail-meta-grid">
              <div>
                <span>포맷</span>
                <strong>{item.format ?? '미정'}</strong>
              </div>
              <div>
                <span>방영</span>
                <strong>{getQuarterLabel(item.season, item.seasonYear)}</strong>
              </div>
              <div>
                <span>에피소드</span>
                <strong>
                  {item.episodes ? `${item.episodes}화 · ${item.duration ?? '?'}분` : '정보 없음'}
                </strong>
              </div>
              <div>
                <span>평점</span>
                <strong>{item.averageScore ? `${item.averageScore} / 100` : '미집계'}</strong>
              </div>
            </div>

            <div className="detail-actions">
              {item.siteUrl && (
                <a className="primary-button" href={item.siteUrl} target="_blank" rel="noreferrer">
                  원본 페이지 보기
                </a>
              )}
              <Link className="secondary-button" to="/explore">
                다른 작품 더 보기
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="detail-layout">
        <article className="detail-section detail-description">
          <span className="detail-label">Description</span>
          <h2>작품 소개</h2>
          <p className="detail-description-text">{stripDescriptionMarkup(item.description)}</p>
        </article>

        <aside className="detail-sidebar">
          <CollectionEditor animeId={item.id} maxProgress={item.episodes} />

          <section className="detail-section">
            <span className="detail-label">Overview</span>
            <div className="detail-facts">
              <div>
                <span>상태</span>
                <strong>{item.status ?? '정보 없음'}</strong>
              </div>
              <div>
                <span>원작</span>
                <strong>{item.source ?? '정보 없음'}</strong>
              </div>
              <div>
                <span>국가</span>
                <strong>{item.countryOfOrigin ?? '정보 없음'}</strong>
              </div>
              <div>
                <span>인기</span>
                <strong>{item.popularity?.toLocaleString() ?? '정보 없음'}</strong>
              </div>
              <div>
                <span>즐겨찾기</span>
                <strong>{item.favourites?.toLocaleString() ?? '정보 없음'}</strong>
              </div>
              <div>
                <span>성인 작품</span>
                <strong>{item.isAdult ? '예' : '아니오'}</strong>
              </div>
            </div>
          </section>

          {koreanTitles.length > 0 && (
            <section className="detail-section">
              <span className="detail-label">Korean titles</span>
              <div className="chip-list">
                {koreanTitles.map((title) => (
                  <span className="info-chip" key={title.fullTitle}>
                    {title.fullTitle}
                  </span>
                ))}
              </div>
            </section>
          )}

          {!!item.genres?.length && (
            <section className="detail-section">
              <span className="detail-label">Genres</span>
              <div className="chip-list">
                {item.genres.map((genre) => (
                  <span className="info-chip" key={genre}>
                    {genre}
                  </span>
                ))}
              </div>
            </section>
          )}

          {!!item.tags?.length && (
            <section className="detail-section">
              <span className="detail-label">Tags</span>
              <div className="chip-list">
                {item.tags.map((tag) => (
                  <span className="info-chip" key={tag.name}>
                    {tag.name}
                  </span>
                ))}
              </div>
            </section>
          )}

          {!!item.synonyms?.length && (
            <section className="detail-section">
              <span className="detail-label">Synonyms</span>
              <div className="chip-list">
                {item.synonyms.map((synonym) => (
                  <span className="info-chip" key={synonym}>
                    {synonym}
                  </span>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
    </section>
  )
}
