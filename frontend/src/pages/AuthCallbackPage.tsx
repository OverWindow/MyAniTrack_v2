import { tr } from '../i18n'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ErrorToast } from '../components/ErrorToast'
import { useAuth } from '../contexts/AuthContext'
import {
  consumePendingAuthReturnPath,
} from '../lib/auth'
import '../styles/pages/AuthPage.css'

export function AuthCallbackPage() {
  const { completeGoogleLogin } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const callbackPromiseRef = useRef<Promise<void> | null>(null)
  useEffect(() => {
    if (callbackPromiseRef.current) {
      return
    }

    callbackPromiseRef.current = completeGoogleLogin()
      .then(() => {
        navigate(consumePendingAuthReturnPath() ?? '/', { replace: true })
      })
      .catch((callbackError: unknown) => {
        consumePendingAuthReturnPath()
        setError(
          callbackError instanceof Error
            ? callbackError.message
            : tr("Google 로그인 처리에 실패했어요."),
        )
      })
  }, [completeGoogleLogin, navigate])

  return (
    <section className="auth-page">
      <div className="auth-card auth-callback-card">
        <h1 className="auth-title">{tr("로그인 처리 중")}</h1>
        {error ? (
          <>
            <ErrorToast message={error} />
            <div className="feedback-card">{tr("로그인 연결을 완료하지 못했어요.")}</div>
            <Link className="secondary-button auth-submit" to="/login">
              {tr("로그인으로 돌아가기")}
            </Link>
          </>
        ) : (
          <p className="auth-description">{tr("Google 계정을 MyAniTrack에 연결하고 있어요.")}</p>
        )}
      </div>
    </section>
  )
}
