import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import '../styles/pages/ProfilePage.css'

const mockHighlights = [
  { label: '올해 본 작품', value: '42편', detail: '최근 3개월 집중 시청' },
  { label: '누적 시청 시간', value: '368시간', detail: 'TV 시리즈 비중이 높음' },
  { label: '평균 별점', value: '4.1 / 5', detail: '완주 작품 기준' },
]

const mockTasteBreakdown = [
  { label: '미스터리', value: '34%', width: '34%' },
  { label: '드라마', value: '26%', width: '26%' },
  { label: '판타지', value: '18%', width: '18%' },
  { label: 'SF', value: '12%', width: '12%' },
]

const mockYearlyPreference = [
  { label: '2010s', detail: '가장 많이 본 시기', value: '47%' },
  { label: '2020s', detail: '최신작 선호도 상승', value: '39%' },
  { label: '2000s', detail: '정주행 컬렉션 중심', value: '14%' },
]

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

  const initials = user.username.slice(0, 2).toUpperCase()

  return (
    <section className="profile-page">
      <div className="profile-hero-card">
        <div className="profile-hero-main">
          {user.profileImageUrl ? (
            <img
              className="profile-hero-avatar profile-hero-avatar-image"
              src={user.profileImageUrl}
              alt={user.username}
            />
          ) : (
            <div className="profile-hero-avatar" aria-hidden="true">
              <span>{initials}</span>
            </div>
          )}

          <div className="profile-hero-copy">
            <span className="section-kicker">My profile</span>
            <h1 className="profile-hero-title">{user.username}</h1>
            <p className="profile-hero-bio">
              {user.bio || '좋아하는 장르와 감상 스타일을 천천히 채워가는 중이에요.'}
            </p>
          </div>
        </div>

        <button
          className="secondary-button profile-edit-button"
          type="button"
          onClick={() => navigate('/profile/edit')}
        >
          프로필 수정
        </button>
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

      <section className="profile-analysis-section">
        <div className="profile-section-heading">
          <div>
            <span className="detail-label">Taste analysis</span>
            <h2>애니 분석 리포트</h2>
          </div>
          <span className="profile-mock-badge">Mock data</span>
        </div>

        <div className="profile-analysis-grid">
          <section className="profile-analysis-card profile-analysis-highlights">
            {mockHighlights.map((item) => (
              <article className="analysis-highlight-item" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <p>{item.detail}</p>
              </article>
            ))}
          </section>

          <section className="profile-analysis-card">
            <span className="detail-label">Favorite genres</span>
            <h3>선호 장르 분포</h3>
            <div className="analysis-bar-list">
              {mockTasteBreakdown.map((item) => (
                <div className="analysis-bar-item" key={item.label}>
                  <div className="analysis-bar-header">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                  <div className="analysis-bar-track">
                    <div className="analysis-bar-fill" style={{ width: item.width }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="profile-analysis-card">
            <span className="detail-label">Preferred era</span>
            <h3>선호 방영 시기</h3>
            <div className="analysis-era-list">
              {mockYearlyPreference.map((item) => (
                <article className="analysis-era-item" key={item.label}>
                  <div>
                    <strong>{item.label}</strong>
                    <p>{item.detail}</p>
                  </div>
                  <span>{item.value}</span>
                </article>
              ))}
            </div>
          </section>

          <section className="profile-analysis-card">
            <span className="detail-label">Insight note</span>
            <h3>한 줄 취향 요약</h3>
            <p className="profile-analysis-note">
              차분한 감정선과 서사가 긴 작품을 특히 선호하고, 미스터리나 성장형
              드라마에서 높은 평점을 주는 경향이 보여요. 최근에는 최신작보다 완결된
              작품을 몰아보는 패턴이 강합니다.
            </p>
          </section>
        </div>
      </section>
    </section>
  )
}
