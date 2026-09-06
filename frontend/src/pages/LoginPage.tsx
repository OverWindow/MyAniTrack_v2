import { tr } from '../i18n'
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
          state: { message: tr("이메일 인증이 완료되어야 로그인할 수 있어요.") },
        })
        return
      }

      setError(
        submitError instanceof Error ? submitError.message : tr("로그인에 실패했어요."),
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
      await loginWithGoogle()
    } catch (submitError) {
      savePendingAuthReturnPath(null)
      setError(
        submitError instanceof Error ? submitError.message : tr("Google 로그인에 실패했어요."),
      )
      setIsGoogleSubmitting(false)
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">{tr("로그인")}</h1>
        <p className="auth-description">
          {tr("내 애니 기록과 친구 비교, 취향 분석을 이어서 확인해보세요.")}
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
          {isGoogleSubmitting ? tr("Google로 이동 중...") : tr("Google로 계속하기")}
        </button>

        <p className="auth-consent-notice">
          {tr("계속하면")} <Link to="/terms">{tr("이용약관")}</Link> {tr("및")}{' '}
          <Link to="/privacy">{tr("개인정보처리방침")}</Link>{tr("에 동의한 것으로 간주합니다.")}
        </p>

        <div className="auth-divider"><span>{tr("기존 회원 이메일 로그인")}</span></div>

        <form className="auth-form" onSubmit={handleSubmit} autoComplete="on">
          <label className="auth-field">
            <span>{tr("이메일")}</span>
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
            <span>{tr("비밀번호")}</span>
            <input
              type="password"
              name="current-password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={tr("비밀번호 입력")}
              required
            />
          </label>

          <div className="auth-inline-links">
            <Link to="/password-reset">{tr("비밀번호를 잊어버렸어요")}</Link>
          </div>

          <ErrorToast message={error} />

          <button className="primary-button auth-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? tr("로그인 중...") : tr("로그인")}
          </button>
        </form>

        <p className="auth-helper">
          {tr("아직 계정이 없다면")} <Link to="/signup">{tr("회원가입")}</Link>
        </p>
        <nav className="auth-policy-links" aria-label={tr("정책 링크")}>
          <Link to="/terms">{tr("이용약관")}</Link>
          <Link to="/privacy">{tr("개인정보처리방침")}</Link>
          <Link to="/account-deletion">{tr("계정 및 데이터 삭제")}</Link>
        </nav>
      </div>
    </section>
  )
}
