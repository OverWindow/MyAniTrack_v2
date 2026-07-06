import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BadgeSection } from '../components/BadgeSection'
import { ConnectionErrorState } from '../components/ConnectionErrorState'
import { useAuth } from '../contexts/AuthContext'
import { getProfileImageSrc, handleProfileImageError } from '../lib/avatar'
import { fetchMyBadges } from '../lib/badges'
import { SERVER_CONNECTION_ERROR_MESSAGE, getFriendlyErrorMessage } from '../lib/errors'
import type { UserBadge } from '../types/badges'
import '../styles/pages/ProfilePage.css'

type ProfileBadgesState = {
  items: UserBadge[]
  newlyEarned: UserBadge[]
  earnedCount: number
  totalCount: number
  isLoading: boolean
  error: string | null
}

export function ProfilePage() {
  const { isAuthenticated, user } = useAuth()
  const navigate = useNavigate()
  const [badgesState, setBadgesState] = useState<ProfileBadgesState>({
    items: [],
    newlyEarned: [],
    earnedCount: 0,
    totalCount: 0,
    isLoading: true,
    error: null,
  })

  useEffect(() => {
    if (!isAuthenticated) {
      return
    }

    const controller = new AbortController()

    const loadBadges = async () => {
      try {
        const badges = await fetchMyBadges(controller.signal)
        setBadgesState({
          items: badges.items,
          newlyEarned: badges.newlyEarned,
          earnedCount: badges.earnedCount,
          totalCount: badges.totalCount,
          isLoading: false,
          error: null,
        })
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }

        setBadgesState({
          items: [],
          newlyEarned: [],
          earnedCount: 0,
          totalCount: 0,
          isLoading: false,
          error: getFriendlyErrorMessage(error, '내 배지를 불러오지 못했어요.'),
        })
      }
    }

    void loadBadges()

    return () => controller.abort()
  }, [isAuthenticated])

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

      {badgesState.error === SERVER_CONNECTION_ERROR_MESSAGE ? (
        <ConnectionErrorState message={badgesState.error} />
      ) : (
        <BadgeSection
          badges={badgesState.items.filter((badge) => badge.earned)}
          isLoading={badgesState.isLoading}
          error={badgesState.error}
          newlyEarned={badgesState.newlyEarned}
          emptyMessage="아직 획득한 배지가 없어요."
          showProgress
        />
      )}
    </section>
  )
}
