import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import '../styles/pages/AuthPage.css'

function getWebDeviceName() {
  return `Web on ${window.navigator.platform || 'Unknown'}`
}

export function SignupPage() {
  const { signupWithEmail } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    email: '',
    username: '',
    password: '',
    profileImageUrl: '',
    bio: '',
    marketingConsent: false,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      await signupWithEmail({
        email: form.email,
        username: form.username,
        password: form.password,
        profileImageUrl: form.profileImageUrl || undefined,
        bio: form.bio || undefined,
        deviceType: 'web',
        deviceName: getWebDeviceName(),
      })
      navigate('/', { replace: true })
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : '회원가입에 실패했어요.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-card auth-card-wide">
        <span className="section-kicker">Create account</span>
        <h1 className="auth-title">회원가입</h1>
        <p className="auth-description">
          MyAniTrack에 가입하고 본 작품을 저장하고 취향 데이터를 쌓아보세요.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-grid">
            <label className="auth-field">
              <span>이메일</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({ ...current, email: event.target.value }))
                }
                placeholder="user@example.com"
                required
              />
            </label>

            <label className="auth-field">
              <span>사용자명</span>
              <input
                type="text"
                value={form.username}
                onChange={(event) =>
                  setForm((current) => ({ ...current, username: event.target.value }))
                }
                placeholder="test_user"
                required
              />
            </label>
          </div>

          <label className="auth-field">
            <span>비밀번호</span>
            <input
              type="password"
              value={form.password}
              onChange={(event) =>
                setForm((current) => ({ ...current, password: event.target.value }))
              }
              placeholder="비밀번호 입력"
              required
            />
          </label>

          <label className="auth-field">
            <span>프로필 이미지 URL</span>
            <input
              type="url"
              value={form.profileImageUrl}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  profileImageUrl: event.target.value,
                }))
              }
              placeholder="https://example.com/profile.png"
            />
          </label>

          <label className="auth-field">
            <span>소개</span>
            <textarea
              value={form.bio}
              onChange={(event) =>
                setForm((current) => ({ ...current, bio: event.target.value }))
              }
              placeholder="좋아하는 장르나 한 줄 소개를 적어보세요."
              rows={4}
            />
          </label>

          <label className="consent-field">
            <input
              type="checkbox"
              checked={form.marketingConsent}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  marketingConsent: event.target.checked,
                }))
              }
            />
            <span>이벤트, 업데이트, 추천 소식을 이메일로 받아볼게요. (선택)</span>
          </label>

          {error && <div className="feedback-card is-error">{error}</div>}

          <button className="primary-button auth-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? '가입 중...' : '회원가입'}
          </button>
        </form>

        <p className="auth-helper">
          이미 계정이 있다면 <Link to="/login">로그인</Link>
        </p>
      </div>
    </section>
  )
}
