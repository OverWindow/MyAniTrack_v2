import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getProfileImageSrc, handleProfileImageError } from '../lib/avatar'

const baseNavItems = [
  { label: '홈', to: '/' },
  { label: '컬렉션', to: '/collection' },
  { label: '분석', to: '/analysis' },
  { label: '탐색', to: '/explore' },
  { label: '친구', to: '/friends' },
]

export function Header() {
  const { isAuthenticated, isBootstrapping, logout, logoutEverywhere, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const displayName = user?.username?.trim() || user?.email?.split('@')[0] || 'MyAniTrack User'
  const isAdmin = user?.isAdmin || user?.role === 'ADMIN'
  const navItems = isAdmin
    ? [...baseNavItems, { label: '관리자', to: '/admin' }]
    : baseNavItems
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setIsMobileMenuOpen(false)
    setIsProfileMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!isProfileMenuOpen) {
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (profileMenuRef.current?.contains(event.target as Node)) {
        return
      }

      setIsProfileMenuOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsProfileMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isProfileMenuOpen])

  return (
    <header className="site-header">
      <div className="topbar-shell">
        <div className="topbar">
          <div className="brand-block">
            <NavLink className="brand" to="/" aria-label="MyAniTrack 홈">
              <span className="brand-mark" aria-hidden="true">
                <span className="brand-mark-core" />
              </span>
              <span className="brand-text">
                <span className="brand-title">MyAniTrack</span>
                <span className="brand-caption">Track your anime taste</span>
              </span>
            </NavLink>
          </div>

          <button
            className={isMobileMenuOpen ? 'mobile-menu-button is-open' : 'mobile-menu-button'}
            type="button"
            aria-label="메뉴 열기"
            aria-expanded={isMobileMenuOpen}
            aria-controls="site-mobile-menu"
            onClick={() => setIsMobileMenuOpen((current) => !current)}
          >
            <span />
            <span />
            <span />
          </button>

          <div
            className={isMobileMenuOpen ? 'header-menu-panel is-open' : 'header-menu-panel'}
            id="site-mobile-menu"
          >
            <nav className="main-nav" aria-label="주 메뉴">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    isActive ? 'nav-link is-active' : 'nav-link'
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>

            {isAuthenticated && user ? (
              <div className="profile-dropdown" ref={profileMenuRef}>
                <button
                  className={isProfileMenuOpen ? 'profile-chip profile-chip-button is-open' : 'profile-chip profile-chip-button'}
                  type="button"
                  aria-expanded={isProfileMenuOpen}
                  aria-controls="profile-menu-card"
                  onClick={() => setIsProfileMenuOpen((current) => !current)}
                >
                  <img
                    className="avatar avatar-image"
                    src={getProfileImageSrc(user.profileImageUrl)}
                    alt={displayName}
                    onError={handleProfileImageError}
                  />
                  <div className="profile-meta">
                    <div className="profile-name-row">
                      <strong className="profile-name">{displayName}</strong>
                      {isAdmin && <span className="admin-badge">관리자</span>}
                    </div>
                    <span className="profile-status">{user.bio || user.email}</span>
                  </div>
                  <span className="profile-menu-caret" aria-hidden="true">▾</span>
                </button>

                <div
                  className={isProfileMenuOpen ? 'profile-dropdown-card is-open' : 'profile-dropdown-card'}
                  id="profile-menu-card"
                >
                  <NavLink className="profile-dropdown-link" to="/profile" onClick={() => setIsProfileMenuOpen(false)}>
                    프로필
                  </NavLink>
                  <NavLink className="profile-dropdown-link" to="/settings" onClick={() => setIsProfileMenuOpen(false)}>
                    설정
                  </NavLink>
                  <button
                    className="profile-dropdown-link profile-dropdown-button"
                    type="button"
                    onClick={() => {
                      setIsProfileMenuOpen(false)
                      void logout()
                      navigate('/')
                    }}
                  >
                    로그아웃
                  </button>
                  <button
                    className="profile-dropdown-link profile-dropdown-button"
                    type="button"
                    onClick={() => {
                      setIsProfileMenuOpen(false)
                      void logoutEverywhere()
                      navigate('/')
                    }}
                  >
                    전체 로그아웃
                  </button>
                </div>
              </div>
            ) : (
              <div className="auth-chip">
                <NavLink className="auth-link" to="/login">
                  로그인
                </NavLink>
                <NavLink className="auth-link auth-link-primary" to="/signup">
                  회원가입
                </NavLink>
                {isBootstrapping && <span className="auth-booting">불러오는 중...</span>}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
