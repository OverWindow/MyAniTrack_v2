import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { CollectionEditor } from '../components/CollectionEditor'
import { useAuth } from '../contexts/AuthContext'
import { updateAnimeKoreanTitle } from '../lib/admin'
import {
  fetchAnimeDetail,
  getDetailMetaTitle,
  getGenreLabel,
  getPrimaryPoster,
} from '../lib/anime'
import type { AnimeDetailItem } from '../types/anime'
import '../styles/pages/AnimeDetailPage.css'

type DetailState = {
  item: AnimeDetailItem | null
  isLoading: boolean
  error: string | null
  requestKey: string
}

type AnimeDetailPageProps = {
  isOverlay?: boolean
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

type AdminTitleEditorProps = {
  item: AnimeDetailItem
  onTitleUpdated: (updatedTitle: {
    title: string
    subtitle: string | null
    fullTitle: string
  }) => void
}

function AdminTitleEditor({ item, onTitleUpdated }: AdminTitleEditorProps) {
  const primaryKoreanTitle = item.titles.korean?.find((title) => title.isPrimary) ?? item.titles.korean?.[0]
  const [adminTitle, setAdminTitle] = useState(primaryKoreanTitle?.title ?? '')
  const [adminSubtitle, setAdminSubtitle] = useState(primaryKoreanTitle?.subtitle ?? '')
  const [isSavingAdminTitle, setIsSavingAdminTitle] = useState(false)
  const [adminTitleFeedback, setAdminTitleFeedback] = useState<string | null>(null)
  const [adminTitleError, setAdminTitleError] = useState<string | null>(null)

  const handleAdminTitleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isSavingAdminTitle) {
      return
    }

    const nextTitle = adminTitle.trim()
    const nextSubtitle = adminSubtitle.trim()

    if (!nextTitle) {
      setAdminTitleError('한국어 제목을 입력해주세요.')
      return
    }

    setIsSavingAdminTitle(true)
    setAdminTitleFeedback(null)
    setAdminTitleError(null)

    try {
      const response = await updateAnimeKoreanTitle(item.id, {
        title: nextTitle,
        subtitle: nextSubtitle,
      })
      const updatedTitle = response.item

      onTitleUpdated({
        title: updatedTitle.title,
        subtitle: updatedTitle.subtitle,
        fullTitle: updatedTitle.fullTitle,
      })
      setAdminTitle(updatedTitle.title)
      setAdminSubtitle(updatedTitle.subtitle ?? '')
      setAdminTitleFeedback('한국어 제목을 저장하고 잠금 처리했어요.')
    } catch (saveError) {
      setAdminTitleError(saveError instanceof Error ? saveError.message : '한국어 제목 수정에 실패했어요.')
    } finally {
      setIsSavingAdminTitle(false)
    }
  }

  return (
    <section className="detail-section admin-title-editor">
      <span className="detail-label">Admin title lock</span>
      {/* <h2>한국어 제목 수정</h2> */}
      <form className="admin-title-form" onSubmit={handleAdminTitleSubmit}>
        <label className="auth-field">
          <span>대표 한국어 제목</span>
          <input
            type="text"
            value={adminTitle}
            onChange={(event) => setAdminTitle(event.target.value)}
            placeholder="장송의 프리렌"
            required
          />
        </label>

        <label className="auth-field">
          <span>부제목</span>
          <input
            type="text"
            value={adminSubtitle}
            onChange={(event) => setAdminSubtitle(event.target.value)}
            placeholder="비워두면 없음"
          />
        </label>

        {adminTitleFeedback && <div className="feedback-card admin-title-feedback">{adminTitleFeedback}</div>}
        {adminTitleError && <div className="feedback-card is-error admin-title-feedback">{adminTitleError}</div>}

        <button className="primary-button auth-submit" type="submit" disabled={isSavingAdminTitle}>
          {isSavingAdminTitle ? '저장 중...' : '제목 저장 및 잠금'}
        </button>
      </form>
    </section>
  )
}

