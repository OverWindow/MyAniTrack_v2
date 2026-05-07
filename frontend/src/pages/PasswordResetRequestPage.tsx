import { useState } from 'react'
import { Link } from 'react-router-dom'
import { requestPasswordReset } from '../lib/auth'
import '../styles/pages/AuthPage.css'

export function PasswordResetRequestPage() {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await requestPasswordReset(email.trim())
      setSuccessMessage(response.message)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '재설정 메일 요청에 실패했어요.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-card">
        <span className="section-kicker">Password reset</span>
        <h1 className="auth-title">비밀번호 찾기</h1>
        <p className="auth-description">
          가입한 이메일 주소를 입력하면 비밀번호를 다시 설정할 수 있는 메일을 보내드릴게요.
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

          {successMessage && <div className="feedback-card">{successMessage}</div>}
          {error && <div className="feedback-card is-error">{error}</div>}

          <div className="auth-action-row">
            <button className="primary-button auth-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? '보내는 중...' : '재설정 메일 보내기'}
            </button>
            <Link className="secondary-button" to="/login">로그인으로 돌아가기</Link>
          </div>
        </form>
      </div>
    </section>
  )
}
