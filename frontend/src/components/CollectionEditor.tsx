import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  addToCollection,
  deleteCollectionEntry,
  fetchMyCollectionEntry,
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

function getInitialScore(score?: number | string | null) {
  const numericScore = typeof score === 'number'
    ? score
    : typeof score === 'string'
      ? Number(score)
      : NaN

  if (!Number.isFinite(numericScore) || numericScore <= 0) {
    return 0
  }

  return Math.min(10, Math.max(0, numericScore))
}

function getStarFillPercent(score: number, starIndex: number) {
  const scoreInStars = score / 2
  const fill = Math.max(0, Math.min(1, scoreInStars - starIndex))
  return `${fill * 100}%`
}

export function CollectionEditor({ animeId, maxProgress }: CollectionEditorProps) {
  const { isAuthenticated } = useAuth()
  const cached = getCachedCollectionEntry(animeId)
  const totalProgress = maxProgress && maxProgress > 0 ? maxProgress : null
  const defaultCompletedProgress = totalProgress ?? 0
  const [status, setStatus] = useState<UserAnimeStatus>(cached?.status ?? 'completed')
  const [score, setScore] = useState<number>(getInitialScore(cached?.score))
  const [progress, setProgress] = useState<number>(cached?.progress ?? defaultCompletedProgress)
  const [startedAt, setStartedAt] = useState(cached?.startedAt ?? '')
  const [completedAt, setCompletedAt] = useState(cached?.completedAt ?? '')
  const [notes, setNotes] = useState(cached?.notes ?? '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isAdded, setIsAdded] = useState(Boolean(cached))
  const [isLoadingEntry, setIsLoadingEntry] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) {
      return
    }

    const controller = new AbortController()

    const loadEntry = async () => {
      setIsLoadingEntry(true)

      try {
        const item = await fetchMyCollectionEntry(animeId, controller.signal)

        if (controller.signal.aborted) {
          return
        }

        if (!item) {
          setStatus('completed')
          setScore(0)
          setProgress(defaultCompletedProgress)
          setStartedAt('')
          setCompletedAt('')
          setNotes('')
          setIsAdded(false)
          return
        }

        setStatus(item.status)
        setScore(getInitialScore(item.score))
        setProgress(item.progress ?? defaultCompletedProgress)
        setStartedAt(item.startedAt ?? '')
        setCompletedAt(item.completedAt ?? '')
        setNotes(item.notes ?? '')
        setIsAdded(true)
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        setFeedback(error instanceof Error ? error.message : '내 기록을 불러오지 못했어요.')
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingEntry(false)
        }
      }
    }

    void loadEntry()

    return () => controller.abort()
  }, [animeId, defaultCompletedProgress, isAuthenticated])

  const payload = {
    status,
    ...(score > 0 ? { score } : {}),
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

  const handleScoreSelect = async (nextScore: number, event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()

    if (isSubmitting || isLoadingEntry) {
      return
    }

    setIsSubmitting(true)
    setFeedback(null)

    try {
      const nextStatus = isAdded ? status : 'completed'
      const nextProgress = totalProgress ?? progress

      if (isAdded) {
        await updateCollectionEntry(animeId, {
          status: nextStatus,
          score: nextScore,
          ...(nextProgress > 0 || nextStatus === 'completed' ? { progress: nextProgress } : {}),
        })
      } else {
        await addToCollection({
          animeId,
          status: nextStatus,
          score: nextScore,
          ...(nextProgress > 0 || nextStatus === 'completed' ? { progress: nextProgress } : {}),
        })
        setIsAdded(true)
      }

      setStatus(nextStatus)
      setScore(nextScore)
      setProgress(nextProgress)
      setFeedback(`${nextScore.toFixed(1)}점으로 저장했어요.`)
    } catch (submitError) {
      setFeedback(
        submitError instanceof Error
          ? submitError.message
          : '별점을 저장하지 못했어요.',
      )
    } finally {
      setIsSubmitting(false)
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
      setStatus('completed')
      setScore(0)
      setProgress(defaultCompletedProgress)
      setStartedAt('')
      setCompletedAt('')
      setNotes('')
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
        상태, 진행도, 별점, 메모를 직접 남기고 내 기록을 한눈에 확인할 수 있어요.
      </p>

      {isLoadingEntry && <div className="feedback-inline">내 기록을 불러오는 중이에요.</div>}

      <div className="detail-rating-control" aria-label="내 별점 수정">
        <span className="detail-rating-label">내 별점</span>
        <div className="detail-rating-stars" role="radiogroup" aria-label="별점 선택">
          {Array.from({ length: 5 }).map((_, index) => {
            const leftValue = index * 2 + 1
            const rightValue = index * 2 + 2

            return (
              <div className="detail-rating-star" key={`${animeId}-detail-star-${index + 1}`}>
                <span className="detail-rating-star-base" aria-hidden="true">★</span>
                <span
                  className="detail-rating-star-fill"
                  aria-hidden="true"
                  style={{ width: getStarFillPercent(score, index) }}
                >
                  ★
                </span>
                <button
                  className="detail-rating-star-hit is-left"
                  type="button"
                  aria-label={`${leftValue.toFixed(1)}점 주기`}
                  onClick={(event) => {
                    void handleScoreSelect(leftValue, event)
                  }}
                  disabled={isSubmitting || isLoadingEntry}
                />
                <button
                  className="detail-rating-star-hit is-right"
                  type="button"
                  aria-label={`${rightValue.toFixed(1)}점 주기`}
                  onClick={(event) => {
                    void handleScoreSelect(rightValue, event)
                  }}
                  disabled={isSubmitting || isLoadingEntry}
                />
              </div>
            )
          })}
        </div>
      </div>

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
          disabled={isSubmitting || isLoadingEntry}
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
            disabled={isSubmitting || isLoadingEntry}
          >
            컬렉션에서 삭제
          </button>
        )}
      </div>
    </section>
  )
}
