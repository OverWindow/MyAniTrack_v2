import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BadgeSection } from '../components/BadgeSection'
import { ConnectionErrorState } from '../components/ConnectionErrorState'
import { ErrorToast } from '../components/ErrorToast'
import { getProfileImageSrc, handleProfileImageError } from '../lib/avatar'
import { fetchPublicUserBadges } from '../lib/badges'
import { SERVER_CONNECTION_ERROR_MESSAGE, getFriendlyErrorMessage } from '../lib/errors'
import { fetchPublicUserProfile } from '../lib/users'
import type { UserBadge } from '../types/badges'
import type { PublicUserProfile } from '../types/users'
import '../styles/pages/ProfilePage.css'
import '../styles/pages/UserProfilePage.css'

type UserProfileState = {
  user: PublicUserProfile | null
  badges: UserBadge[]
  earnedCount: number
  totalCount: number
  isLoading: boolean
  error: string | null
  badgesError: string | null
}

export function UserProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const [state, setState] = useState<UserProfileState>({
    user: null,
    badges: [],
    earnedCount: 0,
    totalCount: 0,
    isLoading: true,
    error: null,
    badgesError: null,
  })

  useEffect(() => {
    if (!userId) {
      return
    }

    const controller = new AbortController()

    const loadProfile = async () => {
      try {
        const user = await fetchPublicUserProfile(userId, controller.signal)
        const badgesResult = await fetchPublicUserBadges(userId, controller.signal)
          .then((badges) => ({ badges, error: null }))
          .catch((badgesError: unknown) => ({
            badges: { items: [], earnedCount: 0, totalCount: 0 },
            error: getFriendlyErrorMessage(badgesError, '사용자 배지를 불러오지 못했어요.'),
          }))

        setState({
          user,
          badges: badgesResult.badges.items,
          earnedCount: badgesResult.badges.earnedCount,
          totalCount: badgesResult.badges.totalCount,
          isLoading: false,
          error: null,
          badgesError: badgesResult.error,
        })
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') {
          return
        }

        setState({
          user: null,
          badges: [],
          earnedCount: 0,
          totalCount: 0,
          isLoading: false,
          error: getFriendlyErrorMessage(loadError, '사용자 프로필을 불러오지 못했어요.'),
          badgesError: null,
        })
      }
    }

    void loadProfile()

    return () => controller.abort()
  }, [userId])

  if (!userId) {
    return (
      <section className="user-profile-page">
        <ErrorToast message="잘못된 사용자 경로예요." />
        <div className="feedback-card">요청한 프로필을 열 수 없어요.</div>
      </section>
    )
  }

  if (state.isLoading) {
    return (
      <section className="user-profile-page">
        <div className="profile-loading-card">
          <span className="profile-loading-spinner" aria-hidden="true" />
          <strong>프로필과 배지를 불러오는 중이에요.</strong>
        </div>
      </section>
    )
  }

  if (state.error || !state.user) {
    return (
      <section className="user-profile-page">
        <ConnectionErrorState message={state.error ?? '사용자 정보를 찾을 수 없어요.'} />
      </section>
    )
  }

  const user = state.user

  return (
    <section className="user-profile-page">
      <Link className="detail-back-link" to="/friends">
        친구 목록으로 돌아가기
      </Link>

      <div className="profile-hero-card user-profile-hero-card">
        <div className="profile-hero-main">
          <img
            className="profile-hero-avatar profile-hero-avatar-image"
            src={getProfileImageSrc(user.profileImageUrl)}
            alt={user.username}
            onError={handleProfileImageError}
          />

          <div className="profile-hero-copy">
            <h1 className="profile-hero-title">{user.username}</h1>
            <p className="profile-hero-bio">{user.bio || '아직 소개가 등록되지 않았어요.'}</p>
            <div className="user-profile-meta-row">
              <span className="info-chip">애니 {user.animeListCount.toLocaleString()}편</span>
            </div>
          </div>
        </div>

        <div className="profile-hero-actions user-profile-actions">
          <Link className="secondary-button profile-edit-button" to={`/users/${user.id}/anime-list`}>
            컬렉션 보기
          </Link>
          <Link className="primary-button profile-analysis-button" to={`/users/${user.id}/anime-stats`}>
            분석 보기
          </Link>
        </div>
      </div>

      {state.badgesError === SERVER_CONNECTION_ERROR_MESSAGE ? (
        <ConnectionErrorState message={state.badgesError} />
      ) : (
        <BadgeSection
          badges={state.badges}
          error={state.badgesError}
          emptyMessage="아직 획득한 공개 배지가 없어요."
        />
      )}
    </section>
  )
}
