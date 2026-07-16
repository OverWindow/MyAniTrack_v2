import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { CollectionEditor } from '../components/CollectionEditor'
import { useAuth } from '../contexts/AuthContext'
import { updateAnimeKoreanTitle } from '../lib/admin'
import {
  fetchAnimeCast,
  fetchAnimeDetail,
  getDetailMetaTitle,
  getGenreLabel,
  getPrimaryPoster,
  searchAnimeWithRelations,
} from '../lib/anime'
import { createSampleAnimeDetail, fetchSampleCollection } from '../lib/sample'
import type { AnimeCastCharacter, AnimeDetailItem, AnimeRelationItem, AnimeRelationType } from '../types/anime'
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

type CastState = {
  items: AnimeCastCharacter[]
  isLoading: boolean
  error: string | null
}

type RelationState = {
  items: AnimeRelationItem[]
  isLoading: boolean
  error: string | null
}

const relationTypeLabels: Record<AnimeRelationType, string> = {
  PREQUEL: '이전 이야기',
  SEQUEL: '후속작',
  PARENT: '본편',
  SIDE_STORY: '외전',
  SPIN_OFF: '스핀오프',
  ADAPTATION: '각색작',
  SOURCE: '원작',
  SUMMARY: '총집편',
  ALTERNATIVE: '다른 버전',
  CHARACTER: '캐릭터 연관',
  COMPILATION: '모음집',
  CONTAINS: '포함 작품',
  OTHER: '기타 관계',
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

function getCastDisplayName(name: { full?: string | null; native?: string | null; userPreferred?: string | null }) {
  return name.userPreferred || name.full || name.native || '이름 정보 없음'
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
  const { isAuthenticated, user } = useAuth()
  const routeState = location.state as {
    fromPage?: 'explore' | 'collection'
    sampleAnimeDetail?: AnimeDetailItem
  } | null
  const sampleAnimeDetail = routeState?.sampleAnimeDetail ?? null
  const requestKey = id ?? 'invalid'
  const [state, setState] = useState<DetailState>(() =>
    sampleAnimeDetail
      ? {
        item: sampleAnimeDetail,
        isLoading: false,
        error: null,
        requestKey,
      }
      : createInitialDetailState(requestKey),
  )
  const [castState, setCastState] = useState<CastState>({
    items: [],
    isLoading: false,
    error: null,
  })
  const [relationState, setRelationState] = useState<RelationState>({
    items: [],
    isLoading: false,
    error: null,
  })
  const { item, isLoading, error } = state
  const isSampleDetail = Boolean(sampleAnimeDetail || item?.source === 'Sample')
  const isRefreshingDetail = state.requestKey !== requestKey
  const isAdmin = Boolean(user?.isAdmin || user?.role === 'ADMIN')
  const fromPage = routeState?.fromPage
  const backPath = fromPage === 'collection' ? '/collection' : '/explore'
  const detailPageClassName = isOverlay ? 'detail-page detail-page-overlay' : 'detail-page'
  const relationSearchQuery = item ? (getDetailMetaTitle(item).trim() || item.title) : ''

  const handleOverlayClose = () => {
    navigate(-1)
  }

  useEffect(() => {
    if (!id) {
      return
    }

    if (sampleAnimeDetail) {
      const sampleTimer = window.setTimeout(() => {
        setState({
          item: sampleAnimeDetail,
          isLoading: false,
          error: null,
          requestKey,
        })
      })
      return () => window.clearTimeout(sampleTimer)
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

        if (!isAuthenticated) {
          try {
            const sampleCollection = await fetchSampleCollection({
              sort: 'score',
              limit: 50,
              signal: controller.signal,
            })
            const sampleItem = sampleCollection.items.find((entry) => String(entry.anime.id) === id)

            if (sampleItem) {
              setState({
                item: createSampleAnimeDetail(sampleItem),
                isLoading: false,
                error: null,
                requestKey,
              })
              return
            }
          } catch {
            // Keep the original detail error below.
          }
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
  }, [id, isAuthenticated, requestKey, sampleAnimeDetail])

  useEffect(() => {
    if (isSampleDetail || !item?.id) {
      const resetTimer = window.setTimeout(() => {
        setCastState({
          items: [],
          isLoading: false,
          error: null,
        })
      })
      return () => window.clearTimeout(resetTimer)
    }

    const controller = new AbortController()
    const animeId = item.id

    const loadingTimer = window.setTimeout(() => {
      setCastState({
        items: [],
        isLoading: true,
        error: null,
      })
    })

    const loadCast = async () => {
      try {
        const items = await fetchAnimeCast({
          animeId,
          role: 'MAIN',
          limit: 20,
          voiceLanguage: 'Japanese',
          signal: controller.signal,
        })

        setCastState({
          items,
          isLoading: false,
          error: null,
        })
      } catch (castError) {
        if (castError instanceof DOMException && castError.name === 'AbortError') {
          return
        }

        setCastState({
          items: [],
          isLoading: false,
          error: castError instanceof Error ? castError.message : '캐릭터/성우 정보를 불러오지 못했어요.',
        })
      }
    }

    void loadCast()

    return () => {
      window.clearTimeout(loadingTimer)
      controller.abort()
    }
  }, [isSampleDetail, item?.id])

  useEffect(() => {
    if (isSampleDetail || !item?.id) {
      const resetTimer = window.setTimeout(() => {
        setRelationState({ items: [], isLoading: false, error: null })
      })
      return () => window.clearTimeout(resetTimer)
    }

    const controller = new AbortController()
    const animeId = item.id
    const anilistId = item.anilistId
    const loadingTimer = window.setTimeout(() => {
      setRelationState({ items: [], isLoading: true, error: null })
    })

    const loadRelations = async () => {
      try {
        const response = await searchAnimeWithRelations({
          query: relationSearchQuery,
          titleLanguage: 'ko',
          sort: 'popularity',
          limit: 20,
          signal: controller.signal,
        })
        const matchedAnime = response.items.find((entry) => entry.id === animeId)
          ?? response.items.find((entry) => entry.anilistId === anilistId)
        const uniqueRelations = Array.from(
          new Map(
            (matchedAnime?.relations ?? [])
              .filter((relation) => relation.anime?.id !== animeId)
              .map((relation) => [relation.targetAnilistId, relation]),
          ).values(),
        )

        setRelationState({ items: uniqueRelations, isLoading: false, error: null })
      } catch (relationError) {
        if (relationError instanceof DOMException && relationError.name === 'AbortError') {
          return
        }

        setRelationState({
          items: [],
          isLoading: false,
          error: relationError instanceof Error ? relationError.message : '연관 작품을 불러오지 못했어요.',
        })
      }
    }

    void loadRelations()

    return () => {
      window.clearTimeout(loadingTimer)
      controller.abort()
    }
  }, [isSampleDetail, item?.anilistId, item?.id, relationSearchQuery])

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

  const heroImage = item.bannerImage || getPrimaryPoster(item)

  return (
    <section className={detailPageClassName}>
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
          <section className="detail-section detail-overview-card">
            <div className="detail-info-block detail-description">
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
            </div>

            <div className="detail-info-block">
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
            </div>
          </section>
        </div>

        <aside className="detail-sidebar">
          {isAdmin && (
            <AdminTitleEditor key={item.id} item={item} onTitleUpdated={handleAdminTitleUpdated} />
          )}

          {isSampleDetail ? (
            <section className="detail-section guest-detail-cta">
              <span className="detail-label">Sample detail</span>
              <h2>내 컬렉션에 담아 분석해볼까요?</h2>
              <p>로그인하면 감상 상태, 평점, 진행 화수를 직접 기록할 수 있어요.</p>
              <div className="guest-preview-actions">
                <Link className="primary-button" to="/signup">시작하기</Link>
                <Link className="secondary-button" to="/login">로그인</Link>
              </div>
            </section>
          ) : (
            <CollectionEditor
              key={item.id}
              animeId={item.id}
              maxProgress={item.episodes}
              targetAnime={{
                title: item.title,
                coverImageLarge: item.coverImageLarge,
                coverImageExtraLarge: item.coverImageExtraLarge,
              }}
            />
          )}

        </aside>
      </div>

      {(relationState.isLoading || (!relationState.error && relationState.items.length > 0)) && (
        <section className="detail-section detail-relations-section">
          <div className="detail-cast-heading">
            <div>
              <span className="detail-label">Related anime</span>
              <h2>이 작품과 연관된 애니</h2>
            </div>
          </div>

          {relationState.isLoading ? (
            <div className="detail-relations-grid" aria-label="연관 작품을 불러오는 중">
              {Array.from({ length: 4 }).map((_, index) => (
                <article className="detail-relation-card skeleton-card" key={`relation-skeleton-${index}`}>
                  <div className="detail-relation-poster" />
                  <div className="detail-relation-copy">
                    <div className="skeleton-line short" />
                    <div className="skeleton-line long" />
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="detail-relations-grid">
              {relationState.items.map((relation) => {
                const relatedAnime = relation.anime
                const poster = relatedAnime?.coverImageExtraLarge || relatedAnime?.coverImageLarge
                const content = (
                  <>
                    {poster ? (
                      <img className="detail-relation-poster" src={poster} alt="" loading="lazy" />
                    ) : (
                      <div className="detail-relation-poster detail-relation-poster-placeholder" aria-hidden="true">
                        {relation.targetAnilistId}
                      </div>
                    )}
                    <div className="detail-relation-copy">
                      <span>{relationTypeLabels[relation.relationType] ?? relation.relationType}</span>
                      <strong>{relatedAnime?.title || `AniList #${relation.targetAnilistId}`}</strong>
                      <small>{relation.resolved && relatedAnime ? '상세 보기' : '동기화 대기'}</small>
                    </div>
                  </>
                )

                return relation.resolved && relatedAnime ? (
                  <Link className="detail-relation-card" to={`/anime/${relatedAnime.id}`} key={relation.targetAnilistId}>
                    {content}
                  </Link>
                ) : (
                  <article className="detail-relation-card is-unresolved" key={relation.targetAnilistId}>
                    {content}
                  </article>
                )
              })}
            </div>
          )}
        </section>
      )}

      {(castState.isLoading || (!castState.error && castState.items.length > 0)) && (
        <section className="detail-section detail-cast-section">
          <div className="detail-cast-heading">
            <div>
              <span className="detail-label">Main cast</span>
              <h2>주요 캐릭터와 성우</h2>
            </div>
          </div>

          {castState.isLoading ? (
            <div className="detail-cast-grid">
              {Array.from({ length: 4 }).map((_, index) => (
                <article className="detail-cast-card skeleton-card" key={`cast-skeleton-${index}`}>
                  <div className="skeleton-line short" />
                  <div className="skeleton-line long" />
                </article>
              ))}
            </div>
          ) : (
            <div className="detail-cast-grid">
              {castState.items.map((character) => {
                const voiceActor = character.voiceActors[0]

                return (
                  <article className="detail-cast-card" key={character.id}>
                    <div className="detail-cast-person">
                      <img
                        src={character.image.large || character.image.medium || ''}
                        alt={getCastDisplayName(character.name)}
                        loading="lazy"
                      />
                      <div>
                        <span>Character</span>
                        <strong>{getCastDisplayName(character.name)}</strong>
                        {character.name.native && <small>{character.name.native}</small>}
                      </div>
                    </div>

                    {voiceActor && (
                      <Link className="detail-cast-person detail-cast-person-link" to={`/voice-actors/${voiceActor.id}`}>
                        <img
                          src={voiceActor.image.large || voiceActor.image.medium || ''}
                          alt={getCastDisplayName(voiceActor.name)}
                          loading="lazy"
                        />
                        <div>
                          <span>Voice actor</span>
                          <strong>{getCastDisplayName(voiceActor.name)}</strong>
                          {voiceActor.name.native && <small>{voiceActor.name.native}</small>}
                        </div>
                      </Link>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </section>
      )}
    </section>
  )
}
