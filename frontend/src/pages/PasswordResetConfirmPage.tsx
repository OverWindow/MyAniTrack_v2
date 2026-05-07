import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { confirmPasswordReset } from '../lib/auth'
import '../styles/pages/AuthPage.css'

const MIN_PASSWORD_LENGTH = 8

export function PasswordResetConfirmPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') ?? ''
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(!token ? '재설정 토큰이 없어 비밀번호를 변경할 수 없어요.' : null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!token) {
      setError('재설정 토큰이 없어 비밀번호를 변경할 수 없어요.')
      return
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`비밀번호는 최소 ${MIN_PASSWORD_LENGTH}자리 이상이어야 해요.`)
      return
    }

    if (newPassword !== confirmPassword) {
      setError('비밀번호 확인이 일치하지 않아요.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await confirmPasswordReset(token, newPassword)
      setSuccessMessage(response.message)
      window.setTimeout(() => {
        navigate('/login', { replace: true })
      }, 1200)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '비밀번호 재설정에 실패했어요.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-card">
        <span className="section-kicker">New password</span>
        <h1 className="auth-title">새 비밀번호 설정</h1>
        <p className="auth-description">
          메일에서 연 링크가 맞다면 새 비밀번호를 입력하고 바로 로그인할 수 있어요.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-field">
            <span>새 비밀번호</span>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="최소 8자리 입력"
              minLength={MIN_PASSWORD_LENGTH}
              required
            />
          </label>

          <label className="auth-field">
            <span>새 비밀번호 확인</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="비밀번호를 한 번 더 입력"
              minLength={MIN_PASSWORD_LENGTH}
              required
            />
          </label>

          {successMessage && <div className="feedback-card">{successMessage}</div>}
          {error && <div className="feedback-card is-error">{error}</div>}

          <div className="auth-action-row">
            <button className="primary-button auth-submit" type="submit" disabled={isSubmitting || !token}>
              {isSubmitting ? '변경 중...' : '비밀번호 변경'}
            </button>
            <Link className="secondary-button" to="/login">로그인으로 이동</Link>
          </div>
        </form>
      </div>
    </section>
  )
}
