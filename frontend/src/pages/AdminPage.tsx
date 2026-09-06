import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AdminUserManager } from '../components/AdminUserManager'
import { AdminProfileReportManager } from '../components/AdminProfileReportManager'
import { AdminAnimeVisibilityManager } from '../components/AdminAnimeVisibilityManager'
import { AdminMaintenanceManager } from '../components/AdminMaintenanceManager'
import { ErrorToast } from '../components/ErrorToast'
import { useAuth } from '../contexts/AuthContext'
import { useMaintenance } from '../contexts/MaintenanceContext'
import {
  fetchAnimeCastSyncStatus,
  fetchPlatformStats,
  rebuildAnimeSeries,
  syncAllAnimePages,
  syncAnimeCast,
  syncAnimeCastBatch,
  syncAnimeCastChunked,
  syncAnimeChunked,
  syncAnimeFull,
  syncAnimePage,
  syncAnimeRelations,
  syncAnimeSeason,
  syncMissingAnimeStudios,
  translateKoreanTitles,
} from '../lib/admin'
import type {
  AdminActionResponse,
  AdminCastLanguage,
  AdminCastSyncAnimePayload,
  AdminCastSyncBatchPayload,
  AdminCastSyncChunkedPayload,
  AdminCastSyncStatusPayload,
  AdminFullSyncPayload,
  AdminRelationSyncMode,
  AdminRelationSyncPayload,
  AdminSeriesRebuildPayload,
  AdminSeriesRebuildScope,
  AdminSeason,
  AdminStudioSyncMissingPayload,
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
    type?: 'number' | 'text' | 'select' | 'checkbox'
    options?: string[]
  }>
  values: TPayload
  isRunning: boolean
  onChange: <K extends keyof TPayload>(key: K, value: TPayload[K]) => void
  onSubmit: () => void
  response: AdminActionResponse | null
}

type AdminActionKey =
  | 'maintenance'
  | 'users'
  | 'profile-reports'
  | 'anime-visibility'
  | 'sync-tools'
  | 'special-sync'
  | 'translate-korean'

type AdminSyncActionKey =
  | 'sync-page'
  | 'sync-all'
  | 'sync-full'
  | 'sync-relations'
  | 'sync-chunked'
  | 'sync-season'
  | 'studio-sync-missing'
  | 'cast-sync'
  | 'series-rebuild'

type AdminCastActionKey =
  | 'cast-sync-anime'
  | 'cast-sync-batch'
  | 'cast-sync-chunked'
  | 'cast-sync-status'

type AdminSpecialSyncActionKey =
  | 'studio-sync-missing'
  | 'cast-sync'
  | 'sync-relations'
  | 'series-rebuild'

const seasonOptions: AdminSeason[] = ['WINTER', 'SPRING', 'SUMMER', 'FALL']
const castLanguageOptions: AdminCastLanguage[] = ['JAPANESE', 'ENGLISH', 'KOREAN']
const seriesRebuildScopeOptions: AdminSeriesRebuildScope[] = ['all', 'mainline', 'franchise']
const RESPONSE_PREVIEW_LENGTH = 360

type AdminSummaryCard = {
  label: string
  value: string
  hint: string
  tone?: 'success' | 'danger'
}

type AdminFullSyncFormValues = Omit<AdminFullSyncPayload, 'maxPages'> & {
  maxPages: number
  syncAllPages: boolean
}

type AdminRelationSyncFormValues = Required<AdminRelationSyncPayload>

function formatNumber(value: number) {
  return new Intl.NumberFormat('ko-KR').format(value)
}

