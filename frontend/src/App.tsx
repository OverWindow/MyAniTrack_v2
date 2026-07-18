import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import type { Location } from 'react-router-dom'
import { handleProfileImageError, getProfileImageSrc } from './lib/avatar'
import { formatFriendAnimeCount, getFriendPreviewName } from './lib/friends'
import { Header } from './components/Header'
import { useAuth } from './contexts/AuthContext'
import { useFriends } from './contexts/FriendsContext'
import { AdminPage } from './pages/AdminPage'
import { AnimeDetailPage } from './pages/AnimeDetailPage'
import { AnalysisPage } from './pages/AnalysisPage'
import { AuthCallbackPage } from './pages/AuthCallbackPage'
import { CollectionPage } from './pages/CollectionPage'
import { ExplorePage } from './pages/ExplorePage'
import { FriendsPage } from './pages/FriendsPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { PasswordResetConfirmPage } from './pages/PasswordResetConfirmPage'
import { PasswordResetRequestPage } from './pages/PasswordResetRequestPage'
import { ProfileEditPage } from './pages/ProfileEditPage'
import { ProfilePage } from './pages/ProfilePage'
import { SettingsPage } from './pages/SettingsPage'
import { SignupPage } from './pages/SignupPage'
import { UserAnalysisPage } from './pages/UserAnalysisPage'
import { UserCollectionPage } from './pages/UserCollectionPage'
import { UserProfilePage } from './pages/UserProfilePage'
import { VerifyEmailConfirmPage } from './pages/VerifyEmailConfirmPage'
import { VerifyEmailPendingPage } from './pages/VerifyEmailPendingPage'
import { VoiceActorDetailPage } from './pages/VoiceActorDetailPage'
import './styles/App.css'

const RecapPage = lazy(async () => {
  const module = await import('./pages/RecapPage')
  return { default: module.RecapPage }
})

function App() {
  const { isAuthenticated } = useAuth()
  const {
    friends,
    isLoading: isLoadingFriends,
    error: friendsError,
    refreshFriends,
  } = useFriends()
  const location = useLocation()
  const locationState = location.state as { backgroundLocation?: Location } | null
  const backgroundLocation = locationState?.backgroundLocation
  const activeRoute = backgroundLocation ?? location
  const isHomeRoute = activeRoute.pathname === '/'
  const isUserCollectionRoute = /^\/users\/[^/]+\/anime-list$/.test(activeRoute.pathname)
  const shouldShowFloatingCta = !backgroundLocation && !['/login', '/signup'].includes(location.pathname)
  const [isFriendsOpen, setIsFriendsOpen] = useState(false)
  const floatingPanelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isFriendsOpen) {
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!floatingPanelRef.current?.contains(event.target as Node)) {
        setIsFriendsOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFriendsOpen(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isFriendsOpen])

  const handleFriendsOverlayToggle = async () => {
    const nextOpen = !isFriendsOpen
    setIsFriendsOpen(nextOpen)

    if (!nextOpen) {
      return
    }

    await refreshFriends({ silent: true })
  }

  return (
    <div className="site-shell">
      <Header />
      <div id="collection-carousel-root" />
      <main className={[
        'landing-page',
        isHomeRoute ? 'landing-page-home' : '',
        isUserCollectionRoute ? 'landing-page-user-collection' : '',
      ].filter(Boolean).join(' ')}>
        <Routes location={activeRoute}>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/verify-email/pending" element={<VerifyEmailPendingPage />} />
          <Route path="/verify-email/confirm" element={<VerifyEmailConfirmPage />} />
          <Route path="/password-reset" element={<PasswordResetRequestPage />} />
          <Route path="/password-reset/confirm" element={<PasswordResetConfirmPage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/analysis" element={<AnalysisPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/anime/:id" element={<AnimeDetailPage />} />
          <Route path="/voice-actors/:voiceActorId" element={<VoiceActorDetailPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route
            path="/recap"
            element={(
              <Suspense fallback={<div className="feedback-card">리캡 화면을 준비하고 있어요...</div>}>
                <RecapPage />
              </Suspense>
            )}
          />
          <Route path="/profile/edit" element={<ProfileEditPage />} />
          <Route path="/collection" element={<CollectionPage />} />
          <Route path="/friends" element={<FriendsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/users/:userId/profile" element={<UserProfilePage />} />
          <Route path="/users/:userId/anime-list" element={<UserCollectionPage />} />
          <Route path="/users/:userId/anime-stats" element={<UserAnalysisPage />} />
        </Routes>
      </main>
      {backgroundLocation && (
        <div className="route-overlay" role="dialog" aria-modal="true" aria-label="애니 상세 정보">
          <div className="route-overlay-backdrop" />
          <div className="route-overlay-panel">
            <Routes>
              <Route path="/anime/:id" element={<AnimeDetailPage isOverlay />} />
            </Routes>
          </div>
        </div>
      )}
      {shouldShowFloatingCta && isAuthenticated && (
        <div className="floating-hub" ref={floatingPanelRef}>
          {isFriendsOpen && (
            <section id="floating-friends-panel" className="floating-friends-panel" aria-label="친구 빠른 목록">
              <div className="floating-friends-panel-header">
                <strong>친구 목록</strong>
                <button
                  className="floating-friends-close"
                  type="button"
                  onClick={() => setIsFriendsOpen(false)}
                  aria-label="친구 목록 닫기"
                >
                  ×
                </button>
              </div>
              {isLoadingFriends ? (
                <p className="floating-friends-feedback">친구 목록을 불러오는 중...</p>
              ) : friendsError ? (
                <p className="floating-friends-feedback is-error">{friendsError}</p>
              ) : friends.length === 0 ? (
                <p className="floating-friends-feedback">아직 추가된 친구가 없어요.</p>
              ) : (
                <div className="floating-friends-list">
                  {friends.map((friend) => {
                    const name = getFriendPreviewName(friend.user)

                    return (
                      <Link
                        key={friend.id}
                        className="floating-friend-item"
                        to={`/users/${friend.user.id}/anime-list`}
                        onClick={() => setIsFriendsOpen(false)}
                      >
                        <img
                          className="avatar avatar-image floating-friend-avatar"
                          src={getProfileImageSrc(friend.user.profileImageUrl)}
                          alt={`${name} 프로필 이미지`}
                          onError={handleProfileImageError}
                        />
                        <span className="floating-friend-copy">
                          <strong>{name}</strong>
                          <small>{formatFriendAnimeCount(friend.user.animeListCount)}</small>
                        </span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </section>
          )}

          <button
            className="floating-hub-trigger"
            type="button"
            aria-label="친구 목록 열기"
            aria-expanded={isFriendsOpen}
            aria-controls="floating-friends-panel"
            onClick={() => { void handleFriendsOverlayToggle() }}
          >
            <span className="floating-hub-icon" aria-hidden="true">✦</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default App
