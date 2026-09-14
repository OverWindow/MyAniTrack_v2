import { tr } from '../i18n'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { ChevronLeft, ChevronRight, EllipsisVertical } from 'lucide-react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import animeCardBack from '../assets/anime-card-back.png'
import { CollectionEditor } from '../components/CollectionEditor'
import { CatalogSubmissionDialog } from '../components/CatalogSubmissionDialog'
import { CatalogLinkDialog } from '../components/CatalogLinkDialog'
import { ConnectionErrorState } from '../components/ConnectionErrorState'
import { ErrorToast } from '../components/ErrorToast'
import { useAuth } from '../contexts/AuthContext'
import { useAppLanguage } from '../contexts/LanguageContext'
import { updateAnimeKoreanTitle } from '../lib/admin'
import {
  fetchAnimeCast,
  fetchAnimeDetail,
  getDetailMetaTitle,
  getGenreLabel,
  getPrimaryPoster,
  fetchAnimeRelations,
} from '../lib/anime'
import {
  flipAnimeCard,
  getDraggedCardRotation,
  isCardBackVisible,
  snapAnimeCardRotation,
} from '../lib/anime-card'
import type { AnimeCardRotation } from '../lib/anime-card'
import { getCachedCollectionEntry } from '../lib/collection'
import { createSampleAnimeDetail, fetchSampleCollection } from '../lib/sample'
import type { AnimeCastCharacter, AnimeDetailItem, AnimeRelationItem, AnimeRelationType } from '../types/anime'
import type { CatalogEntityType } from '../types/admin'
import type { UserAnimeListEntry } from '../types/collection'
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
  PREQUEL: tr("이전 이야기"),
  SEQUEL: tr("후속작"),
  PARENT: tr("본편"),
  SIDE_STORY: tr("외전"),
  SPIN_OFF: tr("스핀오프"),
  ADAPTATION: tr("각색작"),
  SOURCE: tr("원작"),
  SUMMARY: tr("총집편"),
  ALTERNATIVE: tr("다른 버전"),
  CHARACTER: tr("캐릭터 연관"),
  COMPILATION: tr("모음집"),
  CONTAINS: tr("포함 작품"),
  OTHER: tr("기타 관계"),
}

const createInitialDetailState = (requestKey: string): DetailState => ({
  item: null,
  isLoading: true,
  error: null,
  requestKey,
})

function getQuarterLabel(season?: string | null, seasonYear?: number | null) {
  const labelMap: Record<string, string> = {
    SPRING: tr("1분기"),
    SUMMER: tr("2분기"),
    FALL: tr("3분기"),
    WINTER: tr("4분기"),
  }

  const seasonLabel = season ? labelMap[season] ?? season : null
  return [seasonYear, seasonLabel].filter(Boolean).join(' ') || tr("정보 없음")
}

function getCastDisplayName(name: { full?: string | null; native?: string | null; userPreferred?: string | null }) {
  return name.userPreferred || name.full || name.native || tr("이름 정보 없음")
}

function getDetailSubtitle(item: AnimeDetailItem) {
  return [item.titles.native, item.titles.romaji, item.titles.english]
    .find((title) => title?.trim() && title.trim() !== item.title.trim()) ?? null
}

type InteractiveAnimeVisualProps = {
  item: AnimeDetailItem
  heroImage: string
  reduceMotion: boolean
  score: number | null
}

function getStarFillPercent(score: number, starIndex: number) {
  const scoreInStars = score / 2
  const fill = Math.max(0, Math.min(1, scoreInStars - starIndex))
  return `${fill * 100}%`
}