function formatPercent(value: number) {
  return `${Number.isFinite(value) ? value.toFixed(1) : '0.0'}%`
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

function AdminActionCard<TPayload extends Record<string, string | number | boolean>>({
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
              {field.type === 'checkbox' ? (
                <label className="admin-checkbox-field">
                  <input
                    type="checkbox"
                    checked={Boolean(rawValue)}
                    onChange={(event) => onChange(field.key, event.target.checked as TPayload[keyof TPayload])}
                  />
                  <span>{rawValue ? '활성화' : '비활성화'}</span>
                </label>
              ) : field.type === 'select' ? (
                <select
                  value={String(value)}
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
                  value={String(value)}
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
  const { settings: maintenanceSettings } = useMaintenance()
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
  const [relationSyncValues, setRelationSyncValues] = useState<AdminRelationSyncFormValues>({
    mode: 'missing',
    limit: 500,
    batchSize: 50,
    retryFailed: true,
    afterAnimeId: 0,
  })
  const [seriesRebuildValues, setSeriesRebuildValues] = useState<AdminSeriesRebuildPayload>({
    scope: 'all',
  })
  const [chunkedValues, setChunkedValues] = useState<AdminSyncChunkedPayload>({
    startPage: 1,
    perPage: 50,
    pagesPerChunk: 10,
    chunkDelayMs: 10000,
    maxChunks: 5,
  })
  const [fullSyncValues, setFullSyncValues] = useState<AdminFullSyncFormValues>({
    startPage: 1,
    perPage: 50,
    maxPages: 1,
    language: 'JAPANESE',
    castPerPage: 25,
    animeDelayMs: 2500,
    syncAllPages: false,
  })
  const [seasonValues, setSeasonValues] = useState<AdminSyncSeasonPayload>({
    season: 'SPRING',
    seasonYear: 2026,
    startPage: 1,
    perPage: 50,
    maxPages: 1,
    syncCast: true,
    language: 'JAPANESE',
    castPerPage: 25,
    animeDelayMs: 2500,
  })
  const [translateValues, setTranslateValues] = useState<AdminTranslateKoreanTitlesPayload>({
    batchSize: 100,
    maxBatches: 1,
  })
  const [castAnimeValues, setCastAnimeValues] = useState<AdminCastSyncAnimePayload>({
    animeId: 1,
    language: 'JAPANESE',
    perPage: 25,
  })
  const [castBatchValues, setCastBatchValues] = useState<AdminCastSyncBatchPayload>({
    limit: 10,
    language: 'JAPANESE',
    perPage: 25,
    onlyMissing: true,
    retryFailed: true,
    delayMs: 2500,
  })
  const [castChunkedValues, setCastChunkedValues] = useState<AdminCastSyncChunkedPayload>({
    totalLimit: 500,
    chunkSize: 100,
    maxChunks: 5,
    chunkDelayMs: 10000,
    language: 'JAPANESE',
    perPage: 25,
    onlyMissing: true,
    retryFailed: true,
    delayMs: 2500,
  })
  const [castStatusValues, setCastStatusValues] = useState<AdminCastSyncStatusPayload>({
    animeId: 1,
  })
  const [studioSyncValues, setStudioSyncValues] = useState<AdminStudioSyncMissingPayload>({
    limit: 200,
    batchSize: 50,
    retryFailed: false,
    delayMs: 2500,
  })

  const [selectedAction, setSelectedAction] = useState<AdminActionKey>('users')
  const [selectedSyncAction, setSelectedSyncAction] = useState<AdminSyncActionKey>('sync-page')
  const [selectedSpecialSyncAction, setSelectedSpecialSyncAction] = useState<AdminSpecialSyncActionKey>('studio-sync-missing')
  const [selectedCastAction, setSelectedCastAction] = useState<AdminCastActionKey>('cast-sync-anime')
  const [activeAction, setActiveAction] = useState<string | null>(null)
  const [responseMap, setResponseMap] = useState<Record<string, AdminActionResponse | null>>({})
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null)
  const [isLoadingPlatformStats, setIsLoadingPlatformStats] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const greeting = useMemo(() => {
    const name = user?.username?.trim() || user?.email?.split('@')[0] || 'Admin'
    return `${name} 관리자`
  }, [user?.email, user?.username])

  const summaryCards = useMemo<AdminSummaryCard[]>(() => {
    const maintenanceCard: AdminSummaryCard = maintenanceSettings
      ? {
          label: '웹 서비스',
          value: maintenanceSettings.enabled ? '점검 중' : '정상 운영',
          hint: `마지막 변경 ${new Intl.DateTimeFormat('ko-KR', {
            dateStyle: 'short',
            timeStyle: 'short',
          }).format(new Date(maintenanceSettings.updatedAt))}`,
          tone: maintenanceSettings.enabled ? 'danger' : 'success',
        }
      : {
          label: '웹 서비스',
          value: '확인 불가',
          hint: '점검 모드 상태를 불러오지 못함',
        }

    if (!platformStats) {
      return [
        maintenanceCard,
        { label: '등록 유저', value: '-', hint: '플랫폼 통계 불러오기 전' },
        { label: '저장된 애니', value: '-', hint: '플랫폼 통계 불러오기 전' },
        { label: '번역 진행률', value: '-', hint: '플랫폼 통계 불러오기 전' },
        { label: '캐스트 동기화율', value: '-', hint: '플랫폼 통계 불러오기 전' },
        { label: '스튜디오 동기화율', value: '-', hint: '플랫폼 통계 불러오기 전' },
        { label: '연관 작품 동기화율', value: '-', hint: '플랫폼 통계 불러오기 전' },
        { label: '캐릭터 / 성우', value: '-', hint: '플랫폼 통계 불러오기 전' },
      ]
    }

    const storedAnimeCount = platformStats.storedAnimeCount ?? 0
    const studioMappedAnimeCount = platformStats.studioMappedAnimeCount ?? 0
    const studioPendingAnimeCount = platformStats.studioPendingAnimeCount ?? Math.max(0, storedAnimeCount - studioMappedAnimeCount)
    const studioSyncedAnimeCount = platformStats.studioSyncedAnimeCount ?? 0
    const studioFailedAnimeCount = platformStats.studioFailedAnimeCount ?? 0
    const studioSyncRate = platformStats.studioSyncProgressRate
      ?? (storedAnimeCount > 0
        ? (studioSyncedAnimeCount / storedAnimeCount) * 100
        : 0)
    const translationRate = platformStats.translationProgressRate
      ?? (storedAnimeCount > 0
        ? (platformStats.translatedKoreanTitleCount / storedAnimeCount) * 100
        : 0)
    const castSyncRate = platformStats.castSyncProgressRate
      ?? (storedAnimeCount > 0
        ? (platformStats.castSyncedAnimeCount / storedAnimeCount) * 100
        : 0)
    const relationSyncedAnimeCount = platformStats.relationSyncedAnimeCount ?? 0
    const relationPendingAnimeCount = platformStats.relationPendingAnimeCount
      ?? Math.max(0, storedAnimeCount - relationSyncedAnimeCount)
    const relationSyncingAnimeCount = platformStats.relationSyncingAnimeCount ?? 0
    const relationFailedAnimeCount = platformStats.relationFailedAnimeCount ?? 0
    const relationSyncRate = platformStats.relationSyncProgressRate
      ?? (storedAnimeCount > 0
        ? (relationSyncedAnimeCount / storedAnimeCount) * 100
        : 0)
    return [
      maintenanceCard,
      {
        label: '등록 유저',
        value: formatNumber(platformStats.registeredUserCount),
        hint: '공개 플랫폼 통계 API 연동',
      },
      {
        label: '저장된 애니',
        value: formatNumber(storedAnimeCount),
        hint: '현재 DB 기준 저장 작품 수',
      },
      {
        label: '번역 진행률',
        value: formatPercent(translationRate),
        hint: `${formatNumber(platformStats.translatedKoreanTitleCount)} / ${formatNumber(storedAnimeCount)}`,
      },
      {
        label: '캐스트 동기화율',
        value: formatPercent(castSyncRate),
        hint: `${formatNumber(platformStats.castSyncedAnimeCount)} / ${formatNumber(storedAnimeCount)}`,
      },
      {
        label: '스튜디오 동기화율',
        value: formatPercent(studioSyncRate),
        hint: [
          `${formatNumber(studioSyncedAnimeCount)} 성공`,
          `${formatNumber(studioMappedAnimeCount)} 매핑`,
          `${formatNumber(studioPendingAnimeCount)} 대기`,
          `${formatNumber(studioFailedAnimeCount)} 실패`,
          `스튜디오 ${formatNumber(platformStats.studioCount ?? 0)}개`,
        ].join(' · '),
      },
      {
        label: '연관 작품 동기화율',
        value: formatPercent(relationSyncRate),
        hint: [
          `${formatNumber(relationSyncedAnimeCount)} 성공`,
          `${formatNumber(relationPendingAnimeCount)} 대기`,
          `${formatNumber(relationSyncingAnimeCount)} 진행`,
          `${formatNumber(relationFailedAnimeCount)} 실패`,
          `관계 ${formatNumber(platformStats.animeRelationCount ?? 0)}개`,
        ].join(' · '),
      },
      {
        label: '캐릭터 / 성우',
        value: `${formatNumber(platformStats.characterCount)} / ${formatNumber(platformStats.voiceActorCount)}`,
        hint: 'AniList 캐릭터 및 성우 저장 수',
      },
    ]
  }, [maintenanceSettings, platformStats])

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

  const castActionItems = [
    {
      key: 'cast-sync-anime' as const,
      label: '단건',
      description: '내부 anime.id 하나만 즉시 동기화합니다.',
      content: (
        <AdminActionCard
          title="애니 캐릭터/성우 단건 동기화"
          description="내부 DB의 anime.id 기준으로 AniList 캐릭터/성우를 가져와 characters, voice_actors 및 연결 테이블을 최신 결과로 재구성합니다."
          fields={[
            { key: 'animeId', label: '내부 anime.id', type: 'number' },
            { key: 'language', label: '성우 언어', type: 'select', options: castLanguageOptions },
            { key: 'perPage', label: 'AniList 페이지당 수', type: 'number' },
          ]}
          values={castAnimeValues}
          isRunning={activeAction === 'cast-sync-anime'}
          onChange={(key, value) => setCastAnimeValues((current) => ({ ...current, [key]: value }))}
          onSubmit={() => { void runAction('cast-sync-anime', () => syncAnimeCast(castAnimeValues)) }}
          response={responseMap['cast-sync-anime'] ?? null}
        />
      ),
    },
    {
      key: 'cast-sync-batch' as const,
      label: '배치',
      description: '여러 애니를 한 요청에서 순차 동기화합니다.',
      content: (
        <AdminActionCard
          title="애니 캐릭터/성우 배치 동기화"
          description="여러 애니를 순차 처리합니다. 장시간 요청일 수 있으므로 실행 중에는 버튼 중복 클릭을 막습니다."
          fields={[
            { key: 'limit', label: '처리 개수', type: 'number' },
            { key: 'language', label: '성우 언어', type: 'select', options: castLanguageOptions },
            { key: 'perPage', label: 'AniList 페이지당 수', type: 'number' },
            { key: 'onlyMissing', label: '미수집만 처리', type: 'checkbox' },
            { key: 'retryFailed', label: '실패 항목 재시도', type: 'checkbox' },
            { key: 'delayMs', label: '요청 간 지연(ms)', type: 'number' },
          ]}
          values={castBatchValues}
          isRunning={activeAction === 'cast-sync-batch'}
          onChange={(key, value) => setCastBatchValues((current) => ({ ...current, [key]: value }))}
          onSubmit={() => { void runAction('cast-sync-batch', () => syncAnimeCastBatch(castBatchValues)) }}
          response={responseMap['cast-sync-batch'] ?? null}
        />
      ),
    },
    {
      key: 'cast-sync-chunked' as const,
      label: '청크',
      description: '대량 수집을 청크 단위로 나눠 안정적으로 실행합니다.',
      content: (
        <AdminActionCard
          title="캐릭터/성우 청크 단위 동기화"
          description="전체 처리 목표를 여러 chunk로 나누고, chunk 사이와 애니별 처리 사이에 대기 시간을 둡니다. 대량 캐스트 수집에 적합해요."
          fields={[
            { key: 'totalLimit', label: '전체 목표 개수', type: 'number' },
            { key: 'chunkSize', label: '청크당 처리 개수', type: 'number' },
            { key: 'maxChunks', label: '최대 청크 수', type: 'number' },
            { key: 'chunkDelayMs', label: '청크 사이 지연(ms)', type: 'number' },
            { key: 'language', label: '성우 언어', type: 'select', options: castLanguageOptions },
            { key: 'perPage', label: 'AniList 페이지당 수', type: 'number' },
            { key: 'onlyMissing', label: '미동기화/실패만 처리', type: 'checkbox' },
            { key: 'retryFailed', label: '실패 항목 재시도', type: 'checkbox' },
            { key: 'delayMs', label: '애니별 지연(ms)', type: 'number' },
          ]}
          values={castChunkedValues}
          isRunning={activeAction === 'cast-sync-chunked'}
          onChange={(key, value) => setCastChunkedValues((current) => ({ ...current, [key]: value }))}
          onSubmit={() => { void runAction('cast-sync-chunked', () => syncAnimeCastChunked(castChunkedValues)) }}
          response={responseMap['cast-sync-chunked'] ?? null}
        />
      ),
    },
    {
      key: 'cast-sync-status' as const,
      label: '상태 조회',
      description: '특정 애니의 동기화 상태를 확인합니다.',
      content: (
        <AdminActionCard
          title="캐릭터/성우 동기화 상태 조회"
          description="anime_cast_sync_state에 기록된 해당 애니의 syncing/success/failed 상태와 상세 응답을 확인합니다."
          fields={[
            { key: 'animeId', label: '내부 anime.id', type: 'number' },
          ]}
          values={castStatusValues}
          isRunning={activeAction === 'cast-sync-status'}
          onChange={(key, value) => setCastStatusValues((current) => ({ ...current, [key]: value }))}
          onSubmit={() => { void runAction('cast-sync-status', () => fetchAnimeCastSyncStatus(castStatusValues)) }}
          response={responseMap['cast-sync-status'] ?? null}
        />
      ),
    },
  ]
  const selectedCastItem = castActionItems.find((item) => item.key === selectedCastAction) ?? castActionItems[0]

  const syncActionItems = [
    {
      key: 'series-rebuild' as const,
      group: '특수 동기화',
      label: '시리즈 재계산',
      description: '메인라인·프랜차이즈 시리즈 데이터를 다시 계산합니다.',
      content: (
        <AdminActionCard
          title="애니 시리즈 재계산"
          description="전체 범위 또는 메인라인·프랜차이즈 중 하나를 선택해 시리즈와 멤버 구성을 다시 계산합니다. 서버에서 재계산이 진행 중이면 중복 실행되지 않습니다."
          fields={[
            { key: 'scope', label: '재계산 범위', type: 'select', options: seriesRebuildScopeOptions },
          ]}
          values={seriesRebuildValues}
          isRunning={activeAction === 'series-rebuild'}
          onChange={(key, value) => setSeriesRebuildValues((current) => ({ ...current, [key]: value }))}
          onSubmit={() => { void runAction('series-rebuild', () => rebuildAnimeSeries(seriesRebuildValues)) }}
          response={responseMap['series-rebuild'] ?? null}
        />
      ),
    },
    {
      key: 'sync-full' as const,
      group: '통합 동기화',
      label: '전체 통합 동기화',
      description: '애니·스튜디오·캐릭터·성우·연관 작품을 한 번에 동기화합니다.',
      content: (
        <AdminActionCard
          title="전체 작품 통합 동기화"
          description="작품 기본 정보와 스튜디오, 캐릭터, 성우, 연관 작품 및 각 동기화 상태를 함께 처리합니다. 운영 환경에서는 최대 페이지 수를 1로 두고 응답의 nextPage를 다음 시작 페이지로 이어서 실행하는 방식을 권장합니다."
          fields={[
            { key: 'startPage', label: '시작 페이지', type: 'number' },
            { key: 'perPage', label: '페이지당 작품 수', type: 'number' },
            { key: 'maxPages', label: '최대 페이지 수', type: 'number' },
            { key: 'language', label: '성우 언어', type: 'select', options: castLanguageOptions },
            { key: 'castPerPage', label: '캐스트 페이지당 수', type: 'number' },
            { key: 'animeDelayMs', label: '작품 간 지연(ms)', type: 'number' },
            { key: 'syncAllPages', label: 'maxPages 생략 후 전체 실행', type: 'checkbox' },
          ]}
          values={fullSyncValues}
          isRunning={activeAction === 'sync-full'}
          onChange={(key, value) => setFullSyncValues((current) => ({ ...current, [key]: value }))}
          onSubmit={() => {
            void runAction('sync-full', async () => {
              const { syncAllPages, maxPages, ...basePayload } = fullSyncValues
              const response = await syncAnimeFull({
                ...basePayload,
                ...(!syncAllPages ? { maxPages } : {}),
              })
              const nextPage = Number(response.result.nextPage)

              if (Number.isInteger(nextPage) && nextPage > 0) {
                setFullSyncValues((current) => ({ ...current, startPage: nextPage }))
              }

              return response
            })
          }}
          response={responseMap['sync-full'] ?? null}
        />
      ),
    },
    {
      key: 'sync-relations' as const,
      group: '특수 동기화',
      label: '관계 동기화',
      description: '미동기화 처리 또는 전체 재동기화 방식을 선택합니다.',
      content: (
        <AdminActionCard
          title="애니 연관 작품 동기화"
          description={relationSyncValues.mode === 'missing'
            ? '상태가 없거나 pending인 작품부터 처리합니다. 실패 항목 재시도 여부도 선택할 수 있어요.'
            : '동기화 성공 여부와 관계없이 전체 작품을 내부 애니 ID 순으로 처음부터 재동기화합니다.'}
          fields={[
            { key: 'mode', label: '동기화 방식', type: 'select', options: ['missing', 'all'] as AdminRelationSyncMode[] },
            { key: 'limit', label: '최 처리 작품 수 (1~5000)', type: 'number' },
            { key: 'batchSize', label: '배치 크기', type: 'number' },
            ...(relationSyncValues.mode === 'missing'
              ? [{ key: 'retryFailed' as const, label: '실패 항목 재시도', type: 'checkbox' as const }]
              : [{ key: 'afterAnimeId' as const, label: '이어서 처리할 anime.id', type: 'number' as const }]),
          ]}
          values={relationSyncValues}
          isRunning={activeAction === 'sync-relations'}
          onChange={(key, value) => setRelationSyncValues((current) => ({ ...current, [key]: value }))}
          onSubmit={() => {
            void runAction('sync-relations', async () => {
              const { mode, limit, batchSize, retryFailed, afterAnimeId } = relationSyncValues
              const response = await syncAnimeRelations(mode === 'missing'
                ? { mode, limit, batchSize, retryFailed }
                : { mode, limit, batchSize, afterAnimeId })
              const nextAfterAnimeId = Number(response.result.nextAfterAnimeId)

              if (Number.isInteger(nextAfterAnimeId) && nextAfterAnimeId > 0) {
                setRelationSyncValues((current) => ({ ...current, afterAnimeId: nextAfterAnimeId }))
              }

              return response
            })
          }}
          response={responseMap['sync-relations'] ?? null}
        />
      ),
    },
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
      description: '여러 페이지의 작품과 연관 작품을 순차적으로 동기화합니다.',
      content: (
        <AdminActionCard
          title="여러 페이지 연속 동기화"
          description="시작 페이지부터 maxPages 수만큼 작품 기본 정보와 ANIME 유형의 연관 작품을 순차적으로 동기화합니다."
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
      description: '특정 시즌의 작품과 연관 작품을 통합 동기화합니다.',
      content: (
        <AdminActionCard
          title="특정 시즌 동기화"
          description="특정 시즌의 애니, 스튜디오, 연관 작품을 동기화하며, 기본적으로 캐릭터와 성우까지 함께 처리합니다. 캐스트 동기화를 끄더라도 연관 작품은 저장됩니다."
          fields={[
            { key: 'season', label: '시즌', type: 'select', options: seasonOptions },
            { key: 'seasonYear', label: '연도', type: 'number' },
            { key: 'startPage', label: '시작 페이지', type: 'number' },
            { key: 'perPage', label: '페이지당 수', type: 'number' },
            { key: 'maxPages', label: '최대 페이지 수', type: 'number' },
            { key: 'syncCast', label: '캐릭터·성우까지 통합 동기화', type: 'checkbox' },
            { key: 'language', label: '성우 언어', type: 'select', options: castLanguageOptions },
            { key: 'castPerPage', label: '캐스트 페이지당 수', type: 'number' },
            { key: 'animeDelayMs', label: '작품 간 지연(ms)', type: 'number' },
          ]}
          values={seasonValues}
          isRunning={activeAction === 'sync-season'}
          onChange={(key, value) => setSeasonValues((current) => ({ ...current, [key]: value }))}
          onSubmit={() => {
            void runAction('sync-season', async () => {
              const response = await syncAnimeSeason(seasonValues)
              const nextPage = Number(response.result.nextPage)

              if (Number.isInteger(nextPage) && nextPage > 0) {
                setSeasonValues((current) => ({ ...current, startPage: nextPage }))
              }

              return response
            })
          }}
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
    {
      key: 'studio-sync-missing' as const,
      group: '특수 동기화',
      label: '스튜디오 미동기화 백필',
      description: '스튜디오 상태가 없거나 대기 중인 애니를 채웁니다.',
      content: (
        <AdminActionCard
          title="스튜디오 미동기화 애니 백필"
          description="스튜디오 sync 상태가 없거나 pending인 애니를 처리합니다. hasMore가 true면 반복 실행하고, 실패분만 다시 처리하려면 retryFailed를 켜서 실행하세요."
          fields={[
            { key: 'limit', label: '선택할 애니 수', type: 'number' },
            { key: 'batchSize', label: '배치 크기', type: 'number' },
            { key: 'retryFailed', label: '실패 항목 재시도', type: 'checkbox' },
            { key: 'delayMs', label: '배치 사이 지연(ms)', type: 'number' },
          ]}
          values={studioSyncValues}
          isRunning={activeAction === 'studio-sync-missing'}
          onChange={(key, value) => setStudioSyncValues((current) => ({ ...current, [key]: value }))}
          onSubmit={() => {
            void runAction('studio-sync-missing', async () => {
              const result = await syncMissingAnimeStudios(studioSyncValues)

              try {
                const nextStats = await fetchPlatformStats()
                setPlatformStats(nextStats)
              } catch {
                // The action result is still useful even if the summary refresh fails.
              }

              return result
            })
          }}
          response={responseMap['studio-sync-missing'] ?? null}
        />
      ),
    },
    {
      key: 'cast-sync' as const,
      group: '특수 동기화',
      label: '캐릭터/성우 동기화',
      description: '단건, 배치, 청크, 상태 조회를 한 곳에서 실행합니다.',
      content: (
        <div className="admin-cast-tool">
          <div className="admin-cast-mode-list" role="tablist" aria-label="캐릭터/성우 동기화 유형">
            {castActionItems.map((item) => (
              <button
                className={selectedCastAction === item.key ? 'admin-cast-mode is-active' : 'admin-cast-mode'}
                key={item.key}
                type="button"
                role="tab"
                aria-selected={selectedCastAction === item.key}
                onClick={() => setSelectedCastAction(item.key)}
              >
                <strong>{item.label}</strong>
                <span>{item.description}</span>
              </button>
            ))}
          </div>

          {selectedCastItem.content}
        </div>
      ),
    },
  ]

  const syncToolItems = syncActionItems.filter((item) => (
    item.key !== 'translate-korean'
    && item.key !== 'studio-sync-missing'
    && item.key !== 'cast-sync'
    && item.key !== 'sync-relations'
  ))
  const selectedSyncItem = syncToolItems.find((item) => item.key === selectedSyncAction) ?? syncToolItems[0]
  const translateActionItem = syncActionItems.find((item) => item.key === 'translate-korean')
  const studioActionItem = syncActionItems.find((item) => item.key === 'studio-sync-missing')
  const castActionItem = syncActionItems.find((item) => item.key === 'cast-sync')
  const relationActionItem = syncActionItems.find((item) => item.key === 'sync-relations')
  const seriesRebuildActionItem = syncActionItems.find((item) => item.key === 'series-rebuild')
  const specialSyncItems = [seriesRebuildActionItem, studioActionItem, castActionItem, relationActionItem]
    .filter((item) => item !== undefined)
  const selectedSpecialSyncItem = specialSyncItems.find((item) => item.key === selectedSpecialSyncAction)
    ?? specialSyncItems[0]
  const actionItems = [
    {
      key: 'maintenance' as const,
      group: '서비스 운영',
      label: '점검 모드',
      description: '웹 점검 화면의 노출 상태와 한국어·영어 안내 문구를 관리합니다.',
      content: <AdminMaintenanceManager />,
    },
    {
      key: 'users' as const,
      group: '사용자',
      label: '사용자 검색',
      description: '이메일·사용자명과 권한으로 계정을 검색하고 컬렉션 통계를 확인합니다.',
      content: <AdminUserManager />,
    },
    {
      key: 'profile-reports' as const,
      group: '콘텐츠 안전',
      label: '프로필 신고',
      description: '신고된 프로필 이미지를 검토하고 제거·정지 조치합니다.',
      content: <AdminProfileReportManager />,
    },
    {
      key: 'anime-visibility' as const,
      group: '콘텐츠 안전',
      label: '작품 노출 관리',
      description: '정책 위험 작품을 앱 전체에서 즉시 숨깁니다.',
      content: <AdminAnimeVisibilityManager />,
    },
    {
      key: 'sync-tools' as const,
      group: '동기화',
      label: '동기화 관리',
      description: '애니, 시즌, 스튜디오, 캐릭터/성우 동기화를 한 곳에서 실행합니다.',
      content: (
        <div className="admin-sync-tool">
          <div className="admin-sync-mode-list" role="tablist" aria-label="동기화 작업 유형">
            {syncToolItems.map((item) => (
              <button
                className={selectedSyncAction === item.key ? 'admin-sync-mode is-active' : 'admin-sync-mode'}
                key={item.key}
                type="button"
                role="tab"
                aria-selected={selectedSyncAction === item.key}
                onClick={() => setSelectedSyncAction(item.key as AdminSyncActionKey)}
              >
                <span className="admin-sidebar-group">{item.group}</span>
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </button>
            ))}
          </div>

          {selectedSyncItem.content}
        </div>
      ),
    },
    {
      key: 'special-sync' as const,
      group: '특수 동기화',
      label: '특수 동기화',
      description: '시리즈 재계산과 스튜디오, 캐릭터/성우, 연관 작품 동기화를 모아서 실행합니다.',
      content: (
        <div className="admin-sync-tool">
          <div className="admin-sync-mode-list" role="tablist" aria-label="특수 동기화 작업 유형">
            {specialSyncItems.map((item) => (
              <button
                className={selectedSpecialSyncAction === item.key ? 'admin-sync-mode is-active' : 'admin-sync-mode'}
                key={item.key}
                type="button"
                role="tab"
                aria-selected={selectedSpecialSyncAction === item.key}
                onClick={() => setSelectedSpecialSyncAction(item.key as AdminSpecialSyncActionKey)}
              >
                <span className="admin-sidebar-group">{item.group}</span>
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </button>
            ))}
          </div>

          {selectedSpecialSyncItem?.content}
        </div>
      ),
    },
    ...(translateActionItem ? [translateActionItem] : []),
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
        <ErrorToast message="관리자 권한이 있는 계정만 접근할 수 있어요." />
        <div className="feedback-card">이 화면에 접근할 수 없어요.</div>
      </section>
    )
  }

  return (
    <section className="admin-page">
      <div className="admin-hero-card">
        <div className="admin-hero-copy">
          <h1>총 관리 페이지</h1>
          <p>웹 서비스 운영, 콘텐츠 안전, 애니 데이터 동기화를 관리하는 관리자 전용 공간입니다. 상단 수치는 공개 플랫폼 통계 API와 연동됩니다.</p>
          <span className="admin-hero-meta">현재 접속 계정: {greeting}</span>
        </div>
      </div>

      <ErrorToast message={error} />

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

        <article className="admin-summary-card admin-summary-combined-card">
          {summaryCards.map((card) => (
            <div
              className={card.tone ? `admin-summary-item is-${card.tone}` : 'admin-summary-item'}
              key={card.label}
            >
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <p>{card.hint}</p>
            </div>
          ))}
        </article>
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
