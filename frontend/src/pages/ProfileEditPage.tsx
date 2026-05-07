import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getProfileImageSrc, handleProfileImageError } from '../lib/avatar'
import '../styles/pages/AuthPage.css'
import '../styles/pages/ProfilePage.css'

export function ProfileEditPage() {
  const { isAuthenticated, user, updateMyProfile } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState(user?.username ?? '')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [removeProfileImage, setRemoveProfileImage] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const previewUrl = useMemo(() => {
    if (selectedFile) {
      return URL.createObjectURL(selectedFile)
    }

    if (!removeProfileImage) {
      return user?.profileImageUrl ?? null
    }

    return null
  }, [removeProfileImage, selectedFile, user?.profileImageUrl])

  const displayName = username.trim() || user?.username || 'MyAniTrack User'
  const hasChanges =
    username.trim() !== user?.username || Boolean(selectedFile) || removeProfileImage

  useEffect(() => {
    return () => {
      if (selectedFile && previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl, selectedFile])

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: '/profile/edit' }} />
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      await updateMyProfile({
        username: username.trim() || undefined,
        profileImage: removeProfileImage ? null : selectedFile,
        removeProfileImage,
      })

      navigate('/profile', { replace: true })
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : '프로필 저장에 실패했어요.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="auth-page profile-edit-page">
      <div className="auth-card auth-card-wide profile-edit-card">
        <span className="section-kicker">Edit profile</span>
        <h1 className="auth-title">프로필 수정</h1>
        <p className="auth-description">
          사용자명과 프로필 이미지를 바꾸면 즉시 헤더와 프로필 페이지에 반영돼요.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="profile-edit-preview">
            <img
              className="profile-hero-avatar profile-hero-avatar-image"
              src={getProfileImageSrc(previewUrl)}
              alt={displayName}
              onError={handleProfileImageError}
            />

            <div className="profile-edit-preview-copy">
              <strong>{displayName}</strong>
              <span>{user.bio || '현재 bio는 읽기 전용이에요. 추후 수정 API가 연결되면 함께 열어둘게요.'}</span>
            </div>
          </div>

          <label className="auth-field">
            <span>사용자명</span>
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="새 사용자명을 입력하세요"
            />
          </label>

          <label className="auth-field">
            <span>프로필 이미지</span>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null
                setSelectedFile(file)
                if (file) {
                  setRemoveProfileImage(false)
                }
              }}
            />
          </label>

          <label className="consent-field">
            <input
              type="checkbox"
              checked={removeProfileImage}
              onChange={(event) => {
                const checked = event.target.checked
                setRemoveProfileImage(checked)

                if (checked) {
                  setSelectedFile(null)
                }
              }}
            />
            <span>현재 프로필 이미지를 삭제할게요.</span>
          </label>

          {error && <div className="feedback-card is-error">{error}</div>}

          <div className="profile-edit-actions">
            <button
              className="primary-button auth-submit"
              type="submit"
              disabled={isSubmitting || !hasChanges}
            >
              {isSubmitting ? '저장 중...' : '저장하기'}
            </button>
            <Link className="secondary-button profile-edit-cancel" to="/profile">
              취소
            </Link>
          </div>
        </form>
      </div>
    </section>
  )
}
