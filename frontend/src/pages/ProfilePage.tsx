import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import '../styles/pages/ProfilePage.css'

const mockBadges = [
  '첫 완주 배지',
  '리뷰 작성 배지',
  '친구 추천 배지',
  '장르 탐험가 배지',
]

export function ProfilePage() {
  const { isAuthenticated, user } = useAuth()
  const navigate = useNavigate()

  if (!isAuthenticated || !user) {
    return (
      <section className="profile-page">
        <div className="feedback-card">
          프로필은 로그인한 사용자만 볼 수 있어요. <Link to="/login">로그인</Link> 후
          다시 확인해주세요.
        </div>
      </section>
    )
  }

  const displayName = user.username?.trim() || user.email?.split('@')[0] || 'MyAniTrack User'
  const initials = displayName.slice(0, 2).toUpperCase()

  return (
    <section className="profile-page">
      <div className="profile-hero-card">
        <div className="profile-hero-main">
          {user.profileImageUrl ? (
            <img
              className="profile-hero-avatar profile-hero-avatar-image"
              src={user.profileImageUrl}
              alt={displayName}
            />
          ) : (
            <div className="profile-hero-avatar" aria-hidden="true">
              <span>{initials}</span>
            </div>
          )}

          <div className="profile-hero-copy">
            <span className="section-kicker">My profile</span>
            <h1 className="profile-hero-title">{displayName}</h1>
            <p className="profile-hero-bio">
              {user.bio || '좋아하는 장르와 감상 스타일을 천천히 채워가는 중이에요.'}
            </p>
          </div>
        </div>

        <div className="profile-hero-actions">
          <button
            className="secondary-button profile-edit-button"
            type="button"
            onClick={() => navigate('/profile/edit')}
          >
            프로필 수정
          </button>
          <button
            className="primary-button profile-analysis-button"
            type="button"
            onClick={() => navigate('/analysis')}
          >
            분석 보기
          </button>
        </div>
      </div>

      <section className="profile-badge-section">
        <div className="profile-section-heading">
          <div>
            <span className="detail-label">Badges</span>
            <h2>수집할 뱃지</h2>
          </div>
          <span className="profile-coming-soon">Coming soon</span>
        </div>

        <div className="badge-grid">
          {mockBadges.map((badge) => (
            <article className="badge-card" key={badge}>
              <span className="badge-dot" aria-hidden="true" />
              <strong>{badge}</strong>
              <p>활동에 따라 해금될 예정인 자리예요.</p>
            </article>
          ))}
        </div>
      </section>
    </section>
  )
}
