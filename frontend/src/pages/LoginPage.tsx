import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { GoogleIcon } from '../components/GoogleIcon'
import { ErrorToast } from '../components/ErrorToast'
import { useAuth } from '../contexts/AuthContext'
import {
  getSafeAuthReturnPath,
  isEmailVerificationRequiredError,
  savePendingAuthReturnPath,
} from '../lib/auth'
import '../styles/pages/AuthPage.css'

function getWebDeviceName() {
  return `Web on ${window.navigator.platform || 'Unknown'}`
}

export function LoginPage() {
  const { loginWithEmail, loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const redirectTo = getSafeAuthReturnPath((location.state as { from?: unknown } | null)?.from) ?? '/'

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
      if (isEmailVerificationRequiredError(submitError)) {
        navigate(`/verify-email/pending?email=${encodeURIComponent(email.trim())}`, {
          replace: true,
          state: { message: '이메일 인증이 완료되어야 로그인할 수 있어요.' },
        })
        return
      }

      setError(
        submitError instanceof Error ? submitError.message : '로그인에 실패했어요.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGoogleLogin = async () => {
    setIsGoogleSubmitting(true)
    setError(null)
    savePendingAuthReturnPath(redirectTo)

    try {
      await loginWithGoogle('login')
    } catch (submitError) {
      savePendingAuthReturnPath(null)
      setError(
        submitError instanceof Error ? submitError.message : 'Google 로그인에 실패했어요.',
      )
      setIsGoogleSubmitting(false)
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">로그인</h1>
        <p className="auth-description">
          내 애니 기록과 친구 비교, 취향 분석을 이어서 확인해보세요.
        </p>

        <button
          className="auth-google-button"
          type="button"
          onClick={() => {
            void handleGoogleLogin()
          }}
          disabled={isSubmitting || isGoogleSubmitting}
        >
          <GoogleIcon />
          {isGoogleSubmitting ? 'Google로 이동 중...' : 'Google로 계속하기'}
        </button>

        <div className="auth-divider"><span>또는</span></div>

        <form className="auth-form" onSubmit={handleSubmit} autoComplete="on">
          <label className="auth-field">
            <span>이메일</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
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
              name="current-password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="비밀번호 입력"
              required
            />
          </label>

          <div className="auth-inline-links">
            <Link to="/password-reset">비밀번호를 잊어버렸어요</Link>
          </div>

          <ErrorToast message={error} />

          <button className="primary-button auth-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <p className="auth-helper">
          아직 계정이 없다면 <Link to="/signup">회원가입</Link>
        </p>
        <nav className="auth-policy-links" aria-label="정책 링크">
          <Link to="/privacy">개인정보처리방침</Link>
          <Link to="/account-deletion">계정 및 데이터 삭제</Link>
        </nav>
      </div>
    </section>
  )
}
