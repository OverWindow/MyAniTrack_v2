import { useEffect, useMemo, useState } from 'react'
import {
  fetchCatalogImageSyncStatus,
  pauseCatalogImageSync,
  resumeCatalogImageSync,
  retryFailedCatalogImageSync,
  startCatalogImageSync,
} from '../lib/admin'
import type { CatalogImageSyncJobStatus, CatalogImageSyncSnapshot } from '../types/admin'

const ACTIVE_STATUSES = new Set<CatalogImageSyncJobStatus>(['queued', 'running'])
const STATUS_LABELS: Record<CatalogImageSyncJobStatus, string> = {
  queued: '대기 중',
  running: '실행 중',
  paused: '일시정지',
  completed: '완료',
  completed_with_errors: '오류 포함 완료',
  failed: '작업 실패',
  cancelled: '전환으로 종료',
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('ko-KR').format(value)
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(date)
}

export function AdminCatalogImageSyncManager() {
  const [snapshot, setSnapshot] = useState<CatalogImageSyncSnapshot | null>(null)
  const [activeRequest, setActiveRequest] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let disposed = false
    let controller: AbortController | null = null

    const poll = async () => {
      controller = new AbortController()

      try {
        const next = await fetchCatalogImageSyncStatus(controller.signal)
        if (disposed) return
        setSnapshot(next)
        setError(null)

      } catch (requestError) {
        if (disposed || controller.signal.aborted) return
        setError(requestError instanceof Error ? requestError.message : '이미지 동기화 상태를 불러오지 못했어요.')
      }
    }

    void poll()
    const intervalId = window.setInterval(() => { void poll() }, 2500)

    return () => {
      disposed = true
      controller?.abort()
      window.clearInterval(intervalId)
    }
  }, [])

  const job = snapshot?.job ?? null
  const isActive = Boolean(job && ACTIVE_STATUSES.has(job.status))
  const progress = useMemo(() => {
    if (!job || job.totalAssets === 0) return 0
    return Math.min(100, Math.round((job.processedAssets / job.totalAssets) * 1000) / 10)
  }, [job])

  const run = async (key: string, request: () => Promise<CatalogImageSyncSnapshot>) => {
    setActiveRequest(key)
    setError(null)

    try {
      setSnapshot(await request())
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '이미지 동기화 요청에 실패했어요.')
    } finally {
      setActiveRequest(null)
    }
  }

  const refreshAll = () => {
    const confirmed = window.confirm(
      '성공한 이미지까지 모두 다시 다운로드하고 S3 객체를 교체합니다. 계속할까요?',
    )

    if (confirmed) {
      void run('refresh', () => startCatalogImageSync('refresh'))
    }
  }

  return (
    <section className="admin-action-card admin-image-sync-card">
      <div className="admin-action-copy">
        <span className="detail-label">AWS S3 + CloudFront</span>
        <h3>이미지 에셋 동기화</h3>
        <p>카탈로그·프로필·배지 이미지를 S3로 복사하고 CloudFront로 제공합니다. 작업은 브라우저를 닫아도 서버에서 계속됩니다.</p>
      </div>

      {error && <div className="feedback-card is-error" role="alert">{error}</div>}

      <div className="admin-image-sync-summary">
        <div><span>전체 큐</span><strong>{formatNumber(snapshot?.queue.total ?? 0)}</strong></div>
        <div><span>S3 저장 완료</span><strong>{formatNumber(snapshot?.queue.succeeded ?? 0)}</strong></div>
        <div><span>대기</span><strong>{formatNumber(snapshot?.queue.pending ?? 0)}</strong></div>
        <div><span>실패</span><strong>{formatNumber(snapshot?.queue.failed ?? 0)}</strong></div>
      </div>

      {job ? (
        <div className="admin-image-job-panel">
          <div className="admin-image-job-heading">
            <div>
              <span className="detail-label">최근 작업 #{job.id}</span>
              <h4>{STATUS_LABELS[job.status]}</h4>
            </div>
            <strong>{progress}%</strong>
          </div>
          <div className="admin-image-progress" aria-label={`이미지 동기화 진행률 ${progress}%`}>
            <span style={{ width: `${progress}%` }} />
          </div>
          <div className="admin-image-job-stats">
            <span>처리 {formatNumber(job.processedAssets)} / {formatNumber(job.totalAssets)}</span>
            <span>성공 {formatNumber(job.succeededAssets)}</span>
            <span>실패 {formatNumber(job.failedAssets)}</span>
            <span>시작 {formatDate(job.startedAt)}</span>
          </div>
          {job.currentAsset && (
            <p className="admin-image-current">
              처리 중: {job.currentAsset.entityType} · {job.currentAsset.entityType === 'anime' || job.currentAsset.entityType === 'character' || job.currentAsset.entityType === 'voice_actor' ? `AniList ${job.currentAsset.anilistId}` : `ID ${job.currentAsset.entityId}`} · {job.currentAsset.variant}
            </p>
          )}
          {job.lastError && <p className="admin-image-current is-error">작업 오류: {job.lastError}</p>}
        </div>
      ) : (
        <div className="feedback-card">아직 실행된 이미지 동기화 작업이 없습니다.</div>
      )}

      <div className="admin-image-sync-actions">
        <button
          className="primary-button"
          type="button"
          disabled={isActive || job?.status === 'paused' || activeRequest !== null}
          onClick={() => { void run('start', () => startCatalogImageSync('pending')) }}
        >
          {activeRequest === 'start' ? '시작 중...' : '미처리 이미지 동기화'}
        </button>
        {job && isActive && (
          <button
            className="secondary-button"
            type="button"
            disabled={activeRequest !== null}
            onClick={() => { void run('pause', () => pauseCatalogImageSync(job.id)) }}
          >
            {activeRequest === 'pause' ? '요청 중...' : '일시정지'}
          </button>
        )}
        {job?.status === 'paused' && (
          <button
            className="primary-button"
            type="button"
            disabled={activeRequest !== null}
            onClick={() => { void run('resume', () => resumeCatalogImageSync(job.id)) }}
          >
            {activeRequest === 'resume' ? '재개 중...' : '재개'}
          </button>
        )}
        {job && job.failedAssets > 0 && !isActive && job.status !== 'paused' && (
          <button
            className="secondary-button"
            type="button"
            disabled={activeRequest !== null}
            onClick={() => { void run('retry', () => retryFailedCatalogImageSync(job.id)) }}
          >
            {activeRequest === 'retry' ? '재시도 중...' : '실패 항목 재시도'}
          </button>
        )}
        <button
          className="secondary-button"
          type="button"
          disabled={isActive || job?.status === 'paused' || activeRequest !== null}
          onClick={refreshAll}
        >
          {activeRequest === 'refresh' ? '새로고침 시작 중...' : '전체 이미지 새로고침'}
        </button>
      </div>

      {snapshot && snapshot.recentFailures.length > 0 && (
        <details className="admin-image-failures">
          <summary>최근 실패 {snapshot.recentFailures.length}건 보기</summary>
          <ul>
            {snapshot.recentFailures.map((failure) => (
              <li key={failure.id}>
                <strong>{failure.entityType} · {failure.entityType === 'anime' || failure.entityType === 'character' || failure.entityType === 'voice_actor' ? `AniList ${failure.anilistId}` : `ID ${failure.entityId}`} · {failure.variant}</strong>
                <span>{failure.lastError ?? '알 수 없는 오류'}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
