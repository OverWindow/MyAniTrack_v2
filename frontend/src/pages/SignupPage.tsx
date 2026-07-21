import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AGREEMENT_SECTIONS, AGREEMENT_VERSION, type AgreementKey } from '../content/agreements'
import { GoogleIcon } from '../components/GoogleIcon'
import { checkUsernameAvailability, savePendingAgreements, savePendingSupabaseAgreements } from '../lib/auth'
import { useAuth } from '../contexts/AuthContext'
import '../styles/pages/AuthPage.css'

function getWebDeviceName() {
  return `Web on ${window.navigator.platform || 'Unknown'}`
}

type UsernameCheckState = {
  checkedUsername: string | null
  isAvailable: boolean | null
  message: string | null
}

const MIN_PASSWORD_LENGTH = 8

export function SignupPage() {
  const { loginWithGoogle, signupWithEmail } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const routeMessage = (location.state as { message?: string } | null)?.message
  const [form, setForm] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
  })
  const [agreements, setAgreements] = useState({
    termsAgreed: false,
    privacyAgreed: false,
  })
  const [activeAgreement, setActiveAgreement] = useState<AgreementKey | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false)
  const [isCheckingUsername, setIsCheckingUsername] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [usernameCheck, setUsernameCheck] = useState<UsernameCheckState>({
    checkedUsername: null,
    isAvailable: null,
    message: null,
  })

  const normalizedUsername = form.username.trim()
  const normalizedEmail = form.email.trim()
  const isUsernameVerified = useMemo(
    () => usernameCheck.isAvailable === true && usernameCheck.checkedUsername === normalizedUsername,
    [normalizedUsername, usernameCheck.checkedUsername, usernameCheck.isAvailable],
  )
  const activeAgreementContent = activeAgreement ? AGREEMENT_SECTIONS[activeAgreement] : null

  useEffect(() => {
    if (!activeAgreement) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveAgreement(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeAgreement])

  const handleUsernameChange = (value: string) => {
    setForm((current) => ({ ...current, username: value }))
    setUsernameCheck((current) => {
      if (current.checkedUsername === null && current.message === null) {
        return current
      }

      return {
        checkedUsername: null,
        isAvailable: null,
        message: null,
      }
    })
  }

  const handleCheckUsername = async () => {
    if (!normalizedUsername) {
      setUsernameCheck({
        checkedUsername: null,
        isAvailable: null,
        message: '닉네임을 먼저 입력해주세요.',
      })
      return
    }

    setIsCheckingUsername(true)
    setUsernameCheck({
      checkedUsername: null,
      isAvailable: null,
      message: null,
    })

    try {
      const result = await checkUsernameAvailability(normalizedUsername)
      setUsernameCheck({
        checkedUsername: result.username,
        isAvailable: result.available,
        message: result.available ? '사용 가능한 닉네임이에요.' : '이미 사용 중인 닉네임이에요.',
      })
    } catch (checkError) {
      setUsernameCheck({
        checkedUsername: normalizedUsername,
        isAvailable: false,
        message:
          checkError instanceof Error
            ? checkError.message
            : '닉네임 중복 확인에 실패했어요.',
      })
    } finally {
      setIsCheckingUsername(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const validationMessages: string[] = []

    if (!isUsernameVerified) {
      validationMessages.push('닉네임 중복 확인을 해주세요.')
    }

    if (form.password.length < MIN_PASSWORD_LENGTH) {
      validationMessages.push(`비밀번호는 최소 ${MIN_PASSWORD_LENGTH}자리 이상이어야 해요.`)
    }

    if (form.password !== form.confirmPassword) {
      validationMessages.push('비밀번호 확인이 일치하지 않아요.')
    }

    if (!agreements.termsAgreed || !agreements.privacyAgreed) {
      validationMessages.push('필수 약관에 동의해주세요.')
    }

    if (validationMessages.length > 0) {
      setError(validationMessages.join(' '))
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await signupWithEmail({
        email: normalizedEmail,
        username: normalizedUsername,
        password: form.password,
        deviceType: 'web',
        deviceName: getWebDeviceName(),
      })

      savePendingAgreements(normalizedEmail, {
        termsAgreed: true,
        termsVersion: AGREEMENT_VERSION,
        privacyAgreed: true,
        privacyVersion: AGREEMENT_VERSION,
      })

      navigate(`/verify-email/pending?email=${encodeURIComponent(normalizedEmail)}`, {
        replace: true,
        state: {
          message: response.message,
        },
      })
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : '회원가입에 실패했어요.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGoogleSignup = async () => {
    if (!agreements.termsAgreed || !agreements.privacyAgreed) {
      setError('Google로 계속하려면 필수 약관에 먼저 동의해주세요.')
      return
    }

    setIsGoogleSubmitting(true)
    setError(null)

    try {
      savePendingSupabaseAgreements({
        termsAgreed: true,
        termsVersion: AGREEMENT_VERSION,
        privacyAgreed: true,
        privacyVersion: AGREEMENT_VERSION,
      })
      await loginWithGoogle('signup')
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Google 회원가입에 실패했어요.',
      )
      setIsGoogleSubmitting(false)
    }
  }

  return (
    <>
      <section className="auth-page">
        <div className="auth-card auth-card-wide auth-card-signup">
          <h1 className="auth-title">회원가입</h1>
          <p className="auth-description">
            이메일 인증을 완료해야 MyAniTrack에 로그인할 수 있어요.
          </p>
          {routeMessage && <div className="feedback-card">{routeMessage}</div>}

          <form className="auth-form" onSubmit={handleSubmit} autoComplete="on">
            <label className="auth-field">
              <span>이메일</span>
              <input
                type="email"
                name="email"
                autoComplete="email"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({ ...current, email: event.target.value }))
                }
                placeholder="user@example.com"
                required
              />
            </label>

            <div className="auth-field">
              <span>사용자명</span>
              <div className="auth-inline-field">
                <input
                  type="text"
                  name="username"
                  autoComplete="username"
                  value={form.username}
                  onChange={(event) => handleUsernameChange(event.target.value)}
                  placeholder="test_user"
                  required
                />
                <button
                  className="secondary-button auth-inline-button"
                  type="button"
                  onClick={() => {
                    void handleCheckUsername()
                  }}
                  disabled={isCheckingUsername}
                >
                  {isCheckingUsername ? '확인 중...' : '중복 확인'}
                </button>
              </div>
              {usernameCheck.message && (
                <p
                  className={
                    usernameCheck.isAvailable
                      ? 'auth-field-hint is-success'
                      : 'auth-field-hint is-error'
                  }
                >
                  {usernameCheck.message}
                </p>
              )}
              {!isUsernameVerified && normalizedUsername && !usernameCheck.message && (
                <p className="auth-field-hint">회원가입 전에 닉네임 중복 확인을 완료해주세요.</p>
              )}
            </div>

            <label className="auth-field">
              <span>비밀번호</span>
              <input
                type="password"
                name="new-password"
                autoComplete="new-password"
                value={form.password}
                onChange={(event) =>
                  setForm((current) => ({ ...current, password: event.target.value }))
                }
                placeholder="최소 8자리 입력"
                minLength={MIN_PASSWORD_LENGTH}
                required
              />
              <p className="auth-field-hint">비밀번호는 최소 8자리 이상이어야 해요.</p>
            </label>

            <label className="auth-field">
              <span>비밀번호 확인</span>
              <input
                type="password"
                name="confirm-password"
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={(event) =>
                  setForm((current) => ({ ...current, confirmPassword: event.target.value }))
                }
                placeholder="비밀번호를 한 번 더 입력"
                minLength={MIN_PASSWORD_LENGTH}
                required
              />
            </label>

            <section className="agreement-panel agreement-panel-compact" aria-label="약관 동의">
              <div className="agreement-panel-compact-copy">
                <strong>필수 약관 동의</strong>
                <p>회원가입을 위해 아래 2개 약관 동의가 필요해요.</p>
              </div>

              <div className="agreement-checks agreement-checks-compact">
                <div className="agreement-check-row compact-row">
                  <label className="consent-field agreement-check compact-check required">
                    <input
                      type="checkbox"
                      checked={agreements.termsAgreed}
                      onChange={(event) =>
                        setAgreements((current) => ({
                          ...current,
                          termsAgreed: event.target.checked,
                        }))
                      }
                    />
                    <span>이용약관 동의 (필수)</span>
                  </label>
                  <button className="agreement-inline-link" type="button" onClick={() => setActiveAgreement('terms')}>
                    보기
                  </button>
                </div>

                <div className="agreement-check-row compact-row">
                  <label className="consent-field agreement-check compact-check required">
                    <input
                      type="checkbox"
                      checked={agreements.privacyAgreed}
                      onChange={(event) =>
                        setAgreements((current) => ({
                          ...current,
                          privacyAgreed: event.target.checked,
                        }))
                      }
                    />
                    <span>개인정보처리방침 동의 (필수)</span>
                  </label>
                  <button className="agreement-inline-link" type="button" onClick={() => setActiveAgreement('privacy')}>
                    보기
                  </button>
                </div>
              </div>
            </section>

            <button
              className="auth-google-button auth-google-button-inline"
              type="button"
              onClick={() => {
                void handleGoogleSignup()
              }}
              disabled={isSubmitting || isGoogleSubmitting}
            >
              <GoogleIcon />
              {isGoogleSubmitting ? 'Google로 이동 중...' : 'Google로 계속하기'}
            </button>

            <div className="auth-divider auth-divider-compact"><span>또는 이메일로 가입</span></div>

            {error && <div className="feedback-card is-error">{error}</div>}

            <button className="primary-button auth-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? '가입 중...' : '회원가입'}
            </button>
          </form>

          <p className="auth-helper">
            이미 계정이 있다면 <Link to="/login">로그인</Link>
          </p>
          <nav className="auth-policy-links" aria-label="정책 링크">
            <Link to="/privacy">개인정보처리방침 전문</Link>
            <Link to="/account-deletion">계정 및 데이터 삭제</Link>
          </nav>
        </div>
      </section>

      {activeAgreementContent && (
        <div className="agreement-modal-backdrop" role="presentation" onClick={() => setActiveAgreement(null)}>
          <div
            className="agreement-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="agreement-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="agreement-modal-header">
              <div>
                <h2 id="agreement-modal-title">{activeAgreementContent.title}</h2>
              </div>
              <button className="secondary-button agreement-close-button" type="button" onClick={() => setActiveAgreement(null)}>
                닫기
              </button>
            </div>
            <div className="agreement-modal-body">
              {activeAgreementContent.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
