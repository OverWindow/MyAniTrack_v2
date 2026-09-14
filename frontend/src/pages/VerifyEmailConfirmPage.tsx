import { tr } from '../i18n'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ErrorToast } from '../components/ErrorToast'
import { confirmEmailVerification } from '../lib/auth'
import '../styles/pages/AuthPage.css'

export function VerifyEmailConfirmPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [isLoading, setIsLoading] = useState(Boolean(token))
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(token ? null : tr("인증 토큰이 없어 이메일 인증을 진행할 수 없어요."))

  useEffect(() => {
    if (!token) {
      return
    }

    let isCancelled = false

    const runConfirmation = async () => {
      try {
        const response = await confirmEmailVerification(token)

        if (isCancelled) {
          return
        }

        setSuccessMessage(response.message)
      } catch (confirmError) {
        if (isCancelled) {
          return
        }

        setError(confirmError instanceof Error ? confirmError.message : tr("이메일 인증에 실패했어요."))
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    void runConfirmation()

    return () => {
      isCancelled = true
    }
  }, [token])

  return (
    <section className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">{tr("이메일 인증 확인")}</h1>
        <p className="auth-description">
          {tr("메일에서 연 링크를 확인하고 있어요. 잠시만 기다려주세요.")}
        </p>

        <div className="auth-form">
          {isLoading && <div className="feedback-card">{tr("이메일 인증을 확인하는 중...")}</div>}
          {successMessage && !isLoading && <div className="feedback-card">{successMessage}</div>}
          {!isLoading && <ErrorToast message={error} />}

          <div className="auth-action-row">
            <Link className="primary-button" to="/login">{tr("로그인하러 가기")}</Link>
            <Link className="secondary-button" to="/verify-email/pending">{tr("인증 메일 다시 받기")}</Link>
          </div>
        </div>
      </div>
    </section>
  )
}
