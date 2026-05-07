import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  fetchPlatformStats,
  syncAllAnimePages,
  syncAnimeChunked,
  syncAnimePage,
  syncAnimeSeason,
  translateKoreanTitles,
} from '../lib/admin'
import type {
  AdminActionResponse,
  AdminSeason,
  AdminSyncAllPayload,
  AdminSyncChunkedPayload,
  AdminSyncPagePayload,
  AdminSyncSeasonPayload,
  AdminTranslateKoreanTitlesPayload,
  PlatformStats,
} from '../types/admin'
import '../styles/pages/AdminPage.css'

type AdminActionCardProps<TPayload> = {
  title: string
  description: string
  fields: Array<{
    key: keyof TPayload
    label: string
    type?: 'number' | 'text' | 'select'
    options?: string[]
  }>
  values: TPayload
  isRunning: boolean
  onChange: <K extends keyof TPayload>(key: K, value: TPayload[K]) => void
  onSubmit: () => void
  response: AdminActionResponse | null
}

type AdminActionKey =
  | 'sync-page'
  | 'sync-all'
  | 'sync-chunked'
  | 'sync-season'
  | 'translate-korean'

const mockQueues = [
  { title: '최근 동기화 작업', body: '2026-05-05 14:20 기준 SPRING 2025 시즌 동기화가 마지막으로 실행됐습니다.' },
  { title: '주의 필요 항목', body: '번역 배치가 증가할 수 있으니 배치 크기와 maxBatches를 보수적으로 조정하는 것을 권장합니다.' },
  { title: '확장 포인트', body: '향후 유저 관리, 신고 처리, 큐 모니터링, 로그 뷰어 카드가 이 영역에 추가될 수 있습니다.' },
]

const seasonOptions: AdminSeason[] = ['WINTER', 'SPRING', 'SUMMER', 'FALL']
const RESPONSE_PREVIEW_LENGTH = 360

