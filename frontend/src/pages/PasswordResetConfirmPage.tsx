import { tr } from '../i18n'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ErrorToast } from '../components/ErrorToast'
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
  const [error, setError] = useState<string | null>(!token ? tr("재설정 토큰이 없어 비밀번호를 변경할 수 없어요.") : null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!token) {
      setError(tr("재설정 토큰이 없어 비밀번호를 변경할 수 없어요."))
      return
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(tr("비밀번호는 최소 {{v0}}자리 이상이어야 해요.", { v0: MIN_PASSWORD_LENGTH }))
      return
    }

    if (newPassword !== confirmPassword) {
      setError(tr("비밀번호 확인이 일치하지 않아요."))
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
      setError(submitError instanceof Error ? submitError.message : tr("비밀번호 재설정에 실패했어요."))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">{tr("새 비밀번호 설정")}</h1>
        <p className="auth-description">
          {tr("메일에서 연 링크가 맞다면 새 비밀번호를 입력하고 바로 로그인할 수 있어요.")}
        </p>

        <form className="auth-form" onSubmit={handleSubmit} autoComplete="on">
          <label className="auth-field">
            <span>{tr("새 비밀번호")}</span>
            <input
              type="password"
              name="new-password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder={tr("최소 8자리 입력")}
              minLength={MIN_PASSWORD_LENGTH}
              required
            />
          </label>

          <label className="auth-field">
            <span>{tr("새 비밀번호 확인")}</span>
            <input
              type="password"
              name="confirm-password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder={tr("비밀번호를 한 번 더 입력")}
              minLength={MIN_PASSWORD_LENGTH}
              required
            />
          </label>

          {successMessage && <div className="feedback-card">{successMessage}</div>}
          <ErrorToast message={error} />

          <div className="auth-action-row">
            <button className="primary-button auth-submit" type="submit" disabled={isSubmitting || !token}>
              {isSubmitting ? tr("변경 중...") : tr("비밀번호 변경")}
            </button>
            <Link className="secondary-button" to="/login">{tr("로그인으로 이동")}</Link>
          </div>
        </form>
      </div>
    </section>
  )
}
