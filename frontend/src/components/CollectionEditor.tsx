import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  addToCollection,
  deleteCollectionEntry,
  getCachedCollectionEntry,
  updateCollectionEntry,
} from '../lib/collection'
import type { UserAnimeStatus } from '../types/collection'
import '../styles/components/CollectionEditor.css'

const statusOptions: Array<{ value: UserAnimeStatus; label: string }> = [
  { value: 'planned', label: '볼 예정' },
  { value: 'watching', label: '보는 중' },
  { value: 'completed', label: '완료' },
  { value: 'paused', label: '잠시 멈춤' },
  { value: 'dropped', label: '중단' },
]

type CollectionEditorProps = {
  animeId: number
  maxProgress?: number | null
}

export function CollectionEditor({ animeId, maxProgress }: CollectionEditorProps) {
  const { isAuthenticated } = useAuth()
  const cached = getCachedCollectionEntry(animeId)
  const totalProgress = maxProgress && maxProgress > 0 ? maxProgress : null
  const defaultCompletedProgress = totalProgress ?? 0
  const [status, setStatus] = useState<UserAnimeStatus>(cached?.status ?? 'completed')
  const [score, setScore] = useState<number>(cached?.score ? Math.round(cached.score / 2) : 0)
  const [progress, setProgress] = useState<number>(cached?.progress ?? defaultCompletedProgress)
  const [startedAt, setStartedAt] = useState(cached?.startedAt ?? '')
  const [completedAt, setCompletedAt] = useState(cached?.completedAt ?? '')
  const [notes, setNotes] = useState(cached?.notes ?? '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isAdded, setIsAdded] = useState(Boolean(cached))

  const payload = {
    status,
    ...(score > 0 ? { score: score * 2 } : {}),
    ...((progress > 0 || status === 'completed') ? { progress } : {}),
    ...(startedAt ? { startedAt } : {}),
    ...(completedAt ? { completedAt } : {}),
    ...(notes.trim() ? { notes: notes.trim() } : {}),
  }

  const handleStatusChange = (nextStatus: UserAnimeStatus) => {
    setStatus(nextStatus)

    if (nextStatus === 'completed' && totalProgress) {
      setProgress(totalProgress)
    }
  }

  const handleSave = async () => {
    setIsSubmitting(true)
    setFeedback(null)

    try {
      if (isAdded) {
        await updateCollectionEntry(animeId, payload)
        setFeedback('컬렉션 정보를 업데이트했어요.')
      } else {
        await addToCollection({
          animeId,
          ...payload,
        })
        setIsAdded(true)
        setFeedback('컬렉션에 추가했어요.')
      }
    } catch (submitError) {
      setFeedback(
        submitError instanceof Error
          ? submitError.message
          : '컬렉션 저장에 실패했어요.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    setIsSubmitting(true)
    setFeedback(null)

    try {
      await deleteCollectionEntry(animeId)
      setIsAdded(false)
      setFeedback('컬렉션에서 삭제했어요.')
    } catch (submitError) {
      setFeedback(
        submitError instanceof Error
          ? submitError.message
          : '컬렉션 삭제에 실패했어요.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <section className="detail-section collection-panel">
        <span className="detail-label">My collection</span>
        <h3>로그인 후 내 컬렉션에 추가할 수 있어요</h3>
        <p className="collection-helper">
          감상 상태, 진행도, 별점, 메모를 남기려면 먼저 로그인해주세요.
        </p>
        <Link className="primary-button collection-login-button" to="/login">
          로그인하러 가기
        </Link>
      </section>
    )
  }

  return (
    <section className="detail-section collection-panel">
      <span className="detail-label">My collection</span>
      <h3>{isAdded ? '내 컬렉션에서 관리 중' : '내 컬렉션에 추가'}</h3>
      <p className="collection-helper">
        상태만 고르고 바로 추가할 수 있고, 별점이나 메모는 원할 때만 입력하면 돼요.
      </p>

      <div className="collection-form-grid">
        <label className="auth-field">
          <span>상태</span>
          <select
            value={status}
            onChange={(event) => handleStatusChange(event.target.value as UserAnimeStatus)}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="auth-field">
          <span>별점</span>
          <div className="star-rating" role="radiogroup" aria-label="별점 선택">
            {Array.from({ length: 5 }).map((_, index) => {
              const starValue = index + 1

              return (
                <button
                  key={starValue}
                  className={score >= starValue ? 'star-button is-active' : 'star-button'}
                  type="button"
                  aria-label={`${starValue}점`}
                  aria-pressed={score === starValue}
                  onClick={() => setScore(starValue)}
                >
                  ★
                </button>
              )
            })}
            <button
              className="star-reset-button"
              type="button"
              onClick={() => setScore(0)}
            >
              초기화
            </button>
          </div>
        </div>

        <label className="auth-field collection-slider-field">
          <span>진행도</span>
          <div className="collection-slider-row">
            <input
              className="collection-slider"
              type="range"
              min="0"
              max={totalProgress ?? 100}
              step="1"
              value={progress}
              onChange={(event) => setProgress(Number(event.target.value))}
            />
            <strong>
              {progress}
              {totalProgress ? ` / ${totalProgress}` : ''}
            </strong>
          </div>
        </label>

        <label className="auth-field">
          <span>시작일</span>
          <input type="date" value={startedAt} onChange={(event) => setStartedAt(event.target.value)} />
        </label>

        <label className="auth-field">
          <span>완료일</span>
          <input
            type="date"
            value={completedAt}
            onChange={(event) => setCompletedAt(event.target.value)}
          />
        </label>
      </div>

      <label className="auth-field">
        <span>메모</span>
        <textarea
          rows={4}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="감상 메모를 남겨보세요. 비워둬도 괜찮아요."
        />
      </label>

      {feedback && <div className="feedback-card">{feedback}</div>}

      <div className="collection-actions">
        <button
          className="primary-button auth-submit"
          type="button"
          onClick={() => {
            void handleSave()
          }}
          disabled={isSubmitting}
        >
          {isSubmitting ? '저장 중...' : isAdded ? '컬렉션 업데이트' : '컬렉션에 추가'}
        </button>

        {isAdded && (
          <button
            className="secondary-button auth-submit"
            type="button"
            onClick={() => {
              void handleDelete()
            }}
            disabled={isSubmitting}
          >
            컬렉션에서 삭제
          </button>
        )}
      </div>
    </section>
  )
}
