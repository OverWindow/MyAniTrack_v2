import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const navItems = [
  { label: '홈', to: '/' },
  { label: '프로필', to: '/profile' },
  { label: '컬렉션', to: '/collection' },
  { label: '분석', to: '/analysis' },
  { label: '친구', to: '/friends' },
  { label: '탐색', to: '/explore' },
  { label: '설정', to: '/settings' },
]

export function Header() {
  const { isAuthenticated, isBootstrapping, logout, logoutEverywhere, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const displayName = user?.username?.trim() || user?.email?.split('@')[0] || 'MyAniTrack User'
  const initials = displayName.slice(0, 2).toUpperCase() || 'MY'
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [location.pathname])

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
              <div className="profile-chip">
                {user.profileImageUrl ? (
                  <img className="avatar avatar-image" src={user.profileImageUrl} alt={displayName} />
                ) : (
                  <div className="avatar" aria-hidden="true">
                    <span>{initials}</span>
                  </div>
                )}
                <div className="profile-meta">
                  <strong className="profile-name">{displayName}</strong>
                  <span className="profile-status">{user.bio || user.email}</span>
                </div>
                <div className="profile-actions">
                  <button
                    className="logout-button"
                    type="button"
                    onClick={() => {
                      void logout()
                      navigate('/')
                    }}
                  >
                    로그아웃
                  </button>
                  <button
                    className="logout-button secondary-logout"
                    type="button"
                    onClick={() => {
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