function formatNumber(value: number) {
  return new Intl.NumberFormat('ko-KR').format(value)
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`
}

function AdminResponsePreview({ response }: { response: AdminActionResponse }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const formatted = useMemo(() => JSON.stringify(response.result, null, 2), [response.result])
  const isLong = formatted.length > RESPONSE_PREVIEW_LENGTH
  const preview = isLong && !isExpanded
    ? `${formatted.slice(0, RESPONSE_PREVIEW_LENGTH)}...`
    : formatted

  return (
    <div className="admin-response-card">
      <strong>{response.message}</strong>
      <pre>{preview}</pre>
      {isLong && (
        <button className="admin-response-toggle" type="button" onClick={() => setIsExpanded((current) => !current)}>
          {isExpanded ? '접기' : '더보기'}
        </button>
      )}
    </div>
  )
}

function AdminActionCard<TPayload extends Record<string, string | number>>({
  title,
  description,
  fields,
  values,
  isRunning,
  onChange,
  onSubmit,
  response,
}: AdminActionCardProps<TPayload>) {
  return (
    <section className="admin-action-card">
      <div className="admin-action-copy">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>

      <div className="admin-form-grid">
        {fields.map((field) => {
          const rawValue = values[field.key]
          const value = typeof rawValue === 'number' ? String(rawValue) : rawValue

          return (
            <label className="auth-field" key={String(field.key)}>
              <span>{field.label}</span>
              {field.type === 'select' ? (
                <select
                  value={value}
                  onChange={(event) => onChange(field.key, event.target.value as TPayload[keyof TPayload])}
                >
                  {field.options?.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type ?? 'number'}
                  value={value}
                  onChange={(event) => {
                    const nextValue = field.type === 'number' || !field.type
                      ? Number(event.target.value)
                      : event.target.value
                    onChange(field.key, nextValue as TPayload[keyof TPayload])
                  }}
                />
              )}
            </label>
          )
        })}
      </div>

      <div className="admin-action-footer">
        <button className="primary-button auth-submit" type="button" onClick={onSubmit} disabled={isRunning}>
          {isRunning ? '실행 중...' : '실행하기'}
        </button>
        {response && <AdminResponsePreview response={response} />}
      </div>
    </section>
  )
}

export function AdminPage() {
  const { isAuthenticated, user } = useAuth()
  const isAdmin = user?.isAdmin || user?.role === 'ADMIN'

  const [syncPageValues, setSyncPageValues] = useState<AdminSyncPagePayload>({
    page: 1,
    perPage: 50,
  })
  const [syncAllValues, setSyncAllValues] = useState<AdminSyncAllPayload>({
    startPage: 1,
    perPage: 50,
    maxPages: 10,
  })
  const [chunkedValues, setChunkedValues] = useState<AdminSyncChunkedPayload>({
    startPage: 1,
    perPage: 50,
    pagesPerChunk: 10,
    chunkDelayMs: 10000,
    maxChunks: 5,
  })
  const [seasonValues, setSeasonValues] = useState<AdminSyncSeasonPayload>({
    season: 'SPRING',
    seasonYear: 2025,
    startPage: 1,
    perPage: 50,
    maxPages: 5,
  })
  const [translateValues, setTranslateValues] = useState<AdminTranslateKoreanTitlesPayload>({
    batchSize: 100,
    maxBatches: 1,
  })

  const [selectedAction, setSelectedAction] = useState<AdminActionKey>('sync-page')
  const [activeAction, setActiveAction] = useState<string | null>(null)
  const [responseMap, setResponseMap] = useState<Record<string, AdminActionResponse | null>>({})
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null)
  const [isLoadingPlatformStats, setIsLoadingPlatformStats] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const greeting = useMemo(() => {
    const name = user?.username?.trim() || user?.email?.split('@')[0] || 'Admin'
    return `${name} 관리자`
  }, [user?.email, user?.username])

  const summaryCards = useMemo(() => {
    if (!platformStats) {
      return [
        { label: '등록 유저', value: '-', hint: '플랫폼 통계 불러오기 전' },
        { label: '저장된 애니', value: '-', hint: '플랫폼 통계 불러오기 전' },
        { label: '번역 진행률', value: '-', hint: '플랫폼 통계 불러오기 전' },
      ]
    }

    const translationRate = platformStats.storedAnimeCount > 0
      ? (platformStats.translatedKoreanTitleCount / platformStats.storedAnimeCount) * 100
      : 0

    return [
      {
        label: '등록 유저',
        value: formatNumber(platformStats.registeredUserCount),
        hint: '공개 플랫폼 통계 API 연동',
      },
      {
        label: '저장된 애니',
        value: formatNumber(platformStats.storedAnimeCount),
        hint: '현재 DB 기준 저장 작품 수',
      },
      {
        label: '번역 진행률',
        value: formatPercent(translationRate),
        hint: `${formatNumber(platformStats.translatedKoreanTitleCount)} / ${formatNumber(platformStats.storedAnimeCount)}`,
      },
    ]
  }, [platformStats])

  const handlePlatformStatsRefresh = async () => {
    setIsLoadingPlatformStats(true)
    setError(null)

    try {
      const nextStats = await fetchPlatformStats()
      setPlatformStats(nextStats)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '플랫폼 통계를 불러오지 못했어요.')
    } finally {
      setIsLoadingPlatformStats(false)
    }
  }

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) {
      return
    }

    let isCancelled = false

    const loadInitialPlatformStats = async () => {
      try {
        const nextStats = await fetchPlatformStats()

        if (isCancelled) {
          return
        }

        setPlatformStats(nextStats)
        setError(null)
      } catch (loadError) {
        if (isCancelled) {
          return
        }

        setError(loadError instanceof Error ? loadError.message : '플랫폼 통계를 불러오지 못했어요.')
      }
    }

    void loadInitialPlatformStats()

    return () => {
      isCancelled = true
    }
  }, [isAuthenticated, isAdmin])

  const runAction = async (actionKey: string, runner: () => Promise<AdminActionResponse>) => {
    setActiveAction(actionKey)
    setError(null)

    try {
      const result = await runner()
      setResponseMap((current) => ({
        ...current,
        [actionKey]: result,
      }))
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : '관리자 작업 실행에 실패했어요.')
    } finally {
      setActiveAction(null)
    }
  }

  const actionItems = [
    {
      key: 'sync-page' as const,
      group: '동기화',
      label: '한 페이지 동기화',
      description: '한 페이지 범위만 빠르게 동기화합니다.',
      content: (
        <AdminActionCard
          title="애니 한 페이지 동기화"
          description="지정한 페이지 하나만 즉시 동기화합니다. 테스트 실행이나 작은 범위 확인에 적합해요."
          fields={[
            { key: 'page', label: '페이지', type: 'number' },
            { key: 'perPage', label: '페이지당 수', type: 'number' },
          ]}
          values={syncPageValues}
          isRunning={activeAction === 'sync-page'}
          onChange={(key, value) => setSyncPageValues((current) => ({ ...current, [key]: value }))}
          onSubmit={() => { void runAction('sync-page', () => syncAnimePage(syncPageValues)) }}
          response={responseMap['sync-page'] ?? null}
        />
      ),
    },
    {
      key: 'sync-all' as const,
      group: '동기화',
      label: '연속 페이지 동기화',
      description: '여러 페이지를 순차적으로 동기화합니다.',
      content: (
        <AdminActionCard
          title="여러 페이지 연속 동기화"
          description="시작 페이지부터 maxPages 수만큼 순차적으로 동기화합니다."
          fields={[
            { key: 'startPage', label: '시작 페이지', type: 'number' },
            { key: 'perPage', label: '페이지당 수', type: 'number' },
            { key: 'maxPages', label: '최대 페이지 수', type: 'number' },
          ]}
          values={syncAllValues}
          isRunning={activeAction === 'sync-all'}
          onChange={(key, value) => setSyncAllValues((current) => ({ ...current, [key]: value }))}
          onSubmit={() => { void runAction('sync-all', () => syncAllAnimePages(syncAllValues)) }}
          response={responseMap['sync-all'] ?? null}
        />
      ),
    },
    {
      key: 'sync-chunked' as const,
      group: '동기화',
      label: '청크 단위 동기화',
      description: '지연 시간을 둔 대량 동기화용입니다.',
      content: (
        <AdminActionCard
          title="청크 단위 동기화"
          description="여러 페이지를 chunk 단위로 나눠 실행하고, 각 chunk 사이에 대기 시간을 둡니다."
          fields={[
            { key: 'startPage', label: '시작 페이지', type: 'number' },
            { key: 'perPage', label: '페이지당 수', type: 'number' },
            { key: 'pagesPerChunk', label: '청크당 페이지 수', type: 'number' },
            { key: 'chunkDelayMs', label: '청크 지연(ms)', type: 'number' },
            { key: 'maxChunks', label: '최대 청크 수', type: 'number' },
          ]}
          values={chunkedValues}
          isRunning={activeAction === 'sync-chunked'}
          onChange={(key, value) => setChunkedValues((current) => ({ ...current, [key]: value }))}
          onSubmit={() => { void runAction('sync-chunked', () => syncAnimeChunked(chunkedValues)) }}
          response={responseMap['sync-chunked'] ?? null}
        />
      ),
    },
    {
      key: 'sync-season' as const,
      group: '동기화',
      label: '시즌 동기화',
      description: '특정 시즌과 연도만 골라서 동기화합니다.',
      content: (
        <AdminActionCard
          title="특정 시즌 동기화"
          description="특정 시즌과 연도만 대상으로 애니를 동기화합니다. 최신 시즌 보강에 유용해요."
          fields={[
            { key: 'season', label: '시즌', type: 'select', options: seasonOptions },
            { key: 'seasonYear', label: '연도', type: 'number' },
            { key: 'startPage', label: '시작 페이지', type: 'number' },
            { key: 'perPage', label: '페이지당 수', type: 'number' },
            { key: 'maxPages', label: '최대 페이지 수', type: 'number' },
          ]}
          values={seasonValues}
          isRunning={activeAction === 'sync-season'}
          onChange={(key, value) => setSeasonValues((current) => ({ ...current, [key]: value }))}
          onSubmit={() => { void runAction('sync-season', () => syncAnimeSeason(seasonValues)) }}
          response={responseMap['sync-season'] ?? null}
        />
      ),
    },
    {
      key: 'translate-korean' as const,
      group: '번역',
      label: '한국어 제목 번역',
      description: '번역 배치를 실행합니다.',
      content: (
        <AdminActionCard
          title="한국어 제목 번역 배치"
          description="저장된 애니 중 한국어 제목 번역 작업을 지정한 배치 크기만큼 실행합니다."
          fields={[
            { key: 'batchSize', label: '배치 크기', type: 'number' },
            { key: 'maxBatches', label: '최대 배치 수', type: 'number' },
          ]}
          values={translateValues}
          isRunning={activeAction === 'translate-korean'}
          onChange={(key, value) => setTranslateValues((current) => ({ ...current, [key]: value }))}
          onSubmit={() => { void runAction('translate-korean', () => translateKoreanTitles(translateValues)) }}
          response={responseMap['translate-korean'] ?? null}
        />
      ),
    },
  ]

  const selectedItem = actionItems.find((item) => item.key === selectedAction) ?? actionItems[0]

  if (!isAuthenticated) {
    return (
      <section className="admin-page">
        <div className="feedback-card">
          관리자 페이지는 로그인 후에만 볼 수 있어요. <Link to="/login">로그인</Link> 후 다시 확인해주세요.
        </div>
      </section>
    )
  }

  if (!isAdmin) {
    return (
      <section className="admin-page">
        <div className="feedback-card is-error">관리자 권한이 있는 계정만 접근할 수 있어요.</div>
      </section>
    )
  }

  return (
    <section className="admin-page">
      <div className="admin-hero-card">
        <div className="admin-hero-copy">
          <span className="section-kicker">Admin console</span>
          <h1>총 관리 페이지</h1>
          <p>애니 동기화와 한국어 제목 번역 배치를 실행하는 관리자 전용 공간입니다. 상단 수치는 공개 플랫폼 통계 API와 연동됩니다.</p>
          <span className="admin-hero-meta">현재 접속 계정: {greeting}</span>
        </div>
      </div>

      {error && <div className="feedback-card is-error">{error}</div>}

      <div className="admin-summary-section">
        <div className="admin-summary-header">
          <div>
            <span className="detail-label">Platform stats</span>
            <h2>플랫폼 현황</h2>
          </div>
          <button className="secondary-button" type="button" onClick={() => { void handlePlatformStatsRefresh() }} disabled={isLoadingPlatformStats}>
            {isLoadingPlatformStats ? '연동 중...' : '통계 연동'}
          </button>
        </div>

        <div className="admin-summary-grid compact-three">
          {summaryCards.map((card) => (
            <article className="admin-summary-card" key={card.label}>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <p>{card.hint}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="admin-overview-grid">
        {mockQueues.map((item) => (
          <article className="admin-overview-card" key={item.title}>
            <strong>{item.title}</strong>
            <p>{item.body}</p>
          </article>
        ))}
      </div>

      <div className="admin-workspace">
        <aside className="admin-sidebar">
          <div className="admin-sidebar-header">
            <span className="detail-label">Tools</span>
            <h2>관리 작업</h2>
          </div>
          <div className="admin-sidebar-list">
            {actionItems.map((item) => (
              <button
                key={item.key}
                className={selectedAction === item.key ? 'admin-sidebar-item is-active' : 'admin-sidebar-item'}
                type="button"
                onClick={() => setSelectedAction(item.key)}
              >
                <span className="admin-sidebar-group">{item.group}</span>
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </button>
            ))}
          </div>
        </aside>

        <div className="admin-workspace-panel">
          <div className="admin-panel-intro">
            <span className="detail-label">Selected action</span>
            <h2>{selectedItem.label}</h2>
            <p>{selectedItem.description}</p>
          </div>
          {selectedItem.content}
        </div>
      </div>
    </section>
  )
}