function InteractiveAnimeVisual({ item, heroImage, reduceMotion, score }: InteractiveAnimeVisualProps) {
  const cardRef = useRef<HTMLButtonElement | null>(null)
  const rotationRef = useRef<AnimeCardRotation>({ x: 0, y: 0 })
  const suppressClickRef = useRef(false)
  const dragRef = useRef<{
    pointerId: number
    pointerX: number
    pointerY: number
    startRotation: AnimeCardRotation
    hasMoved: boolean
  } | null>(null)
  const [isBackVisible, setIsBackVisible] = useState(false)

  const setRotation = useCallback((rotation: AnimeCardRotation) => {
    const card = cardRef.current
    if (!card) return

    rotationRef.current = rotation
    card.style.setProperty('--detail-card-rotation-x', `${rotation.x.toFixed(2)}deg`)
    card.style.setProperty('--detail-card-rotation-y', `${rotation.y.toFixed(2)}deg`)
    const nextIsBackVisible = isCardBackVisible(rotation)
    setIsBackVisible((current) => current === nextIsBackVisible ? current : nextIsBackVisible)
  }, [])

  const toggleFace = useCallback(() => {
    setRotation(flipAnimeCard(rotationRef.current))
  }, [setRotation])

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (reduceMotion || event.button !== 0) return

    suppressClickRef.current = false
    dragRef.current = {
      pointerId: event.pointerId,
      pointerX: event.clientX,
      pointerY: event.clientY,
      startRotation: { ...rotationRef.current },
      hasMoved: false,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    event.currentTarget.classList.add('is-dragging')
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    const deltaX = event.clientX - drag.pointerX
    const deltaY = event.clientY - drag.pointerY
    if (Math.hypot(deltaX, deltaY) >= 5) {
      drag.hasMoved = true
    }
    setRotation(getDraggedCardRotation(drag.startRotation, deltaX, deltaY))
  }

  const finishPointerInteraction = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    dragRef.current = null
    suppressClickRef.current = drag.hasMoved && event.type === 'pointerup'
    event.currentTarget.classList.remove('is-dragging')
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setRotation(snapAnimeCardRotation(rotationRef.current))
  }

  const handleClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (suppressClickRef.current) {
      event.preventDefault()
      suppressClickRef.current = false
      return
    }

    toggleFace()
  }

  return (
    <div className="detail-visual-stage">
      <div
        className="detail-visual-backdrop"
        style={{ backgroundImage: `url(${heroImage})` }}
        aria-hidden="true"
      />
      <div className="detail-visual-shade" aria-hidden="true" />
      <div className="detail-cover-perspective">
        <button
          type="button"
          className="detail-cover-card"
          ref={cardRef}
          data-reduce-motion={reduceMotion ? 'true' : 'false'}
          aria-label={isBackVisible
            ? tr("{{v0}} 카드 앞면 보기", { v0: item.title })
            : tr("{{v0}} 카드 뒷면 보기", { v0: item.title })}
          onClick={handleClick}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishPointerInteraction}
          onPointerCancel={finishPointerInteraction}
        >
          <span className="detail-cover-card-inner">
            <span className="detail-cover-face detail-cover-front">
              <img
                className="detail-cover"
                src={getPrimaryPoster(item)}
                alt={getDetailMetaTitle(item)}
                draggable={false}
              />
              <span className="detail-cover-copy">
                <strong>{item.title}</strong>
                {score !== null && score > 0 && (
                  <span className="detail-cover-rating" aria-label={tr("내 평점 {{v0}}점", { v0: score.toFixed(1) })}>
                    {Array.from({ length: 5 }).map((_, starIndex) => (
                      <span className="detail-cover-star" key={`${item.id}-cover-star-${starIndex}`}>
                        <span className="detail-cover-star-base" aria-hidden="true">★</span>
                        <span
                          className="detail-cover-star-fill"
                          aria-hidden="true"
                          style={{ width: getStarFillPercent(score, starIndex) }}
                        >
                          ★
                        </span>
                      </span>
                    ))}
                  </span>
                )}
              </span>
            </span>
            <span className="detail-cover-face detail-cover-back" aria-hidden="true">
              <img className="detail-cover" src={animeCardBack} alt="" draggable={false} />
            </span>
            <span className="detail-cover-edge is-left" aria-hidden="true" />
            <span className="detail-cover-edge is-right" aria-hidden="true" />
            <span className="detail-cover-edge is-top" aria-hidden="true" />
            <span className="detail-cover-edge is-bottom" aria-hidden="true" />
          </span>
        </button>
      </div>
    </div>
  )
}

