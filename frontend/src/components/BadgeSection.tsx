import { useEffect, useId, useRef, useState } from 'react'
import { X } from 'lucide-react'
import type { UserBadge } from '../types/badges'
import { ErrorToast } from './ErrorToast'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'

type BadgeSectionProps = {
  badges: UserBadge[]
  isLoading?: boolean
  error?: string | null
  newlyEarned?: UserBadge[]
  emptyMessage: string
  showProgress?: boolean
}

function getBadgeInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || 'B'
}

function formatEarnedAt(value?: string | null) {
  if (!value) {
    return null
  }

  const parsedDate = new Date(value.replace(' ', 'T'))

  if (Number.isNaN(parsedDate.getTime())) {
    return value
  }

  return parsedDate.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function BadgeDetails({ badge, showProgress }: { badge: UserBadge; showProgress: boolean }) {
  const earnedDate = formatEarnedAt(badge.earnedAt)
  const progressPercent = badge.progress?.percent ?? (badge.earned ? 100 : 0)

  return (
    <>
      <div className="badge-title-copy">
        <strong>{badge.name}</strong>
        <span>{badge.rarity}</span>
      </div>

      <p>{badge.description || '획득 조건을 달성하면 배지가 표시돼요.'}</p>

      {showProgress && badge.progress && (
        <div className="badge-progress" aria-label={`${badge.progress.percent}% 달성`}>
          <span style={{ width: `${progressPercent}%` }} />
        </div>
      )}

      <div className="badge-card-meta">
        <span>{badge.earned ? '획득 완료' : '진행 중'}</span>
        {earnedDate && <span>{earnedDate}</span>}
      </div>
    </>
  )
}

export function BadgeSection({
  badges,
  isLoading = false,
  error = null,
  newlyEarned = [],
  emptyMessage,
  showProgress = false,
}: BadgeSectionProps) {
  const newlyEarnedCodes = new Set(newlyEarned.map((badge) => badge.code))
  const [selectedBadge, setSelectedBadge] = useState<UserBadge | null>(null)
  const dialogTitleId = useId()
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const activeTriggerRef = useRef<HTMLButtonElement | null>(null)

  useBodyScrollLock(Boolean(selectedBadge))

  useEffect(() => {
    if (!selectedBadge) {
      return
    }

    const mediaQuery = window.matchMedia('(max-width: 880px)')

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedBadge(null)
      }
    }
    const handleMediaChange = (event: MediaQueryListEvent) => {
      if (!event.matches) {
        setSelectedBadge(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    mediaQuery.addEventListener('change', handleMediaChange)
    window.requestAnimationFrame(() => closeButtonRef.current?.focus())

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      mediaQuery.removeEventListener('change', handleMediaChange)
      activeTriggerRef.current?.focus()
    }
  }, [selectedBadge])

  const openBadgeDetails = (badge: UserBadge, trigger: HTMLButtonElement) => {
    if (!window.matchMedia('(max-width: 880px)').matches) {
      return
    }

    activeTriggerRef.current = trigger
    setSelectedBadge(badge)
  }

  return (
    <section className="profile-badge-section">
      {newlyEarned.length > 0 && (
        <div className="badge-newly-earned" role="status">
          새 배지 {newlyEarned.length.toLocaleString()}개를 획득했어요.
        </div>
      )}

      {isLoading ? (
        <div className="badge-loading-state" role="status" aria-label="배지를 불러오는 중">
          <span className="badge-loading-spinner" aria-hidden="true" />
          <strong>배지를 불러오는 중이에요.</strong>
        </div>
      ) : error ? (
        <>
          <ErrorToast message={error} />
          <div className="badge-empty-state">지금은 배지를 표시할 수 없어요.</div>
        </>
      ) : badges.length === 0 ? (
        <div className="badge-empty-state">{emptyMessage}</div>
      ) : (
        <div className="badge-grid">
          {badges.map((badge) => {
            return (
              <div className="badge-card-shell" key={badge.code}>
                <button
                  className={badge.earned ? 'badge-card is-earned' : 'badge-card'}
                  type="button"
                  aria-label={`${badge.name}: ${badge.description}`}
                  aria-haspopup="dialog"
                  aria-expanded={selectedBadge?.code === badge.code}
                  onClick={(event) => openBadgeDetails(badge, event.currentTarget)}
                >
                  {badge.imageUrl ? (
                    <img className="badge-icon badge-icon-image" src={badge.imageUrl} alt="" loading="lazy" />
                  ) : (
                    <span className="badge-icon" aria-hidden="true">{getBadgeInitial(badge.name)}</span>
                  )}
                  {newlyEarnedCodes.has(badge.code) && <span className="badge-new-chip">New</span>}
                </button>
                <div className="badge-tooltip" role="tooltip">
                  <BadgeDetails badge={badge} showProgress={showProgress} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {selectedBadge && (
        <div
          className="badge-detail-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedBadge(null)
            }
          }}
        >
          <section
            className="badge-detail-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
          >
            <div className="badge-detail-dialog-heading">
              <div className="badge-detail-dialog-icon" aria-hidden="true">
                {selectedBadge.imageUrl ? (
                  <img src={selectedBadge.imageUrl} alt="" />
                ) : (
                  <span>{getBadgeInitial(selectedBadge.name)}</span>
                )}
              </div>
              <strong id={dialogTitleId}>배지 상세</strong>
              <button
                ref={closeButtonRef}
                className="badge-detail-close"
                type="button"
                aria-label="배지 상세 닫기"
                onClick={() => setSelectedBadge(null)}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <div className="badge-detail-content">
              <BadgeDetails badge={selectedBadge} showProgress={showProgress} />
            </div>
          </section>
        </div>
      )}
    </section>
  )
}
