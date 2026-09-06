import { tr } from '../i18n'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorToast } from './ErrorToast'
import { useAuth } from '../contexts/AuthContext'
import {
  addToCollection,
  deleteCollectionEntry,
  estimateSmartRating,
  fetchMyCollectionEntry,
  fetchSmartRatingCandidates,
  getCachedCollectionEntry,
  updateCollectionEntry,
} from '../lib/collection'
import type {
  SmartRatingCandidate,
  SmartRatingEstimateResponse,
  SmartRatingRelation,
  UserAnimeStatus,
} from '../types/collection'
import '../styles/components/CollectionEditor.css'

const statusOptions: Array<{ value: UserAnimeStatus; label: string }> = [
  { value: 'planned', label: tr("볼 예정") },
  { value: 'watching', label: tr("보는 중") },
  { value: 'completed', label: tr("완료") },
  { value: 'paused', label: tr("잠시 멈춤") },
  { value: 'dropped', label: tr("중단") },
]

type CollectionEditorProps = {
  animeId: number
  maxProgress?: number | null
  targetAnime?: {
    title: string
    coverImageLarge: string
    coverImageExtraLarge?: string | null
  }
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

function getRelationLabel(relation: SmartRatingRelation) {
  if (relation === 'better') {
    return tr("새 작품이 더 재밌음")
  }

  if (relation === 'worse') {
    return tr("새 작품이 더 별로")
  }

  return tr("비슷함")
}

function getConfidenceLabel(confidence?: string) {
  if (confidence === 'high') {
    return tr("높음")
  }

  if (confidence === 'medium') {
    return tr("보통")
  }

  if (confidence === 'low') {
    return tr("낮음")
  }

  return confidence || tr("정보 없음")
}

type SmartRatingModalProps = {
  animeId: number
  targetAnime?: {
    title: string
    coverImageLarge: string
    coverImageExtraLarge?: string | null
  }
  onClose: () => void
  onApplyScore: (score: number) => Promise<void>
}

function SmartRatingModal({ animeId, targetAnime, onClose, onApplyScore }: SmartRatingModalProps) {
  const [candidates, setCandidates] = useState<SmartRatingCandidate[]>([])
  const [comparisons, setComparisons] = useState<Record<number, SmartRatingRelation>>({})
  const [activeCandidateIndex, setActiveCandidateIndex] = useState(0)
  const [estimate, setEstimate] = useState<SmartRatingEstimateResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEstimating, setIsEstimating] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    const loadCandidates = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetchSmartRatingCandidates({
          targetAnimeId: animeId,
          limit: 5,
          signal: controller.signal,
        })

        if (controller.signal.aborted) {
          return
        }

        setCandidates(response.items)
        setComparisons({})
        setActiveCandidateIndex(0)
        setEstimate(null)
      } catch (candidateError) {
        if (controller.signal.aborted) {
          return
        }

        setError(candidateError instanceof Error ? candidateError.message : tr("비교 후보를 불러오지 못했어요."))
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    void loadCandidates()

    return () => controller.abort()
  }, [animeId])

  const handleRelationSelect = (candidateAnimeId: number, relation: SmartRatingRelation) => {
    setComparisons((current) => ({
      ...current,
      [candidateAnimeId]: relation,
    }))
    setActiveCandidateIndex((current) => Math.min(current + 1, Math.max(0, candidates.length - 1)))
    setEstimate(null)
  }

  const selectedComparisons = candidates.flatMap((candidate) => {
    const relation = comparisons[candidate.animeId]

    return relation ? [{ animeId: candidate.animeId, relation }] : []
  })

  const canEstimate = selectedComparisons.length > 0 && !isEstimating
  const activeCandidate = candidates[activeCandidateIndex]

  const handleEstimate = async () => {
    if (!canEstimate) {
      return
    }

    setIsEstimating(true)
    setError(null)

    try {
      const response = await estimateSmartRating({
        targetAnimeId: animeId,
        comparisons: selectedComparisons,
      })
      setEstimate(response)
    } catch (estimateError) {
      setError(estimateError instanceof Error ? estimateError.message : tr("스마트 평점을 계산하지 못했어요."))
    } finally {
      setIsEstimating(false)
    }
  }

  const handleApply = async () => {
    if (!estimate || isApplying) {
      return
    }

    setIsApplying(true)
    setError(null)

    try {
      await onApplyScore(estimate.estimatedScore)
      onClose()
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : tr("추천 평점을 적용하지 못했어요."))
    } finally {
      setIsApplying(false)
    }
  }

  return (
    <div className="smart-rating-backdrop" role="presentation">
      <section className="smart-rating-modal" role="dialog" aria-modal="true" aria-labelledby="smart-rating-title">
        <div className="smart-rating-header">
          <div>
            <span className="detail-label">Smart rating</span>
            <h3 id="smart-rating-title">{tr("스마트 별점 매기기")}</h3>
            <p>{tr("기존에 평가한 작품과 비교하면 예상 별점을 계산해드려요.")}</p>
          </div>
          <button className="smart-rating-close" type="button" onClick={onClose} aria-label={tr("닫기")}>
            ×
          </button>
        </div>

        {isLoading && <div className="feedback-inline">{tr("비교 후보를 불러오는 중이에요.")}</div>}
        <ErrorToast message={error} />

        {!isLoading && activeCandidate && (
          <div className="smart-rating-candidate-list">
            <article className="smart-rating-comparison" key={activeCandidate.animeId}>
              <div className="smart-rating-target-card">
                {targetAnime?.coverImageExtraLarge || targetAnime?.coverImageLarge ? (
                  <img
                    src={targetAnime.coverImageExtraLarge || targetAnime.coverImageLarge}
                    alt={targetAnime.title}
                    loading="lazy"
                  />
                ) : (
                  <div className="smart-rating-candidate-cover" aria-hidden="true" />
                )}
                <div className="smart-rating-candidate-copy">
                  <span>{tr("새로 평가할 작품")}</span>
                  <strong>{targetAnime?.title ?? tr("현재 작품")}</strong>
                </div>
              </div>
              <div className="smart-rating-candidate">
                {activeCandidate.anime.coverImageExtraLarge || activeCandidate.anime.coverImageLarge ? (
                  <img
                    src={activeCandidate.anime.coverImageExtraLarge || activeCandidate.anime.coverImageLarge || ''}
                    alt={activeCandidate.anime.title}
                    loading="lazy"
                  />
                ) : (
                  <div className="smart-rating-candidate-cover" aria-hidden="true" />
                )}
                <div className="smart-rating-candidate-copy">
                  <span>{tr("비교 대상 · 내 평점")} {activeCandidate.score.toFixed(1)}{tr("점")}</span>
                  <strong>{activeCandidate.anime.title}</strong>
                </div>
              </div>
              <div className="smart-rating-choice-panel">
                <span>
                  {activeCandidateIndex + 1} / {candidates.length}
                </span>
                <div className="smart-rating-choice-group" aria-label={tr("{{v0}} 비교", { v0: activeCandidate.anime.title })}>
                  {(['better', 'similar', 'worse'] as SmartRatingRelation[]).map((relation) => (
                    <button
                      className={comparisons[activeCandidate.animeId] === relation ? 'smart-rating-choice is-active' : 'smart-rating-choice'}
                      key={`${activeCandidate.animeId}-${relation}`}
                      type="button"
                      onClick={() => handleRelationSelect(activeCandidate.animeId, relation)}
                    >
                      {getRelationLabel(relation)}
                    </button>
                  ))}
                </div>
              </div>
            </article>
          </div>
        )}

        {!isLoading && !error && candidates.length === 0 && (
          <div className="feedback-inline">{tr("비교할 수 있는 평점 기록이 아직 없어요.")}</div>
        )}

        {estimate && (
          <div className="smart-rating-result">
            <span>{tr("추천 평점")}</span>
            <strong>{estimate.estimatedScore.toFixed(1)}{tr("점")}</strong>
            <p>{estimate.reason}</p>
            <small>
              {tr("신뢰도")} {getConfidenceLabel(estimate.confidence)} {tr("· 예상 범위")} {estimate.range.min}~{estimate.range.max}{tr("점")}
            </small>
          </div>
        )}

        <div className="smart-rating-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              void handleEstimate()
            }}
            disabled={!canEstimate}
          >
            {isEstimating ? tr("계산 중...") : tr("추천 평점 계산")}
          </button>
          <button
            className="primary-button"
            type="button"
            onClick={() => {
              void handleApply()
            }}
            disabled={!estimate || isApplying}
          >
            {isApplying ? tr("적용 중...") : tr("추천 평점 적용")}
          </button>
        </div>
      </section>
    </div>
  )
}

