import { useState } from 'react'
import { Link } from 'react-router-dom'
import { GoogleIcon } from '../components/GoogleIcon'
import { ErrorToast } from '../components/ErrorToast'
import { useAuth } from '../contexts/AuthContext'
import '../styles/pages/AuthPage.css'

export function SignupPage() {
  const { loginWithGoogle } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGoogleSignup = async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      await loginWithGoogle()
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Google 회원가입에 실패했어요.',
      )
      setIsSubmitting(false)
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-card auth-card-signup">
        <h1 className="auth-title">회원가입</h1>
        <p className="auth-description">
          Google 계정 하나로 바로 MyAniTrack을 시작하세요.
        </p>

        <button
          className="auth-google-button"
          type="button"
          onClick={() => {
            void handleGoogleSignup()
          }}
          disabled={isSubmitting}
        >
          <GoogleIcon />
          {isSubmitting ? 'Google로 이동 중...' : 'Google로 계속하기'}
        </button>

        <p className="auth-consent-notice">
          계속하면 <Link to="/terms">이용약관</Link> 및{' '}
          <Link to="/privacy">개인정보처리방침</Link>에 동의한 것으로 간주합니다.
        </p>

        <ErrorToast message={error} />

        <p className="auth-helper">
          이미 계정이 있다면 <Link to="/login">로그인</Link>
        </p>
        <nav className="auth-policy-links" aria-label="정책 링크">
          <Link to="/terms">이용약관</Link>
          <Link to="/privacy">개인정보처리방침</Link>
          <Link to="/account-deletion">계정 및 데이터 삭제</Link>
        </nav>
      </div>
    </section>
  )
}
