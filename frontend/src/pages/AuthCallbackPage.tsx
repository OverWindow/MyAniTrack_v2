import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getPendingSupabaseAuthIntent, isAgreementsRequiredError } from '../lib/auth'
import '../styles/pages/AuthPage.css'

export function AuthCallbackPage() {
  const { completeGoogleLogin } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const callbackPromiseRef = useRef<Promise<void> | null>(null)
  const intent = getPendingSupabaseAuthIntent()

  useEffect(() => {
    if (callbackPromiseRef.current) {
      return
    }

    callbackPromiseRef.current = completeGoogleLogin(intent)
      .then(() => {
        navigate('/', { replace: true })
      })
      .catch((callbackError: unknown) => {
        if (isAgreementsRequiredError(callbackError)) {
          navigate('/signup', {
            replace: true,
            state: {
              message: intent === 'login'
                ? '처음 사용하는 Google 계정이에요. 필수 약관에 동의한 뒤 Google로 계속해주세요.'
                : callbackError instanceof Error
                  ? callbackError.message
                  : '필수 약관에 동의한 뒤 Google로 계속해주세요.',
            },
          })
          return
        }

        setError(
          callbackError instanceof Error
            ? callbackError.message
            : 'Google 로그인 처리에 실패했어요.',
        )
      })
  }, [completeGoogleLogin, intent, navigate])

  return (
    <section className="auth-page">
      <div className="auth-card auth-callback-card">
        <h1 className="auth-title">로그인 처리 중</h1>
        {error ? (
          <>
            <div className="feedback-card is-error">{error}</div>
            <Link className="secondary-button auth-submit" to="/login">
              로그인으로 돌아가기
            </Link>
          </>
        ) : (
          <p className="auth-description">Google 계정을 MyAniTrack에 연결하고 있어요.</p>
        )}
      </div>
    </section>
  )
}
