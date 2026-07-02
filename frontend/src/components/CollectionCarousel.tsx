import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import type { Location } from 'react-router-dom'
import type { UserAnimeListItem } from '../types/collection'

type CollectionCarouselState = {
  items: UserAnimeListItem[]
  isLoading: boolean
  error: string | null
}

type CollectionCarouselProps = {
  state: CollectionCarouselState
  title?: string
  ariaLabel?: string
  location?: Location
  portalRootId?: string
}

function getDisplayTitle(item: UserAnimeListItem) {
  return item.anime.titles?.korean || item.anime.titles?.english || item.anime.title
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

function getStarFillPercent(score: number, starIndex: number) {
  const scoreInStars = score / 2
  const fill = Math.max(0, Math.min(1, scoreInStars - starIndex))

  return `${fill * 100}%`
}

function getCarouselTransform(index: number, total: number) {
  const center = (total - 1) / 2
  const offset = index - center
  const distance = Math.abs(offset)
  const translateZ = Math.max(-180, -distance * 52)
  const translateY = distance * 24
  const scale = Math.max(0.82, 1.08 - distance * 0.05)

  return `translateY(${translateY}px) translateZ(${translateZ}px) scale(${scale})`
}

function getCardCenter(card: HTMLElement) {
  return card.offsetLeft + card.offsetWidth / 2
}

function getCarouselCenter(carousel: HTMLElement) {
  return carousel.scrollLeft + carousel.clientWidth / 2
}

function getCenteredScrollLeft(carousel: HTMLElement, card: HTMLElement) {
  return getCardCenter(card) - carousel.clientWidth / 2
}

function CollectionCarouselContent({
  state,
  title = '최애 애니',
  ariaLabel = '최애 애니',
  location,
}: Omit<CollectionCarouselProps, 'portalRootId'>) {
  const carouselRef = useRef<HTMLDivElement | null>(null)
  const scrollLeftRef = useRef(0)
  const animationFrameRef = useRef<number | null>(null)
  const dragStateRef = useRef({
    isDragging: false,
    hasMoved: false,
    hasCapture: false,
    pointerId: -1,
    startX: 0,
    scrollLeft: 0,
  })
  const suppressClickRef = useRef(false)

  const updateCards = useCallback((scrollDirection = 0) => {
    const carousel = carouselRef.current

    if (!carousel) {
      return
    }

    const carouselCenter = getCarouselCenter(carousel)
    const cards = carousel.querySelectorAll<HTMLElement>('.perfect-score-card')

    cards.forEach((card) => {
      const offset = (getCardCenter(card) - carouselCenter) / Math.max(card.offsetWidth, 1)
      const distance = Math.min(Math.abs(offset), 3.4)
      const focus = Math.max(0, 1 - distance / 2.2)
      const directionWeight = scrollDirection === 0 ? 0 : Math.max(0, Math.min(1, scrollDirection * offset))
      const sideBoost = directionWeight * Math.max(0, 1 - Math.abs(offset - scrollDirection * 0.86) / 1.35)
      const scale = 0.86 + focus * 0.18 + sideBoost * 0.16
      const translateY = distance * 19 - focus * 12 - sideBoost * 18
      const translateZ = focus * 72 - distance * 28 + sideBoost * 96

      card.style.setProperty('--carousel-scale', scale.toFixed(3))
      card.style.setProperty('--carousel-y', `${translateY.toFixed(2)}px`)
      card.style.setProperty('--carousel-z', `${translateZ.toFixed(2)}px`)
      card.style.setProperty('--carousel-focus', focus.toFixed(3))
      card.style.setProperty('--carousel-side-boost', sideBoost.toFixed(3))
      card.style.zIndex = String(Math.round(1000 + focus * 180 + sideBoost * 220 - distance * 8))
    })
  }, [])

  const centerInitialCard = useCallback(() => {
    const carousel = carouselRef.current
    const cards = carousel ? Array.from(carousel.querySelectorAll<HTMLElement>('.perfect-score-card')) : []
    const centerCardElement = cards[Math.floor(cards.length / 2)]

    if (!carousel || !centerCardElement) {
      return
    }

    carousel.scrollTo({
      left: getCenteredScrollLeft(carousel, centerCardElement),
      behavior: 'instant',
    })

    window.requestAnimationFrame(() => {
      scrollLeftRef.current = carousel.scrollLeft
      updateCards(0)
    })
  }, [updateCards])

  const handleScroll = useCallback(() => {
    const carousel = carouselRef.current

    if (!carousel) {
      return
    }

    const nextScrollLeft = carousel.scrollLeft
    const scrollDirection = Math.sign(nextScrollLeft - scrollLeftRef.current)
    scrollLeftRef.current = nextScrollLeft

    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current)
    }

    animationFrameRef.current = window.requestAnimationFrame(() => {
      updateCards(scrollDirection)
    })
  }, [updateCards])

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const carousel = carouselRef.current

    if (!carousel || event.button !== 0) {
      return
    }

    suppressClickRef.current = false
    dragStateRef.current = {
      isDragging: true,
      hasMoved: false,
      hasCapture: false,
      pointerId: event.pointerId,
      startX: event.clientX,
      scrollLeft: carousel.scrollLeft,
    }
  }, [])

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const carousel = carouselRef.current
    const dragState = dragStateRef.current

    if (!carousel || !dragState.isDragging || dragState.pointerId !== event.pointerId) {
      return
    }

    const deltaX = event.clientX - dragState.startX

    if (Math.abs(deltaX) > 4) {
      dragState.hasMoved = true
      suppressClickRef.current = true
      event.preventDefault()

      if (!dragState.hasCapture) {
        carousel.setPointerCapture(event.pointerId)
        carousel.classList.add('is-dragging')
        dragState.hasCapture = true
      }
    }

    carousel.scrollLeft = dragState.scrollLeft - deltaX
  }, [])

  const finishDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const carousel = carouselRef.current
    const dragState = dragStateRef.current

    if (!carousel || !dragState.isDragging || dragState.pointerId !== event.pointerId) {
      return
    }

    dragStateRef.current = {
      isDragging: false,
      hasMoved: false,
      hasCapture: false,
      pointerId: -1,
      startX: 0,
      scrollLeft: carousel.scrollLeft,
    }
    carousel.classList.remove('is-dragging')

    if (dragState.hasCapture && carousel.hasPointerCapture(event.pointerId)) {
      carousel.releasePointerCapture(event.pointerId)
    }

    if (dragState.hasMoved) {
      updateCards(0)
    }
  }, [updateCards])

  const handleClickCapture = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (!suppressClickRef.current) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    suppressClickRef.current = false
  }, [])

  useLayoutEffect(() => {
    if (state.isLoading || state.items.length === 0) {
      return
    }

    const carousel = carouselRef.current

    if (!carousel) {
      return
    }

    centerInitialCard()

    const resizeObserver = new ResizeObserver(() => updateCards(0))
    resizeObserver.observe(carousel)

    return () => {
      resizeObserver.disconnect()

      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
  }, [centerInitialCard, state.isLoading, state.items.length, updateCards])

  if (!state.isLoading && state.items.length === 0 && !state.error) {
    return null
  }

  return (
    <section className="perfect-score-showcase" aria-label={ariaLabel}>
      <div className="perfect-score-heading">
        <div>
          <h2>{title}</h2>
        </div>
        {state.items.length > 0 && (
          <span>{state.items.length.toLocaleString()}편</span>
        )}
      </div>

      {state.isLoading && (
        <div className="perfect-score-carousel is-loading">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              className="perfect-score-card perfect-score-skeleton"
              key={`perfect-score-skeleton-${index}`}
              style={{
                transform: getCarouselTransform(index, 5),
                zIndex: Math.round(50 - Math.abs(index - 2)),
              }}
            />
          ))}
        </div>
      )}

      {!state.isLoading && state.error && (
        <div className="perfect-score-empty">{state.error}</div>
      )}

      {!state.isLoading && !state.error && state.items.length > 0 && (
        <div
          className="perfect-score-carousel"
          ref={carouselRef}
          onScroll={handleScroll}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          onPointerLeave={finishDrag}
          onClickCapture={handleClickCapture}
        >
          {state.items.slice(0, 12).map((item, displayIndex, displayItems) => {
            const itemTitle = getDisplayTitle(item)

            return (
              <Link
                className="perfect-score-card"
                key={item.id}
                to={`/anime/${item.anime.id}`}
                state={location ? { fromPage: 'collection', backgroundLocation: location } : undefined}
                aria-label={`${itemTitle} 상세 페이지로 이동`}
                title={itemTitle}
                style={{
                  zIndex: Math.round(displayItems.length * 10 - Math.abs(displayIndex - (displayItems.length - 1) / 2)),
                }}
              >
                <img
                  className="perfect-score-cover"
                  src={item.anime.coverImageExtraLarge || item.anime.coverImageLarge}
                  alt={itemTitle}
                />
                <div className="perfect-score-card-copy">
                  <strong>{itemTitle}</strong>
                  <span className="perfect-score-stars" aria-label={`평점 ${formatScore(item.score)}점`}>
                    {Array.from({ length: 5 }).map((_, starIndex) => (
                      <span className="perfect-score-star" key={`${item.id}-perfect-star-${starIndex}`}>
                        <span className="perfect-score-star-base" aria-hidden="true">★</span>
                        <span
                          className="perfect-score-star-fill"
                          aria-hidden="true"
                          style={{ width: getStarFillPercent(Number(item.score ?? 10), starIndex) }}
                        >
                          ★
                        </span>
                      </span>
                    ))}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}

export function CollectionCarousel({ portalRootId, ...props }: CollectionCarouselProps) {
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setPortalRoot(portalRootId ? document.getElementById(portalRootId) : null)
  }, [portalRootId])

  if (!portalRootId) {
    return <CollectionCarouselContent {...props} />
  }

  return portalRoot ? createPortal(<CollectionCarouselContent {...props} />, portalRoot) : null
}
