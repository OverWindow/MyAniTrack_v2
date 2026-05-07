import { useEffect, useRef, useState } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import { handleProfileImageError, getProfileImageSrc } from './lib/avatar'
import { fetchFriends, formatFriendAnimeCount, getFriendInitials, getFriendPreviewName, sortFriendsByNewest } from './lib/friends'
import type { FriendItem } from './types/friends'
import { Header } from './components/Header'
import { useAuth } from './contexts/AuthContext'
import { AdminPage } from './pages/AdminPage'
import { AnimeDetailPage } from './pages/AnimeDetailPage'
import { AnalysisPage } from './pages/AnalysisPage'
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
import './styles/App.css'

function App() {
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  const shouldShowFloatingCta = !['/login', '/signup'].includes(location.pathname)
  const [friends, setFriends] = useState<FriendItem[]>([])
  const [isFriendsOpen, setIsFriendsOpen] = useState(false)
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false)
  const [isLoadingFriends, setIsLoadingFriends] = useState(false)
  const [friendsError, setFriendsError] = useState<string | null>(null)
  const floatingPanelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isQuickMenuOpen && !isFriendsOpen) {
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!floatingPanelRef.current?.contains(event.target as Node)) {
        setIsQuickMenuOpen(false)
        setIsFriendsOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsQuickMenuOpen(false)
        setIsFriendsOpen(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isFriendsOpen, isQuickMenuOpen])

  const handleFriendsOverlayToggle = async () => {
    const nextOpen = !isFriendsOpen
    setIsQuickMenuOpen(true)
    setIsFriendsOpen(nextOpen)

    if (!nextOpen) {
      return
    }

    setIsLoadingFriends(true)
    setFriendsError(null)

    try {
      const items = await fetchFriends()
      setFriends(sortFriendsByNewest(items))
    } catch (error) {
      setFriendsError(error instanceof Error ? error.message : '친구 목록을 불러오지 못했어요.')
    } finally {
      setIsLoadingFriends(false)
    }
  }

  return (
    <div className="site-shell">
      <Header />
      <main className="landing-page">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/verify-email/pending" element={<VerifyEmailPendingPage />} />
          <Route path="/verify-email/confirm" element={<VerifyEmailConfirmPage />} />
          <Route path="/password-reset" element={<PasswordResetRequestPage />} />
          <Route path="/password-reset/confirm" element={<PasswordResetConfirmPage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/analysis" element={<AnalysisPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/anime/:id" element={<AnimeDetailPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/edit" element={<ProfileEditPage />} />
          <Route path="/collection" element={<CollectionPage />} />
          <Route path="/friends" element={<FriendsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/users/:userId/profile" element={<UserProfilePage />} />
          <Route path="/users/:userId/anime-list" element={<UserCollectionPage />} />
          <Route path="/users/:userId/anime-stats" element={<UserAnalysisPage />} />
        </Routes>
      </main>
      {shouldShowFloatingCta && isAuthenticated && (
        <div className="floating-hub" ref={floatingPanelRef}>
          <button
            className="floating-hub-trigger"
            type="button"
            aria-label="빠른 메뉴 열기"
            aria-expanded={isQuickMenuOpen}
            onClick={() => {
              setIsQuickMenuOpen((current) => {
                const nextOpen = !current

                if (!nextOpen) {
                  setIsFriendsOpen(false)
                }

                return nextOpen
              })
            }}
          >
            <span className="floating-hub-icon" aria-hidden="true">✦</span>
          </button>

          <div className={isQuickMenuOpen ? 'floating-hub-menu is-open' : 'floating-hub-menu'}>
            <div className="floating-friends-stack">
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
                        const initials = getFriendInitials(friend.user)

                        return (
                          <Link
                            key={friend.id}
                            className="floating-friend-item"
                            to={`/users/${friend.user.id}/anime-list`}
                            onClick={() => {
                              setIsFriendsOpen(false)
                              setIsQuickMenuOpen(false)
                            }}
                          >
                            {friend.user.profileImageUrl ? (
                              <img
                                className="avatar avatar-image floating-friend-avatar"
                                src={getProfileImageSrc(friend.user.profileImageUrl)}
                                alt={`${name} 프로필 이미지`}
                                onError={handleProfileImageError}
                              />
                            ) : (
                              <span className="avatar floating-friend-avatar" aria-hidden="true">{initials}</span>
                            )}
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
                className="floating-cta floating-cta-wide floating-cta-secondary floating-cta-button"
                type="button"
                onClick={() => { void handleFriendsOverlayToggle() }}
                aria-expanded={isFriendsOpen}
                aria-controls="floating-friends-panel"
              >
                <span className="floating-cta-icon" aria-hidden="true">✦</span>
                <span>친구 목록</span>
              </button>
            </div>

            <Link className="floating-cta floating-cta-wide" to="/collection" onClick={() => setIsQuickMenuOpen(false)}>
              <span className="floating-cta-icon" aria-hidden="true">✦</span>
              <span>컬렉션</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
