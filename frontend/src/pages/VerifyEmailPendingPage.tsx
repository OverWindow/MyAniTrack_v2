import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { resendVerificationEmail } from '../lib/auth'
import '../styles/pages/AuthPage.css'

export function VerifyEmailPendingPage() {
  const location = useLocation()
  const [email, setEmail] = useState(() => new URLSearchParams(location.search).get('email') ?? '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<string | null>((location.state as { message?: string } | null)?.message ?? null)
  const [error, setError] = useState<string | null>(null)

  const handleResend = async () => {
    const normalizedEmail = email.trim()

    if (!normalizedEmail) {
      setError('인증 메일을 다시 보내려면 이메일을 입력해주세요.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await resendVerificationEmail(normalizedEmail)
      setFeedback(response.message)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '인증 메일 재전송에 실패했어요.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-card">
        <span className="section-kicker">Verify email</span>
        <h1 className="auth-title">이메일 인증이 필요해요</h1>
        <p className="auth-description">
          회원가입은 완료됐지만 아직 로그인할 수는 없어요. 받은 편지함에서 인증 메일을 열고 링크를 눌러주세요.
        </p>

        <div className="auth-form">
          <label className="auth-field">
            <span>인증 메일 받을 이메일</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="user@example.com"
              required
            />
          </label>

          {feedback && <div className="feedback-card">{feedback}</div>}
          {error && <div className="feedback-card is-error">{error}</div>}

          <div className="auth-action-row">
            <button className="primary-button auth-submit" type="button" onClick={() => { void handleResend() }} disabled={isSubmitting}>
              {isSubmitting ? '보내는 중...' : '메일 다시 보내기'}
            </button>
            <Link className="secondary-button" to="/login">로그인으로 이동</Link>
          </div>
        </div>
      </div>
    </section>
  )
}
