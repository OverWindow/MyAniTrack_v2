import type { UserBadge } from '../types/badges'

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

export function BadgeSection({
  badges,
  isLoading = false,
  error = null,
  newlyEarned = [],
  emptyMessage,
  showProgress = false,
}: BadgeSectionProps) {
  const newlyEarnedCodes = new Set(newlyEarned.map((badge) => badge.code))

  return (
    <section className="profile-badge-section">
      {newlyEarned.length > 0 && (
        <div className="badge-newly-earned" role="status">
          새 배지 {newlyEarned.length.toLocaleString()}개를 획득했어요.
        </div>
      )}

      {isLoading ? (
        <div className="badge-grid">
          {Array.from({ length: 3 }).map((_, index) => (
            <article className="badge-card skeleton-card" key={`badge-skeleton-${index}`}>
              <div className="skeleton-line short" />
              <div className="skeleton-line long" />
            </article>
          ))}
        </div>
      ) : error ? (
        <div className="badge-empty-state">{error}</div>
      ) : badges.length === 0 ? (
        <div className="badge-empty-state">{emptyMessage}</div>
      ) : (
        <div className="badge-grid">
          {badges.map((badge) => {
            const earnedDate = formatEarnedAt(badge.earnedAt)
            const progressPercent = badge.progress?.percent ?? (badge.earned ? 100 : 0)

            return (
              <article
                className={badge.earned ? 'badge-card is-earned' : 'badge-card'}
                key={badge.code}
                tabIndex={0}
                aria-label={`${badge.name}: ${badge.description}`}
              >
                {badge.imageUrl ? (
                  <img className="badge-icon badge-icon-image" src={badge.imageUrl} alt="" loading="lazy" />
                ) : (
                  <span className="badge-icon" aria-hidden="true">{getBadgeInitial(badge.name)}</span>
                )}
                {newlyEarnedCodes.has(badge.code) && <span className="badge-new-chip">New</span>}

                <div className="badge-tooltip" role="tooltip">
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
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