function CompactGenreList({ genres }: { genres?: string[] }) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!genres?.length) return null

  const visibleGenres = isExpanded ? genres : genres.slice(0, 4)
  const hiddenCount = Math.max(0, genres.length - 4)

  return (
    <div className="detail-compact-genres" aria-label={tr("장르")}>
      {visibleGenres.map((genre) => (
        <span className="detail-compact-genre" key={genre}>{getGenreLabel(genre)}</span>
      ))}
      {hiddenCount > 0 && (
        <button
          type="button"
          className="detail-compact-genre detail-compact-genre-toggle"
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((current) => !current)}
        >
          {isExpanded ? tr("장르 접기") : `+${hiddenCount}`}
        </button>
      )}
    </div>
  )
}

type DetailActionMenuItem = {
  label: string
  onSelect: () => void
}

function DetailActionMenu({ label, items, compact = false }: {
  label: string
  items: DetailActionMenuItem[]
  compact?: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const menuId = useId()
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <div className={compact ? 'detail-action-menu-wrap is-compact' : 'detail-action-menu-wrap'} ref={wrapperRef}>
      <button
        type="button"
        className="detail-kebab-button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => setIsOpen((current) => !current)}
      >
        <EllipsisVertical size={19} aria-hidden="true" />
      </button>
      {isOpen && (
        <div className="detail-action-menu" id={menuId} role="menu">
          {items.map((item) => (
            <button
              type="button"
              role="menuitem"
              key={item.label}
              onClick={() => {
                setIsOpen(false)
                item.onSelect()
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function DetailHorizontalRail({ children, label, className = '', reduceMotion }: {
  children: ReactNode
  label: string
  className?: string
  reduceMotion: boolean
}) {
  const railRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{
    pointerId: number
    startX: number
    scrollLeft: number
    hasMoved: boolean
  } | null>(null)
  const suppressClickRef = useRef(false)
  const [scrollState, setScrollState] = useState({ canPrevious: false, canNext: false })

  const updateScrollState = useCallback(() => {
    const rail = railRef.current
    if (!rail) return

    const maxScrollLeft = Math.max(0, rail.scrollWidth - rail.clientWidth)
    const nextState = {
      canPrevious: rail.scrollLeft > 2,
      canNext: rail.scrollLeft < maxScrollLeft - 2,
    }
    setScrollState((current) => (
      current.canPrevious === nextState.canPrevious && current.canNext === nextState.canNext
        ? current
        : nextState
    ))
  }, [])

  useEffect(() => {
    const rail = railRef.current
    if (!rail) return

    const frame = window.requestAnimationFrame(updateScrollState)
    const observer = new ResizeObserver(updateScrollState)
    observer.observe(rail)

    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [children, updateScrollState])

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('button, input, select, textarea')) return

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      scrollLeft: event.currentTarget.scrollLeft,
      hasMoved: false,
    }
    suppressClickRef.current = false
    event.currentTarget.setPointerCapture(event.pointerId)
    event.currentTarget.classList.add('is-dragging')
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    const deltaX = event.clientX - drag.startX
    if (Math.abs(deltaX) >= 5) {
      drag.hasMoved = true
    }
    event.currentTarget.scrollLeft = drag.scrollLeft - deltaX
    updateScrollState()
  }

  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    dragRef.current = null
    suppressClickRef.current = drag.hasMoved && event.type === 'pointerup'
    event.currentTarget.classList.remove('is-dragging')
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    updateScrollState()
  }

  const handleClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!suppressClickRef.current) return

    event.preventDefault()
    event.stopPropagation()
    suppressClickRef.current = false
  }

  const scroll = (direction: -1 | 1) => {
    const rail = railRef.current
    if (!rail) return

    rail.scrollBy({
      left: direction * Math.max(220, rail.clientWidth * 0.82),
      behavior: reduceMotion ? 'auto' : 'smooth',
    })
  }

  return (
    <div className="detail-rail-shell">
      <button
        type="button"
        className="detail-rail-arrow is-previous"
        aria-label={tr("이전 항목 보기")}
        disabled={!scrollState.canPrevious}
        onClick={() => scroll(-1)}
      >
        <ChevronLeft size={20} aria-hidden="true" />
      </button>
      <div
        className={`detail-horizontal-rail ${className}`.trim()}
        ref={railRef}
        role="region"
        aria-label={label}
        tabIndex={0}
        onScroll={updateScrollState}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onClickCapture={handleClickCapture}
      >
        {children}
      </div>
      <button
        type="button"
        className="detail-rail-arrow is-next"
        aria-label={tr("다음 항목 보기")}
        disabled={!scrollState.canNext}
        onClick={() => scroll(1)}
      >
        <ChevronRight size={20} aria-hidden="true" />
      </button>
    </div>
  )
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
      setAdminTitleError(tr("한국어 제목을 입력해주세요."))
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
      setAdminTitleFeedback(tr("한국어 제목을 저장하고 잠금 처리했어요."))
    } catch (saveError) {
      setAdminTitleError(saveError instanceof Error ? saveError.message : tr("한국어 제목 수정에 실패했어요."))
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
          <span>{tr("대표 한국어 제목")}</span>
          <input
            type="text"
            value={adminTitle}
            onChange={(event) => setAdminTitle(event.target.value)}
            placeholder={tr("장송의 프리렌")}
            required
          />
        </label>

        <label className="auth-field">
          <span>{tr("부제목")}</span>
          <input
            type="text"
            value={adminSubtitle}
            onChange={(event) => setAdminSubtitle(event.target.value)}
            placeholder={tr("비워두면 없음")}
          />
        </label>

        {adminTitleFeedback && <div className="feedback-card admin-title-feedback">{adminTitleFeedback}</div>}
        <ErrorToast message={adminTitleError} />

        <button className="primary-button auth-submit" type="submit" disabled={isSavingAdminTitle}>
          {isSavingAdminTitle ? tr("저장 중...") : tr("제목 저장 및 잠금")}
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
  const { settings: localSettings } = useAppLanguage()
  const routeState = location.state as {
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
  const [submissionType, setSubmissionType] = useState<CatalogEntityType | null>(null)
  const [linkRequest, setLinkRequest] = useState<{ type: 'CHARACTER' | 'VOICE_ACTOR' | 'STUDIO'; characterId?: number } | null>(null)
  const [collectionSnapshot, setCollectionSnapshot] = useState<{
    animeId: number
    entry: UserAnimeListEntry | null
  } | null>(null)
  const { item, isLoading, error } = state
  const isSampleDetail = Boolean(sampleAnimeDetail || item?.source === 'Sample')
  const isRefreshingDetail = state.requestKey !== requestKey
  const isAdmin = Boolean(user?.isAdmin || user?.role === 'ADMIN')
  const detailPageClassName = isOverlay ? 'detail-page detail-page-overlay' : 'detail-page'
  const reduceMotion = localSettings.motionMode === 'reduced'
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const handleOverlayClose = () => {
    navigate(-1)
  }

  const handleCollectionEntryChange = useCallback((entry: UserAnimeListEntry | null) => {
    const animeId = entry?.animeId ?? Number(id)
    if (!Number.isInteger(animeId) || animeId <= 0) return

    setCollectionSnapshot({ animeId, entry })
  }, [id])

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
              : tr("상세 정보를 가져오지 못했습니다."),
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
          error: castError instanceof Error ? castError.message : tr("캐릭터/성우 정보를 불러오지 못했어요."),
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
    const loadingTimer = window.setTimeout(() => {
      setRelationState({ items: [], isLoading: true, error: null })
    })

    const loadRelations = async () => {
      try {
        const response = await fetchAnimeRelations(animeId, controller.signal)
        const uniqueRelations = Array.from(
          new Map(
            response.items
              .filter((relation) => relation.anime?.id !== animeId)
              .map((relation) => [relation.targetAnimeId, relation]),
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
          error: relationError instanceof Error ? relationError.message : tr("연관 작품을 불러오지 못했어요."),
        })
      }
    }

    void loadRelations()

    return () => {
      window.clearTimeout(loadingTimer)
      controller.abort()
    }
  }, [isSampleDetail, item?.id])

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
        <ErrorToast message={tr("잘못된 경로로 접근했어요.")} />
        <div className="feedback-card">{tr("요청한 작품 화면을 열 수 없어요.")}</div>
      </section>
    )
  }

  if (isLoading || isRefreshingDetail) {
    return (
      <section className={detailPageClassName}>
        {isOverlay && (
          <button className="detail-overlay-close" type="button" onClick={handleOverlayClose} aria-label={tr("상세 닫기")}>
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
          <button className="detail-overlay-close" type="button" onClick={handleOverlayClose} aria-label={tr("상세 닫기")}>
            ×
          </button>
        )}
        <ConnectionErrorState message={error ?? tr("작품 정보를 찾을 수 없어요.")} />
      </section>
    )
  }

  const heroImage = item.bannerImage || getPrimaryPoster(item)
  const subtitle = getDetailSubtitle(item)
  const collectionEntry = collectionSnapshot?.animeId === item.id
    ? collectionSnapshot.entry
    : getCachedCollectionEntry(item.id)
  const collectionScore = isAuthenticated && collectionEntry?.score
    ? Number(collectionEntry.score)
    : null

  return (
    <section className={detailPageClassName}>
      <ErrorToast message={relationState.error} />
      <ErrorToast message={castState.error} />
      {isOverlay && (
        <button className="detail-overlay-close" type="button" onClick={handleOverlayClose} aria-label={tr("상세 닫기")}>
          ×
        </button>
      )}

      <div className="detail-shell">
        <InteractiveAnimeVisual
          key={item.id}
          item={item}
          heroImage={heroImage}
          reduceMotion={reduceMotion}
          score={collectionScore}
        />

        <div className="detail-content-pane">
          <header className="detail-summary">
            <span className="detail-label">Anime detail</span>
            <h1 className="detail-title">{item.title}</h1>
            <CompactGenreList key={item.id} genres={item.genres} />
            {subtitle && <p className="detail-subtitle">{subtitle}</p>}

            <div className="detail-meta-grid">
              <div>
                <span>{tr("포맷")}</span>
                <strong>{item.format ?? tr("미정")}</strong>
              </div>
              <div>
                <span>{tr("방영")}</span>
                <strong>{getQuarterLabel(item.season, item.seasonYear)}</strong>
              </div>
              <div>
                <span>{tr("에피소드")}</span>
                <strong>
                  {item.episodes ? tr("{{v0}}화 · {{v1}}분", { v0: item.episodes, v1: item.duration ?? '?' }) : tr("정보 없음")}
                </strong>
              </div>
              <div>
                <span>{tr("평점")}</span>
                <strong>{item.communityAverageScore ? `${item.communityAverageScore.toFixed(1)} / 10` : tr("미집계")}</strong>
              </div>
            </div>

            {item.officialSiteUrl && (
              <div className="detail-actions">
                <a className="primary-button" href={item.officialSiteUrl} target="_blank" rel="noreferrer">
                  {tr("공식 홈페이지 보기")}
                </a>
              </div>
            )}
          </header>

          <CollectionEditor
            key={item.id}
            animeId={item.id}
            maxProgress={item.episodes}
            targetAnime={{
              title: item.title,
              coverImageLarge: item.coverImageLarge,
              coverImageExtraLarge: item.coverImageExtraLarge,
            }}
            onEntryChange={handleCollectionEntryChange}
          />

          {isAdmin && (
            <AdminTitleEditor key={`admin-title-${item.id}`} item={item} onTitleUpdated={handleAdminTitleUpdated} />
          )}

          {!isSampleDetail && !relationState.error && (
            <section className="detail-section detail-relations-section">
              <div className="detail-section-heading">
                <div>
                  <span className="detail-label">Related anime</span>
                  <h2>{tr("이 작품과 연관된 애니")}</h2>
                </div>
              </div>

              {relationState.isLoading ? (
                <DetailHorizontalRail label={tr("연관 작품을 불러오는 중")} className="detail-relations-rail" reduceMotion={reduceMotion}>
                  {Array.from({ length: 4 }).map((_, index) => (
                    <article className="detail-relation-card skeleton-card" key={`relation-skeleton-${index}`}>
                      <div className="detail-relation-poster" />
                      <div className="detail-relation-copy">
                        <div className="skeleton-line short" />
                        <div className="skeleton-line long" />
                      </div>
                    </article>
                  ))}
                </DetailHorizontalRail>
              ) : relationState.items.length > 0 ? (
                <DetailHorizontalRail label={tr("이 작품과 연관된 애니")} className="detail-relations-rail" reduceMotion={reduceMotion}>
                  {relationState.items.map((relation) => {
                    const relatedAnime = relation.anime
                    const poster = relatedAnime?.coverImageExtraLarge || relatedAnime?.coverImageLarge

                    return (
                      <Link className="detail-relation-card" to={`/anime/${relatedAnime.id}`} key={relation.targetAnimeId}>
                        {poster ? (
                          <img className="detail-relation-poster" src={poster} alt="" loading="lazy" draggable={false} />
                        ) : (
                          <div className="detail-relation-poster detail-relation-poster-placeholder" aria-hidden="true">
                            {relation.targetAnimeId}
                          </div>
                        )}
                        <div className="detail-relation-copy">
                          <span>{relationTypeLabels[relation.relationType] ?? relation.relationType}</span>
                          <strong>{relatedAnime.title}</strong>
                          <small>{tr("상세 보기")}</small>
                        </div>
                      </Link>
                    )
                  })}
                </DetailHorizontalRail>
              ) : (
                <div className="feedback-card detail-empty-state"><p>{tr('아직 등록된 연관 작품이 없어요.')}</p></div>
              )}
            </section>
          )}

          {!isSampleDetail && (
            <section className="detail-section detail-cast-section">
              <div className="detail-section-heading">
                <div>
                  <span className="detail-label">Studio</span>
                  <h2>{tr('스튜디오')}</h2>
                </div>
                <DetailActionMenu
                  label={tr('스튜디오 작업 메뉴 열기')}
                  items={[
                    { label: tr('기존 스튜디오 검색 후 연결'), onSelect: () => setLinkRequest({ type: 'STUDIO' }) },
                    { label: tr('새 스튜디오 요청'), onSelect: () => setSubmissionType('STUDIO') },
                  ]}
                />
              </div>

              {(item.studios?.length ?? 0) > 0 ? (
                <DetailHorizontalRail label={tr('스튜디오')} className="detail-studio-rail" reduceMotion={reduceMotion}>
                  {item.studios?.map((studio) => (
                    <article className="detail-studio-card" key={studio.id}>
                      <span>{studio.isMain ? tr('주 제작사') : tr('스튜디오')}</span>
                      <strong>{studio.name}</strong>
                      {studio.officialSiteUrl && (
                        <a href={studio.officialSiteUrl} target="_blank" rel="noreferrer">{tr('공식 홈페이지')}</a>
                      )}
                    </article>
                  ))}
                </DetailHorizontalRail>
              ) : (
                <div className="feedback-card detail-empty-state"><p>{tr('아직 등록된 스튜디오가 없어요.')}</p></div>
              )}
            </section>
          )}

          {!isSampleDetail && !castState.error && (
            <section className="detail-section detail-cast-section">
              <div className="detail-section-heading">
                <div>
                  <span className="detail-label">Main cast</span>
                  <h2>{tr("주요 캐릭터와 성우")}</h2>
                </div>
                <DetailActionMenu
                  label={tr('주요 캐릭터 작업 메뉴 열기')}
                  items={[
                    { label: tr('기존 캐릭터 검색 후 연결'), onSelect: () => setLinkRequest({ type: 'CHARACTER' }) },
                    { label: tr('새 캐릭터 요청'), onSelect: () => setSubmissionType('CHARACTER') },
                    { label: tr('새 성우 요청'), onSelect: () => setSubmissionType('VOICE_ACTOR') },
                  ]}
                />
              </div>

              {castState.isLoading ? (
                <DetailHorizontalRail label={tr("캐릭터와 성우를 불러오는 중")} className="detail-cast-rail" reduceMotion={reduceMotion}>
                  {Array.from({ length: 4 }).map((_, index) => (
                    <article className="detail-cast-card skeleton-card" key={`cast-skeleton-${index}`}>
                      <div className="skeleton-line short" />
                      <div className="skeleton-line long" />
                    </article>
                  ))}
                </DetailHorizontalRail>
              ) : castState.items.length > 0 ? (
                <DetailHorizontalRail label={tr("주요 캐릭터와 성우")} className="detail-cast-rail" reduceMotion={reduceMotion}>
                  {castState.items.map((character) => {
                    const voiceActor = character.voiceActors[0]
                    const characterName = getCastDisplayName(character.name)

                    return (
                      <article className="detail-cast-card" key={character.id}>
                        <div className="detail-character-card-menu">
                          <DetailActionMenu
                            compact
                            label={tr("{{v0}} 성우 연결 메뉴 열기", { v0: characterName })}
                            items={[
                              {
                                label: tr('기존 성우 검색 후 연결'),
                                onSelect: () => setLinkRequest({ type: 'VOICE_ACTOR', characterId: character.id }),
                              },
                            ]}
                          />
                        </div>
                        <div className="detail-cast-person">
                          {character.image.large || character.image.medium
                            ? <img src={character.image.large || character.image.medium || ''} alt={characterName} loading="lazy" draggable={false} />
                            : <span className="detail-cast-image-placeholder" aria-hidden="true">?</span>}
                          <div>
                            <span>Character</span>
                            <strong>{characterName}</strong>
                            {character.name.native && <small>{character.name.native}</small>}
                          </div>
                        </div>

                        {voiceActor && (
                          <Link className="detail-cast-person detail-cast-person-link" to={`/voice-actors/${voiceActor.id}`}>
                            {voiceActor.image.large || voiceActor.image.medium
                              ? <img src={voiceActor.image.large || voiceActor.image.medium || ''} alt={getCastDisplayName(voiceActor.name)} loading="lazy" draggable={false} />
                              : <span className="detail-cast-image-placeholder" aria-hidden="true">?</span>}
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
                </DetailHorizontalRail>
              ) : (
                <div className="feedback-card detail-empty-state"><p>{tr('아직 등록된 캐릭터와 성우가 없어요.')}</p></div>
              )}
            </section>
          )}
        </div>
      </div>
      <CatalogSubmissionDialog open={submissionType !== null} onClose={() => setSubmissionType(null)} entityType={submissionType ?? 'ANIME'} initialName="" />
      <CatalogLinkDialog open={linkRequest !== null} onClose={() => setLinkRequest(null)} animeId={item.id} entityType={linkRequest?.type ?? 'CHARACTER'} characterId={linkRequest?.characterId} />
    </section>
  )
}
