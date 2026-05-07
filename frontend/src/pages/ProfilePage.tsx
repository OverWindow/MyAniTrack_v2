import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getProfileImageSrc, handleProfileImageError } from '../lib/avatar'
import '../styles/pages/ProfilePage.css'

const mockBadges = [
  '첫 완주 배지',
  '리뷰 작성 배지',
  '친구 추천 배지',
  '장르 탐험가 배지',
]

const quickLinks = [
  {
    title: '내 컬렉션',
    description: '기록한 작품과 점수를 바로 확인해보세요.',
    to: '/collection',
    style: 'primary',
  },
  {
    title: '친구 목록',
    description: '연결된 친구와 요청 상태를 한 번에 관리할 수 있어요.',
    to: '/friends',
    style: 'secondary',
  },
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

  return (
    <section className="profile-page">
      <div className="profile-hero-card">
        <div className="profile-hero-main">
          <img
            className="profile-hero-avatar profile-hero-avatar-image"
            src={getProfileImageSrc(user.profileImageUrl)}
            alt={displayName}
            onError={handleProfileImageError}
          />

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

      <section className="profile-quick-section">
        <div className="profile-section-heading">
          <div>
            <span className="detail-label">Quick access</span>
            <h2>내 리스트 바로가기</h2>
          </div>
        </div>

        <div className="profile-quick-grid">
          {quickLinks.map((item) => (
            <Link
              key={item.to}
              className={item.style === 'primary' ? 'profile-quick-card is-primary' : 'profile-quick-card'}
              to={item.to}
            >
              <strong>{item.title}</strong>
              <p>{item.description}</p>
            </Link>
          ))}
        </div>
      </section>

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
