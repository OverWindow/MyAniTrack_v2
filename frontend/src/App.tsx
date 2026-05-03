import { Link, Route, Routes, useLocation } from 'react-router-dom'
import { Header } from './components/Header'
import { useAuth } from './contexts/AuthContext'
import { AnimeDetailPage } from './pages/AnimeDetailPage'
import { CollectionPage } from './pages/CollectionPage'
import { ExplorePage } from './pages/ExplorePage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { ProfileEditPage } from './pages/ProfileEditPage'
import { ProfilePage } from './pages/ProfilePage'
import { SignupPage } from './pages/SignupPage'
import './styles/App.css'

function App() {
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  const shouldShowFloatingCta = !['/login', '/signup'].includes(location.pathname)

  return (
    <div className="site-shell">
      <Header />
      <main className="landing-page">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/anime/:id" element={<AnimeDetailPage />} />
          <Route
            path="/profile"
            element={<ProfilePage />}
          />
          <Route path="/profile/edit" element={<ProfileEditPage />} />
          <Route
            path="/collection"
            element={<CollectionPage />}
          />
          <Route
            path="/friends"
            element={
              <PlaceholderPage
                title="친구 페이지 준비 중"
                description="친구 목록과 취향 비교, 공통 작품, 추천 매칭을 중심으로 확장하기 좋은 자리예요."
              />
            }
          />
          <Route
            path="/settings"
            element={
              <PlaceholderPage
                title="설정 페이지 준비 중"
                description="다크모드, 언어, 제목 표기 우선순위, 알림 같은 사용자 설정을 연결하기 좋아요."
              />
            }
          />
        </Routes>
      </main>
      {shouldShowFloatingCta && (
        <Link className="floating-cta" to={isAuthenticated ? '/collection' : '/explore'}>
          <span className="floating-cta-icon" aria-hidden="true">
            ✦
          </span>
          <span>{isAuthenticated ? '내 리스트' : '탐색'}</span>
        </Link>
      )}
    </div>
  )
}

export default App