export function CollectionEditor({ animeId, maxProgress, targetAnime }: CollectionEditorProps) {
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
  const [actionError, setActionError] = useState<string | null>(null)
  const [isAdded, setIsAdded] = useState(Boolean(cached))
  const [isLoadingEntry, setIsLoadingEntry] = useState(false)
  const [isSmartRatingOpen, setIsSmartRatingOpen] = useState(false)

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

        setActionError(error instanceof Error ? error.message : tr("내 기록을 불러오지 못했어요."))
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

  const saveScore = async (nextScore: number) => {
    if (isSubmitting || isLoadingEntry) {
      return
    }

    setIsSubmitting(true)
    setFeedback(null)
    setActionError(null)

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
      setFeedback(tr("{{v0}}점으로 저장했어요.", { v0: nextScore.toFixed(1) }))
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : tr("별점을 저장하지 못했어요.")
      setActionError(message)
      throw new Error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleScoreSelect = async (nextScore: number, event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()

    try {
      await saveScore(nextScore)
    } catch {
      // saveScore already exposes the friendly error through the global toast.
    }
  }

  const handleSave = async () => {
    setIsSubmitting(true)
    setFeedback(null)
    setActionError(null)

    try {
      if (isAdded) {
        await updateCollectionEntry(animeId, payload)
        setFeedback(tr("컬렉션 정보를 업데이트했어요."))
      } else {
        await addToCollection({
          animeId,
          ...payload,
        })
        setIsAdded(true)
        setFeedback(tr("컬렉션에 추가했어요."))
      }
    } catch (submitError) {
      setActionError(
        submitError instanceof Error
          ? submitError.message
          : tr("컬렉션 저장에 실패했어요."),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    setIsSubmitting(true)
    setFeedback(null)
    setActionError(null)

    try {
      await deleteCollectionEntry(animeId)
      setIsAdded(false)
      setStatus('completed')
      setScore(0)
      setProgress(defaultCompletedProgress)
      setStartedAt('')
      setCompletedAt('')
      setNotes('')
      setFeedback(tr("컬렉션에서 삭제했어요."))
    } catch (submitError) {
      setActionError(
        submitError instanceof Error
          ? submitError.message
          : tr("컬렉션 삭제에 실패했어요."),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <section className="detail-section collection-panel">
        <span className="detail-label">My collection</span>
        <h3>{tr("로그인 후 내 컬렉션에 추가할 수 있어요")}</h3>
        <p className="collection-helper">
          {tr("감상 상태, 진행도, 별점, 메모를 남기려면 먼저 로그인해주세요.")}
        </p>
        <Link className="primary-button collection-login-button" to="/login">
          {tr("로그인하러 가기")}
        </Link>
      </section>
    )
  }

  return (
    <section className="detail-section collection-panel">
      <span className="detail-label">My collection</span>
      <h3>{isAdded ? tr("내 컬렉션에서 관리 중") : tr("내 컬렉션에 추가")}</h3>
      <p className="collection-helper">
        {tr("상태, 진행도, 별점, 메모를 직접 남기고 내 기록을 한눈에 확인할 수 있어요.")}
      </p>

      {isLoadingEntry && <div className="feedback-inline">{tr("내 기록을 불러오는 중이에요.")}</div>}

      <div className="detail-rating-control" aria-label={tr("내 별점 수정")}>
        <div className="detail-rating-heading">
          <span className="detail-rating-label">{tr("내 별점")}</span>
          <button
            className="smart-rating-open-button"
            type="button"
            onClick={() => setIsSmartRatingOpen(true)}
            disabled={isSubmitting || isLoadingEntry}
          >
            {tr("스마트 별점 매기기")}
          </button>
        </div>
        <div className="detail-rating-main">
          <div className="detail-rating-stars" role="radiogroup" aria-label={tr("별점 선택")}>
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
                    aria-label={tr("{{v0}}점 주기", { v0: leftValue.toFixed(1) })}
                    onClick={(event) => {
                      void handleScoreSelect(leftValue, event)
                    }}
                    disabled={isSubmitting || isLoadingEntry}
                  />
                  <button
                    className="detail-rating-star-hit is-right"
                    type="button"
                    aria-label={tr("{{v0}}점 주기", { v0: rightValue.toFixed(1) })}
                    onClick={(event) => {
                      void handleScoreSelect(rightValue, event)
                    }}
                    disabled={isSubmitting || isLoadingEntry}
                  />
                </div>
              )
            })}
          </div>
          <strong className="detail-rating-value">{score > 0 ? tr("{{v0}}점", { v0: score.toFixed(1) }) : tr("미평점")}</strong>
        </div>
      </div>

      {isSmartRatingOpen && (
        <SmartRatingModal
          animeId={animeId}
          targetAnime={targetAnime}
          onClose={() => setIsSmartRatingOpen(false)}
          onApplyScore={saveScore}
        />
      )}

      <div className="collection-form-grid">
        <label className="auth-field">
          <span>{tr("상태")}</span>
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
          <span>{tr("진행도")}</span>
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
          <span>{tr("시작일")}</span>
          <input type="date" value={startedAt} onChange={(event) => setStartedAt(event.target.value)} />
        </label>

        <label className="auth-field">
          <span>{tr("완료일")}</span>
          <input
            type="date"
            value={completedAt}
            onChange={(event) => setCompletedAt(event.target.value)}
          />
        </label>
      </div>

      <label className="auth-field">
        <span>{tr("메모")}</span>
        <textarea
          rows={4}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder={tr("감상 메모를 남겨보세요. 비워둬도 괜찮아요.")}
        />
      </label>

      {feedback && <div className="feedback-card">{feedback}</div>}
      <ErrorToast message={actionError} />

      <div className="collection-actions">
        <button
          className="primary-button auth-submit"
          type="button"
          onClick={() => {
            void handleSave()
          }}
          disabled={isSubmitting || isLoadingEntry}
        >
          {isSubmitting ? tr("저장 중...") : isAdded ? tr("컬렉션 업데이트") : tr("컬렉션에 추가")}
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
            {tr("컬렉션에서 삭제")}
          </button>
        )}
      </div>
    </section>
  )
}
