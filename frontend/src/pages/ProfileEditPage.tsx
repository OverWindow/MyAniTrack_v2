import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getProfileImageSrc, handleProfileImageError } from '../lib/avatar'
import { checkUsernameAvailability } from '../lib/auth'
import '../styles/pages/AuthPage.css'
import '../styles/pages/ProfilePage.css'

type UsernameCheckState = {
  checkedUsername: string | null
  isAvailable: boolean | null
  message: string | null
}

export function ProfileEditPage() {
  const { isAuthenticated, user, updateMyProfile } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState(user?.username ?? '')
  const [bio, setBio] = useState(user?.bio ?? '')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [removeProfileImage, setRemoveProfileImage] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCheckingUsername, setIsCheckingUsername] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [usernameCheck, setUsernameCheck] = useState<UsernameCheckState>({
    checkedUsername: null,
    isAvailable: null,
    message: null,
  })

  const previewUrl = useMemo(() => {
    if (selectedFile) {
      return URL.createObjectURL(selectedFile)
    }

    if (!removeProfileImage) {
      return user?.profileImageUrl ?? null
    }

    return null
  }, [removeProfileImage, selectedFile, user?.profileImageUrl])

  const normalizedUsername = username.trim()
  const normalizedBio = bio.trim()
  const currentUsername = user?.username ?? ''
  const currentBio = (user?.bio ?? '').trim()
  const isUsernameChanged = normalizedUsername !== currentUsername
  const isBioChanged = normalizedBio !== currentBio
  const isUsernameVerified = useMemo(
    () =>
      !isUsernameChanged ||
      (usernameCheck.isAvailable === true && usernameCheck.checkedUsername === normalizedUsername),
    [isUsernameChanged, normalizedUsername, usernameCheck.checkedUsername, usernameCheck.isAvailable],
  )
  const displayName = normalizedUsername || user?.username || 'MyAniTrack User'
  const displayBio = normalizedBio || '좋아하는 장르와 감상 스타일을 소개해보세요.'
  const hasChanges =
    isUsernameChanged || isBioChanged || Boolean(selectedFile) || removeProfileImage

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

  const handleUsernameChange = (value: string) => {
    setUsername(value)
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

    if (!isUsernameChanged) {
      setUsernameCheck({
        checkedUsername: normalizedUsername,
        isAvailable: true,
        message: '현재 사용 중인 닉네임이에요.',
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

    if (!isUsernameVerified) {
      setError('닉네임 중복 확인을 완료해주세요.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await updateMyProfile({
        username: normalizedUsername || undefined,
        bio: isBioChanged ? normalizedBio : undefined,
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
        <h1 className="auth-title">프로필 수정</h1>
        <p className="auth-description">
          사용자명, bio, 프로필 이미지를 바꾸면 즉시 헤더와 프로필 페이지에 반영돼요.
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
              <span>{displayBio}</span>
            </div>
          </div>

          <div className="auth-field">
            <span>사용자명</span>
            <div className="auth-inline-field">
              <input
                type="text"
                value={username}
                onChange={(event) => handleUsernameChange(event.target.value)}
                placeholder="새 사용자명을 입력하세요"
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
            {isUsernameChanged && !isUsernameVerified && !usernameCheck.message && (
              <p className="auth-field-hint">저장 전에 닉네임 중복 확인을 완료해주세요.</p>
            )}
          </div>

          <label className="auth-field" htmlFor="profile-bio">
            <span>bio</span>
            <textarea
              id="profile-bio"
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              placeholder="좋아하는 장르나 감상 스타일을 적어보세요."
              maxLength={160}
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
              disabled={isSubmitting || isCheckingUsername || !hasChanges || !isUsernameVerified}
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