export function AnimeDetailPage({ isOverlay = false }: AnimeDetailPageProps) {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const requestKey = id ?? 'invalid'
  const [state, setState] = useState<DetailState>(() =>
    createInitialDetailState(requestKey),
  )
  const { item, isLoading, error } = state
  const isRefreshingDetail = state.requestKey !== requestKey
  const isAdmin = Boolean(user?.isAdmin || user?.role === 'ADMIN')
  const fromPage = (location.state as { fromPage?: 'explore' | 'collection' } | null)?.fromPage
  const backPath = fromPage === 'collection' ? '/collection' : '/explore'
  const backLabel = fromPage === 'collection' ? '컬렉션으로 돌아가기' : '탐색으로 돌아가기'
  const detailPageClassName = isOverlay ? 'detail-page detail-page-overlay' : 'detail-page'

  const handleOverlayClose = () => {
    navigate(-1)
  }

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

  const handleAdminTitleUpdated = (updatedTitle: {
    title: string
    subtitle: string | null
    fullTitle: string
  }) => {
    setState((current) => {
      if (!current.item) {
        return current
      }

      const existingKoreanTitles = current.item.titles.korean ?? []
      const nextKoreanTitles = [
        {
          title: updatedTitle.title,
          subtitle: updatedTitle.subtitle,
          fullTitle: updatedTitle.fullTitle,
          isPrimary: true,
        },
        ...existingKoreanTitles
          .filter((title) => title.fullTitle !== updatedTitle.fullTitle)
          .map((title) => ({
            ...title,
            isPrimary: false,
          })),
      ]

      return {
        ...current,
        item: {
          ...current.item,
          title: updatedTitle.fullTitle,
          titles: {
            ...current.item.titles,
            korean: nextKoreanTitles,
          },
        },
      }
    })
  }

  if (!id) {
    return (
      <section className={detailPageClassName}>
        <div className="feedback-card is-error">잘못된 경로로 접근했어요.</div>
      </section>
    )
  }

  if (isLoading || isRefreshingDetail) {
    return (
      <section className={detailPageClassName}>
        {isOverlay && (
          <button className="detail-overlay-close" type="button" onClick={handleOverlayClose} aria-label="상세 닫기">
            ×
          </button>
        )}
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
      <section className={detailPageClassName}>
        {isOverlay && (
          <button className="detail-overlay-close" type="button" onClick={handleOverlayClose} aria-label="상세 닫기">
            ×
          </button>
        )}
        <div className="feedback-card is-error">{error ?? '작품 정보를 찾을 수 없어요.'}</div>
      </section>
    )
  }

  const koreanTitles = item.titles.korean ?? []
  const heroImage = item.bannerImage || getPrimaryPoster(item)

  return (
    <section className={detailPageClassName}>
      {isOverlay ? (
        <button className="detail-back-link detail-back-button" type="button" onClick={handleOverlayClose}>
          {backLabel}
        </button>
      ) : (
        <Link className="detail-back-link" to={backPath}>
          {backLabel}
        </Link>
      )}

      {isOverlay && (
        <button className="detail-overlay-close" type="button" onClick={handleOverlayClose} aria-label="상세 닫기">
          ×
        </button>
      )}

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
                <strong>{item.averageScore ? `${(item.averageScore / 10).toFixed(1)} / 10` : '미집계'}</strong>
              </div>
            </div>

            <div className="detail-actions">
              {item.siteUrl && (
                <a className="primary-button" href={item.siteUrl} target="_blank" rel="noreferrer">
                  원본 페이지 보기
                </a>
              )}
              {isOverlay ? (
                <button className="secondary-button" type="button" onClick={handleOverlayClose}>
                  다른 작품 더 보기
                </button>
              ) : (
                <Link className="secondary-button" to={backPath}>
                  다른 작품 더 보기
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="detail-layout">
        <div className="detail-left-column">
          <article className="detail-section detail-description">
            <span className="detail-label">Genres</span>
            <h2>장르</h2>
            {item.genres?.length ? (
              <div className="chip-list detail-chip-list-spacious">
                {item.genres.map((genre) => (
                  <span className="info-chip" key={genre}>
                    {getGenreLabel(genre)}
                  </span>
                ))}
              </div>
            ) : (
              <p className="detail-description-text">아직 등록된 장르 정보가 없어요.</p>
            )}
          </article>

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
        </div>

        <aside className="detail-sidebar">
          {isAdmin && (
            <AdminTitleEditor key={item.id} item={item} onTitleUpdated={handleAdminTitleUpdated} />
          )}

          <CollectionEditor key={item.id} animeId={item.id} maxProgress={item.episodes} />

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
