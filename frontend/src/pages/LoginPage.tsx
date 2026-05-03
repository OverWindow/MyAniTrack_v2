import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import '../styles/pages/AuthPage.css'

function getWebDeviceName() {
  return `Web on ${window.navigator.platform || 'Unknown'}`
}

export function LoginPage() {
  const { loginWithEmail } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/'

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      await loginWithEmail({
        email,
        password,
        deviceType: 'web',
        deviceName: getWebDeviceName(),
      })
      navigate(redirectTo, { replace: true })
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : '로그인에 실패했어요.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-card">
        <span className="section-kicker">Welcome back</span>
        <h1 className="auth-title">로그인</h1>
        <p className="auth-description">
          내 애니 기록과 친구 비교, 취향 분석을 이어서 확인해보세요.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-field">
            <span>이메일</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="user@example.com"
              required
            />
          </label>

          <label className="auth-field">
            <span>비밀번호</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="비밀번호 입력"
              required
            />
          </label>

          {error && <div className="feedback-card is-error">{error}</div>}

          <button className="primary-button auth-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <p className="auth-helper">
          아직 계정이 없다면 <Link to="/signup">회원가입</Link>
        </p>
      </div>
    </section>
  )
}
