import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getProfileImageSrc, handleProfileImageError } from '../lib/avatar'
import { fetchPublicUserProfile } from '../lib/users'
import type { PublicUserProfile } from '../types/users'
import '../styles/pages/UserProfilePage.css'

type UserProfileState = {
  user: PublicUserProfile | null
  isLoading: boolean
  error: string | null
}

export function UserProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const [state, setState] = useState<UserProfileState>({
    user: null,
    isLoading: true,
    error: null,
  })

  useEffect(() => {
    if (!userId) {
      return
    }

    const controller = new AbortController()

    const loadProfile = async () => {
      try {
        const user = await fetchPublicUserProfile(userId, controller.signal)
        setState({ user, isLoading: false, error: null })
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') {
          return
        }

        setState({
          user: null,
          isLoading: false,
          error: loadError instanceof Error ? loadError.message : '사용자 프로필을 불러오지 못했어요.',
        })
      }
    }

    void loadProfile()

    return () => controller.abort()
  }, [userId])

  if (!userId) {
    return (
      <section className="user-profile-page">
        <div className="feedback-card is-error">잘못된 사용자 경로예요.</div>
      </section>
    )
  }

  if (state.isLoading) {
    return (
      <section className="user-profile-page">
        <div className="profile-hero-card skeleton-card">
          <div className="skeleton-line short" />
          <div className="skeleton-line long" />
        </div>
      </section>
    )
  }

  if (state.error || !state.user) {
    return (
      <section className="user-profile-page">
        <div className="feedback-card is-error">{state.error ?? '사용자 정보를 찾을 수 없어요.'}</div>
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
            <span className="section-kicker">Friend profile</span>
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
    </section>
  )
}
