import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnalysisAnimeToast } from '../components/AnalysisAnimeToast'
import { ReleaseDecadeProgress } from '../components/ReleaseDecadeProgress'
import { VoiceActorRankingSection } from '../components/VoiceActorRankingSection'
import { useAuth } from '../contexts/AuthContext'
import {
  deleteAnalysisCachePrefix,
  getAnalysisCache,
  getAnalysisCacheKey,
  getAnalysisCachePrefix,
  getAnalysisViewState,
  getStoredStudioSort,
  saveAnalysisViewState,
  saveStoredStudioSort,
  setAnalysisCache,
} from '../lib/analysisCache'
import { getProfileImageSrc, handleProfileImageError } from '../lib/avatar'
import { fetchMyCollection } from '../lib/collection'
import { SERVER_CONNECTION_ERROR_MESSAGE, getFriendlyErrorMessage } from '../lib/errors'
import {
  fetchMyAnimeStats,
  fetchGenreBubbleStats,
  fetchStudioAnime,
  fetchStudioRanking,
  fetchYearlyScoreStats,
  formatUpdatedAt,
  getGenreLabel,
  recalculateMyAnimeStats,
} from '../lib/stats'
import type {
  AnimeStatsItem,
  GenreBubbleResponse,
  StudioAnimeResponse,
  StudioAnimeItem,
  StudioRankingItem,
  StudioRankingResponse,
  StudioRankingSort,
  YearlyScoreStats,
} from '../types/stats'
import type { AnimeGenre } from '../types/anime'
import type { UserAnimeListItem } from '../types/collection'
import '../styles/pages/AnalysisPage.css'

type AnalysisState = {
  item: AnimeStatsItem | null
  isLoading: boolean
  error: string | null
}

type YearAnimeState = {
  selectedYear: string | null
  items: UserAnimeListItem[]
  isLoading: boolean
  error: string | null
}

type GenreAnimeState = {
  selectedGenre: string | null
  items: UserAnimeListItem[]
  isLoading: boolean
  error: string | null
}

type ScoreAnimeState = {
  selectedScore: string | null
  items: UserAnimeListItem[]
  isLoading: boolean
  error: string | null
}

type ReleaseYearChartDatum = {
  year: string
  count: number
}

type ScoreDistributionChartDatum = {
  score: string
  label: string
  count: number
}

type PieDatum = {
  key: string
  label: string
  value: number
}

type AnalysisTab = 'genre' | 'year' | 'score'

const analysisTabs: Array<{ value: AnalysisTab; label: string }> = [
  { value: 'genre', label: '장르별 분석' },
  { value: 'year', label: '연도별 분석' },
  { value: 'score', label: '평점별 분석' },
]

const studioSortOptions: Array<{ value: StudioRankingSort; label: string; description: string }> = [
  { value: 'count', label: '작품 수', description: '가장 많이 본 스튜디오' },
  { value: 'score', label: '평균 점수', description: '내 평점이 높은 스튜디오' },
  { value: 'watchTime', label: '시청 시간', description: '가장 오래 본 스튜디오' },
]

const GenreDistributionPieChart = lazy(async () => {
  const module = await import('../components/AnalysisCharts')
  return { default: module.GenreDistributionPieChart }
})
const GenreWatchMinutesPieChart = lazy(async () => {
  const module = await import('../components/AnalysisCharts')
  return { default: module.GenreWatchMinutesPieChart }
})
const ReleaseYearBarChart = lazy(async () => {
  const module = await import('../components/AnalysisCharts')
  return { default: module.ReleaseYearBarChart }
})
const ScoreDistributionBarChart = lazy(async () => {
  const module = await import('../components/AnalysisCharts')
  return { default: module.ScoreDistributionBarChart }
})
const YearlyScoreLineChart = lazy(async () => {
  const module = await import('../components/AnalysisCharts')
  return { default: module.YearlyScoreLineChart }
})
const GenrePreferenceBubbleChart = lazy(async () => {
  const module = await import('../components/AnalysisCharts')
  return { default: module.GenrePreferenceBubbleChart }
})

const RECALCULATE_COOLDOWN_SECONDS = 30
const INITIAL_VISIBLE_STUDIO_RANKING_COUNT = 5

function getTopEntries(record: Record<string, number>, limit = 8) {
  return Object.entries(record)
    .sort(([, leftValue], [, rightValue]) => rightValue - leftValue)
    .slice(0, limit)
}

function getYearEntries(record: Record<string, number>) {
  return Object.entries(record).sort(([leftYear], [rightYear]) => Number(leftYear) - Number(rightYear))
}

function toFiniteNumber(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function renderEmptyMessage(message: string) {
  if (message === SERVER_CONNECTION_ERROR_MESSAGE) {
    return <div className="connection-error-plain">{message}</div>
  }

  return <div className="analysis-empty-state">{message}</div>
}

function getPieData(entries: Array<[string, number]>) {
  return entries.map(([label, value]) => ({ key: label, label, value }))
}

function getStarFillPercent(score: number, starIndex: number) {
  const scoreInStars = score / 2
  const fill = Math.max(0, Math.min(1, scoreInStars - starIndex))
  return `${fill * 100}%`
}

function getStudioAnimeTitle(item: StudioAnimeItem) {
  return item.anime.titles.korean || item.anime.titles.english || item.anime.title || item.anime.titles.romaji || '제목 없음'
}

function formatStudioWatchTime(hours?: number | null, minutes?: number | null) {
  if (typeof hours === 'number' && Number.isFinite(hours) && hours > 0) {
    return `${hours.toLocaleString(undefined, { maximumFractionDigits: 1 })}시간`
  }

  if (typeof minutes === 'number' && Number.isFinite(minutes) && minutes > 0) {
    return `${Math.round(minutes / 60).toLocaleString()}시간`
  }

  return '0시간'
}

function formatAnalysisScore(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '-'
}

type StudioRankingSectionProps = {
  apiUserId?: string
  cacheOwnerId?: number | string | null
  cacheVersion?: number
}

export function StudioRankingSection({
  apiUserId,
  cacheOwnerId,
  cacheVersion = 0,
}: StudioRankingSectionProps) {
  const storageOwnerId = cacheOwnerId ?? (apiUserId ? `public:${apiUserId}` : null)
  const [sort, setSort] = useState<StudioRankingSort>(() => getStoredStudioSort(storageOwnerId) ?? 'count')
  const [isStudioRankingExpanded, setIsStudioRankingExpanded] = useState(false)
  const [rankingState, setRankingState] = useState<{
    items: StudioRankingItem[]
    isLoading: boolean
    error: string | null
    studioCount: number
  }>({
    items: [],
    isLoading: true,
    error: null,
    studioCount: 0,
  })
  const [selectedStudio, setSelectedStudio] = useState<StudioRankingItem | null>(null)
  const [animeState, setAnimeState] = useState<{
    items: StudioAnimeItem[]
    isLoading: boolean
    error: string | null
  }>({
    items: [],
    isLoading: false,
    error: null,
  })

  useEffect(() => {
    setSort(getStoredStudioSort(storageOwnerId) ?? 'count')
  }, [storageOwnerId])

  useEffect(() => {
    if (storageOwnerId) {
      saveStoredStudioSort(storageOwnerId, sort)
    }
    setIsStudioRankingExpanded(false)
  }, [sort, storageOwnerId])

  useEffect(() => {
    if (!storageOwnerId) {
      return
    }

    const controller = new AbortController()
    let isCancelled = false

    const loadRanking = async () => {
      setRankingState((current) => ({ ...current, isLoading: true, error: null }))
      const cacheKey = getAnalysisCacheKey(storageOwnerId, 'studioRanking', sort)

      try {
        const cached = await getAnalysisCache<StudioRankingResponse>(cacheKey)

        if (isCancelled || controller.signal.aborted) {
          return
        }

        if (cached) {
          setRankingState({
            items: cached.items,
            isLoading: false,
            error: null,
            studioCount: cached.summary.studioCount,
          })
          setSelectedStudio((current) => {
            if (!current) {
              return cached.items[0] ?? null
            }

            return cached.items.find((entry) => entry.studio.id === current.studio.id) ?? cached.items[0] ?? null
          })
          return
        }

        const response = await fetchStudioRanking({
          userId: apiUserId,
          sort,
          limit: 12,
          minRatedAnimeCount: sort === 'score' ? 1 : undefined,
          signal: controller.signal,
        })

        if (isCancelled || controller.signal.aborted) {
          return
        }

        await setAnalysisCache(cacheKey, response)

        setRankingState({
          items: response.items,
          isLoading: false,
          error: null,
          studioCount: response.summary.studioCount,
        })
        setSelectedStudio((current) => {
          if (!current) {
            return response.items[0] ?? null
          }

          return response.items.find((entry) => entry.studio.id === current.studio.id) ?? response.items[0] ?? null
        })
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') {
          return
        }

        setRankingState({
          items: [],
          isLoading: false,
          error: getFriendlyErrorMessage(loadError, '스튜디오 랭킹을 불러오지 못했어요.'),
          studioCount: 0,
        })
        setSelectedStudio(null)
      }
    }

    void loadRanking()

    return () => {
      isCancelled = true
      controller.abort()
    }
  }, [apiUserId, cacheVersion, sort, storageOwnerId])

  useEffect(() => {
    if (!selectedStudio || !storageOwnerId) {
      setAnimeState({ items: [], isLoading: false, error: null })
      return
    }

    const controller = new AbortController()
    let isCancelled = false

    const loadAnime = async () => {
      setAnimeState({ items: [], isLoading: true, error: null })
      const cacheKey = getAnalysisCacheKey(storageOwnerId, 'studioAnime', String(selectedStudio.studio.id))

      try {
        const cached = await getAnalysisCache<StudioAnimeResponse>(cacheKey)

        if (isCancelled || controller.signal.aborted) {
          return
        }

        if (cached) {
          setAnimeState({ items: cached.items, isLoading: false, error: null })
          return
        }

        const response = await fetchStudioAnime({
          userId: apiUserId,
          studioId: selectedStudio.studio.id,
          limit: 12,
          signal: controller.signal,
        })

        if (isCancelled || controller.signal.aborted) {
          return
        }

        await setAnalysisCache(cacheKey, response)

        setAnimeState({ items: response.items, isLoading: false, error: null })
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') {
          return
        }

        setAnimeState({
          items: [],
          isLoading: false,
          error: getFriendlyErrorMessage(loadError, '스튜디오 작품을 불러오지 못했어요.'),
        })
      }
    }

    void loadAnime()

    return () => {
      isCancelled = true
      controller.abort()
    }
  }, [apiUserId, cacheVersion, selectedStudio, storageOwnerId])

  const visibleStudioItems = isStudioRankingExpanded
    ? rankingState.items
    : rankingState.items.slice(0, INITIAL_VISIBLE_STUDIO_RANKING_COUNT)
  const hasMoreStudioItems = rankingState.items.length > INITIAL_VISIBLE_STUDIO_RANKING_COUNT

  return (
    <section className="analysis-panel studio-ranking-section">
      <div className="analysis-panel-heading studio-ranking-title-row">
        <div>
          <span className="detail-label">Studio ranking</span>
          <h2>스튜디오 분석</h2>
          <p>내가 본 작품을 제작 스튜디오 기준으로 묶어 작품 수, 평균 점수, 시청 시간을 비교해요.</p>
        </div>
        <span className="studio-ranking-count">{rankingState.studioCount.toLocaleString()}개 스튜디오</span>
      </div>

      <div className="studio-ranking-tabs" role="tablist" aria-label="스튜디오 정렬 기준">
        {studioSortOptions.map((option) => (
          <button
            className={sort === option.value ? 'studio-ranking-tab is-active' : 'studio-ranking-tab'}
            key={option.value}
            type="button"
            role="tab"
            aria-selected={sort === option.value}
            onClick={() => setSort(option.value)}
          >
            <strong>{option.label}</strong>
            <span>{option.description}</span>
          </button>
        ))}
      </div>

      {rankingState.isLoading && <div className="analysis-empty-state">스튜디오 랭킹을 불러오는 중이에요.</div>}
      {rankingState.error && !rankingState.isLoading && renderEmptyMessage(rankingState.error)}
      {!rankingState.isLoading && !rankingState.error && rankingState.items.length === 0 && (
        <div className="analysis-empty-state">표시할 스튜디오 데이터가 아직 없어요.</div>
      )}

      {!rankingState.isLoading && !rankingState.error && rankingState.items.length > 0 && (
        <div className="studio-ranking-layout">
          <div className="studio-ranking-list">
            {visibleStudioItems.map((entry, index) => {
              const rank = index + 1
              const rankClassName = rank <= 3 ? ` is-top-rank is-rank-${rank}` : ''

              return (
                <button
                  className={
                    `${selectedStudio?.studio.id === entry.studio.id
                      ? 'studio-ranking-card is-active'
                      : 'studio-ranking-card'}${rankClassName}`
                  }
                  key={entry.studio.id}
                  type="button"
                  onClick={() => setSelectedStudio(entry)}
                >
                  <span className="studio-ranking-rank">{rank}위</span>
                  <span className="studio-ranking-copy">
                    <strong>{entry.studio.name}</strong>
                    <small>
                      {entry.animeCount.toLocaleString()}편 · 평균 {entry.averageScore !== null ? entry.averageScore.toFixed(1) : '-'}점
                    </small>
                  </span>
                  <span className="studio-ranking-metric">
                    {sort === 'watchTime'
                      ? formatStudioWatchTime(entry.totalWatchHours, entry.totalWatchMinutes)
                      : sort === 'score'
                        ? `${entry.averageScore !== null ? entry.averageScore.toFixed(1) : '-'}`
                        : `${entry.animeCount.toLocaleString()}편`}
                  </span>
                </button>
              )
            })}
            {hasMoreStudioItems && (
              <button
                className="voice-actor-more-button studio-ranking-more-button"
                type="button"
                onClick={() => setIsStudioRankingExpanded((current) => !current)}
              >
                {isStudioRankingExpanded
                  ? '접기'
                  : `더보기 ${rankingState.items.length - INITIAL_VISIBLE_STUDIO_RANKING_COUNT}개`}
              </button>
            )}
          </div>

          <div className="studio-anime-panel">
            <div className="studio-anime-heading">
              <div>
                <span className="detail-label">Studio works</span>
                <h3>{selectedStudio?.studio.name ?? '스튜디오'}</h3>
              </div>
              {selectedStudio?.studio.siteUrl && (
                <a href={selectedStudio.studio.siteUrl} target="_blank" rel="noreferrer">
                  AniList
                </a>
              )}
            </div>

            {animeState.isLoading && <div className="analysis-empty-state">작품 목록을 불러오는 중이에요.</div>}
            {animeState.error && !animeState.isLoading && renderEmptyMessage(animeState.error)}
            {!animeState.isLoading && !animeState.error && animeState.items.length === 0 && (
              <div className="analysis-empty-state">이 스튜디오의 작품 목록이 아직 없어요.</div>
            )}
            {!animeState.isLoading && !animeState.error && animeState.items.length > 0 && (
              <div className="studio-anime-list">
                {animeState.items.map((entry) => {
                  const title = getStudioAnimeTitle(entry)

                  return (
                    <Link className="studio-anime-card" key={entry.anime.id} to={`/anime/${entry.anime.id}`}>
                      <img
                        src={entry.anime.coverImageExtraLarge || entry.anime.coverImageLarge || ''}
                        alt={title}
                        loading="lazy"
                      />
                      <span>
                        <strong>{title}</strong>
                        <small>
                          {entry.anime.seasonYear ?? '연도 미상'} · {entry.userList.score !== null ? `${entry.userList.score.toFixed(1)}점` : '평점 없음'}
                        </small>
                      </span>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

export function AnalysisPage() {
  const { isAuthenticated, user } = useAuth()
  const userId = user?.id ?? null
  const [state, setState] = useState<AnalysisState>({
    item: null,
    isLoading: true,
    error: null,
  })
  const [cooldownLeft, setCooldownLeft] = useState(0)
  const [isRecalculating, setIsRecalculating] = useState(false)
  const [cacheVersion, setCacheVersion] = useState(0)
  const [activeTab, setActiveTab] = useState<AnalysisTab>('genre')
  const [yearAnimeState, setYearAnimeState] = useState<YearAnimeState>({
    selectedYear: null,
    items: [],
    isLoading: false,
    error: null,
  })
  const [genreAnimeState, setGenreAnimeState] = useState<GenreAnimeState>({
    selectedGenre: null,
    items: [],
    isLoading: false,
    error: null,
  })
  const [scoreAnimeState, setScoreAnimeState] = useState<ScoreAnimeState>({
    selectedScore: null,
    items: [],
    isLoading: false,
    error: null,
  })
  const [genreBubbleState, setGenreBubbleState] = useState<{
    item: GenreBubbleResponse['item'] | null
    isLoading: boolean
    error: string | null
  }>({
    item: null,
    isLoading: true,
    error: null,
  })
  const [yearlyScoreState, setYearlyScoreState] = useState<{
    item: YearlyScoreStats | null
    isLoading: boolean
    error: string | null
  }>({
    item: null,
    isLoading: true,
    error: null,
  })

  useEffect(() => {
    const viewState = getAnalysisViewState(userId)

    if (!viewState) {
      return
    }

    if (viewState.activeTab) {
      setActiveTab(viewState.activeTab)
    }

    setGenreAnimeState((current) => ({ ...current, selectedGenre: viewState.selectedGenre ?? null }))
    setYearAnimeState((current) => ({ ...current, selectedYear: viewState.selectedYear ?? null }))
    setScoreAnimeState((current) => ({ ...current, selectedScore: viewState.selectedScore ?? null }))
  }, [userId])

  useEffect(() => {
    if (!userId) {
      return
    }

    saveAnalysisViewState(userId, {
      activeTab,
      selectedGenre: genreAnimeState.selectedGenre,
      selectedYear: yearAnimeState.selectedYear,
      selectedScore: scoreAnimeState.selectedScore,
    })
  }, [
    activeTab,
    genreAnimeState.selectedGenre,
    scoreAnimeState.selectedScore,
    userId,
    yearAnimeState.selectedYear,
  ])

  useEffect(() => {
    if (!userId || !genreAnimeState.selectedGenre || genreAnimeState.isLoading || genreAnimeState.items.length > 0) {
      return
    }

    const selectedGenre = genreAnimeState.selectedGenre

    const restoreGenreItems = async () => {
      const cached = await getAnalysisCache<UserAnimeListItem[]>(
        getAnalysisCacheKey(userId, 'filteredAnime', `genre:${selectedGenre}`),
      )

      if (!cached) {
        return
      }

      setGenreAnimeState({
        selectedGenre,
        items: cached,
        isLoading: false,
        error: null,
      })
    }

    void restoreGenreItems()
  }, [genreAnimeState.isLoading, genreAnimeState.items.length, genreAnimeState.selectedGenre, userId])

  useEffect(() => {
    if (!userId || !yearAnimeState.selectedYear || yearAnimeState.isLoading || yearAnimeState.items.length > 0) {
      return
    }

    const selectedYear = yearAnimeState.selectedYear

    const restoreYearItems = async () => {
      const cached = await getAnalysisCache<UserAnimeListItem[]>(
        getAnalysisCacheKey(userId, 'filteredAnime', `year:${selectedYear}`),
      )

      if (!cached) {
        return
      }

      setYearAnimeState({
        selectedYear,
        items: cached,
        isLoading: false,
        error: null,
      })
    }

    void restoreYearItems()
  }, [userId, yearAnimeState.isLoading, yearAnimeState.items.length, yearAnimeState.selectedYear])

  useEffect(() => {
    if (!userId || !scoreAnimeState.selectedScore || scoreAnimeState.isLoading || scoreAnimeState.items.length > 0) {
      return
    }

    const selectedScore = scoreAnimeState.selectedScore

    const restoreScoreItems = async () => {
      const cached = await getAnalysisCache<UserAnimeListItem[]>(
        getAnalysisCacheKey(userId, 'filteredAnime', `score:${Number(selectedScore)}`),
      )

      if (!cached) {
        return
      }

      setScoreAnimeState({
        selectedScore,
        items: cached,
        isLoading: false,
        error: null,
      })
    }

    void restoreScoreItems()
  }, [scoreAnimeState.isLoading, scoreAnimeState.items.length, scoreAnimeState.selectedScore, userId])

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      return
    }

    const controller = new AbortController()
    let isCancelled = false

    const loadStats = async () => {
      const cacheKey = getAnalysisCacheKey(userId, 'myStats')
      setState({ item: null, isLoading: true, error: null })

      try {
        const cached = await getAnalysisCache<AnimeStatsItem>(cacheKey)

        if (isCancelled || controller.signal.aborted) {
          return
        }

        if (cached) {
          setState({
            item: cached,
            isLoading: false,
            error: null,
          })
          return
        }

        const item = await fetchMyAnimeStats(controller.signal)

        if (isCancelled || controller.signal.aborted) {
          return
        }

        await setAnalysisCache(cacheKey, item)

        setState({
          item,
          isLoading: false,
          error: null,
        })
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') {
          return
        }

        setState({
          item: null,
          isLoading: false,
          error:
            getFriendlyErrorMessage(loadError, '분석 정보를 불러오지 못했어요.'),
        })
      }
    }

    void loadStats()

    return () => {
      isCancelled = true
      controller.abort()
    }
  }, [isAuthenticated, userId])

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      return
    }

    const controller = new AbortController()
    let isCancelled = false

    const loadGenreBubble = async () => {
      setGenreBubbleState((current) => ({ ...current, isLoading: true, error: null }))
      const cacheKey = getAnalysisCacheKey(userId, 'genreBubble')

      try {
        const cached = await getAnalysisCache<GenreBubbleResponse['item']>(cacheKey)

        if (isCancelled || controller.signal.aborted) {
          return
        }

        if (cached) {
          setGenreBubbleState({ item: cached, isLoading: false, error: null })
          return
        }

        const item = await fetchGenreBubbleStats({ signal: controller.signal })

        if (isCancelled || controller.signal.aborted) {
          return
        }

        await setAnalysisCache(cacheKey, item)

        setGenreBubbleState({ item, isLoading: false, error: null })
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') {
          return
        }

        setGenreBubbleState({
          item: null,
          isLoading: false,
          error: getFriendlyErrorMessage(loadError, '장르 취향 버블 차트를 불러오지 못했어요.'),
        })
      }
    }

    void loadGenreBubble()

    return () => {
      isCancelled = true
      controller.abort()
    }
  }, [cacheVersion, isAuthenticated, userId])

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      return
    }

    const controller = new AbortController()
    let isCancelled = false

    const loadYearlyScores = async () => {
      setYearlyScoreState((current) => ({ ...current, isLoading: true, error: null }))
      const cacheKey = getAnalysisCacheKey(userId, 'yearlyScores')

      try {
        const cached = await getAnalysisCache<YearlyScoreStats>(cacheKey)

        if (isCancelled || controller.signal.aborted) {
          return
        }

        if (cached) {
          setYearlyScoreState({ item: cached, isLoading: false, error: null })
          return
        }

        const item = await fetchYearlyScoreStats({ signal: controller.signal })

        if (isCancelled || controller.signal.aborted) {
          return
        }

        await setAnalysisCache(cacheKey, item)

        setYearlyScoreState({ item, isLoading: false, error: null })
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') {
          return
        }

        setYearlyScoreState({
          item: null,
          isLoading: false,
          error: getFriendlyErrorMessage(loadError, '연도별 평점 분석을 불러오지 못했어요.'),
        })
      }
    }

    void loadYearlyScores()

    return () => {
      isCancelled = true
      controller.abort()
    }
  }, [cacheVersion, isAuthenticated, userId])

  useEffect(() => {
    if (cooldownLeft <= 0) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setCooldownLeft((current) => current - 1)
    }, 1000)

    return () => window.clearTimeout(timeoutId)
  }, [cooldownLeft])

  const genreDistribution = useMemo(
    () => getTopEntries(state.item?.genreDistribution ?? {}),
    [state.item?.genreDistribution],
  )
  const genreWatchMinutes = useMemo(
    () => getTopEntries(state.item?.genreWatchMinutes ?? {}),
    [state.item?.genreWatchMinutes],
  )
  const genreAvgScore = useMemo(
    () => getTopEntries(state.item?.genreAvgScore ?? {}),
    [state.item?.genreAvgScore],
  )
  const releaseDistribution = useMemo(
    () => getYearEntries(state.item?.releaseYearDistribution ?? {}),
    [state.item?.releaseYearDistribution],
  )
  const releaseYearChartData = useMemo<ReleaseYearChartDatum[]>(
    () => releaseDistribution.map(([year, count]) => ({ year, count })),
    [releaseDistribution],
  )
  const genreDistributionChartData = useMemo<PieDatum[]>(
    () => getPieData(genreDistribution).map((entry) => ({ ...entry, label: getGenreLabel(entry.key) })),
    [genreDistribution],
  )
  const genreWatchMinutesChartData = useMemo<PieDatum[]>(
    () => getPieData(genreWatchMinutes).map((entry) => ({ ...entry, label: getGenreLabel(entry.key) })),
    [genreWatchMinutes],
  )
  const scoreDistribution = useMemo(
    () =>
      Object.entries(state.item?.scoreDistribution ?? {}).sort(
        ([left], [right]) => Number(left) - Number(right),
      ),
    [state.item?.scoreDistribution],
  )
  const scoreDistributionChartData = useMemo<ScoreDistributionChartDatum[]>(
    () => scoreDistribution.map(([score, count]) => ({ score, label: `${score}점대`, count })),
    [scoreDistribution],
  )

  const handleSelectReleaseYear = async (year: string) => {
    const normalizedYear = Number(year)

    if (!Number.isInteger(normalizedYear) || normalizedYear < 1900 || normalizedYear > 2100) {
      setYearAnimeState({
        selectedYear: year,
        items: [],
        isLoading: false,
        error: '이 항목은 단일 연도가 아니라 기간이라서 작품 목록을 불러올 수 없어요.',
      })
      return
    }

    setYearAnimeState({
      selectedYear: year,
      items: [],
      isLoading: true,
      error: null,
    })

    try {
      const cacheKey = userId ? getAnalysisCacheKey(userId, 'filteredAnime', `year:${normalizedYear}`) : null
      const cached = cacheKey ? await getAnalysisCache<UserAnimeListItem[]>(cacheKey) : null

      if (cached) {
        setYearAnimeState({
          selectedYear: year,
          items: cached,
          isLoading: false,
          error: null,
        })
        return
      }

      const response = await fetchMyCollection({
        sort: 'score',
        limit: 50,
        year: normalizedYear,
      })

      if (cacheKey) {
        await setAnalysisCache(cacheKey, response.items)
      }

      setYearAnimeState({
        selectedYear: year,
        items: response.items,
        isLoading: false,
        error: null,
      })
    } catch (yearError) {
      setYearAnimeState({
        selectedYear: year,
        items: [],
        isLoading: false,
        error:
          getFriendlyErrorMessage(yearError, '해당 연도 작품을 불러오지 못했어요.'),
      })
    }
  }

  const handleSelectGenre = async (genre: string) => {
    setGenreAnimeState({
      selectedGenre: genre,
      items: [],
      isLoading: true,
      error: null,
    })

    try {
      const cacheKey = userId ? getAnalysisCacheKey(userId, 'filteredAnime', `genre:${genre}`) : null
      const cached = cacheKey ? await getAnalysisCache<UserAnimeListItem[]>(cacheKey) : null

      if (cached) {
        setGenreAnimeState({
          selectedGenre: genre,
          items: cached,
          isLoading: false,
          error: null,
        })
        return
      }

      const response = await fetchMyCollection({
        sort: 'score',
        limit: 50,
        genre: genre as AnimeGenre,
      })

      if (cacheKey) {
        await setAnalysisCache(cacheKey, response.items)
      }

      setGenreAnimeState({
        selectedGenre: genre,
        items: response.items,
        isLoading: false,
        error: null,
      })
    } catch (genreError) {
      setGenreAnimeState({
        selectedGenre: genre,
        items: [],
        isLoading: false,
        error:
          getFriendlyErrorMessage(genreError, '해당 장르 작품을 불러오지 못했어요.'),
      })
    }
  }

  const handleSelectScore = async (score: string) => {
    const normalizedScore = Number(score)

    if (!Number.isFinite(normalizedScore)) {
      setScoreAnimeState({
        selectedScore: score,
        items: [],
        isLoading: false,
        error: '선택한 평점 형식이 올바르지 않아요.',
      })
      return
    }

    setScoreAnimeState({
      selectedScore: score,
      items: [],
      isLoading: true,
      error: null,
    })

    try {
      const cacheKey = userId ? getAnalysisCacheKey(userId, 'filteredAnime', `score:${normalizedScore}`) : null
      const cached = cacheKey ? await getAnalysisCache<UserAnimeListItem[]>(cacheKey) : null

      if (cached) {
        setScoreAnimeState({
          selectedScore: score,
          items: cached,
          isLoading: false,
          error: null,
        })
        return
      }

      const response = await fetchMyCollection({
        sort: 'score',
        limit: 50,
        score: normalizedScore,
      })

      if (cacheKey) {
        await setAnalysisCache(cacheKey, response.items)
      }

      setScoreAnimeState({
        selectedScore: score,
        items: response.items,
        isLoading: false,
        error: null,
      })
    } catch (scoreError) {
      setScoreAnimeState({
        selectedScore: score,
        items: [],
        isLoading: false,
        error:
          getFriendlyErrorMessage(scoreError, '해당 평점 작품을 불러오지 못했어요.'),
      })
    }
  }

  const handleRecalculate = async () => {
    if (cooldownLeft > 0 || isRecalculating || !userId) {
      return
    }

    setIsRecalculating(true)

    try {
      const item = await recalculateMyAnimeStats()
      await deleteAnalysisCachePrefix(getAnalysisCachePrefix(userId))
      await setAnalysisCache(getAnalysisCacheKey(userId, 'myStats'), item)
      setState({
        item,
        isLoading: false,
        error: null,
      })
      setGenreAnimeState({ selectedGenre: null, items: [], isLoading: false, error: null })
      setYearAnimeState({ selectedYear: null, items: [], isLoading: false, error: null })
      setScoreAnimeState({ selectedScore: null, items: [], isLoading: false, error: null })
      setCacheVersion((current) => current + 1)
      setCooldownLeft(RECALCULATE_COOLDOWN_SECONDS)
    } catch (refreshError) {
      setState((current) => ({
        ...current,
        error:
          getFriendlyErrorMessage(refreshError, '분석을 다시 계산하지 못했어요.'),
      }))
    } finally {
      setIsRecalculating(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <section className="analysis-page">
        <div className="feedback-card">
          분석 탭은 로그인한 사용자만 볼 수 있어요. <Link to="/login">로그인</Link> 후 다시
          확인해주세요.
        </div>
      </section>
    )
  }

  if (state.isLoading) {
    return (
      <section className="analysis-page">
        <div className="analysis-summary-grid">
          {Array.from({ length: 4 }).map((_, index) => (
            <article className="analysis-summary-card skeleton-card" key={`analysis-skeleton-${index}`}>
              <div className="skeleton-line short" />
              <div className="skeleton-line long" />
            </article>
          ))}
        </div>
      </section>
    )
  }

  if (state.error && !state.item) {
    return (
      <section className="analysis-page">
        {state.error === SERVER_CONNECTION_ERROR_MESSAGE
          ? <div className="connection-error-plain">{state.error}</div>
          : <div className="feedback-card is-error">{state.error}</div>}
      </section>
    )
  }

  const item = state.item
  const averageScore = toFiniteNumber(item?.avgScore)
  const averageReleaseYear = toFiniteNumber(item?.avgReleaseYear)
  const displayName = user?.username?.trim() || user?.email?.split('@')[0] || 'MyAniTrack User'

  if (!item) {
    return (
      <section className="analysis-page">
        <div className="feedback-card">분석 정보가 아직 없어요.</div>
      </section>
    )
  }

  return (
    <section className="analysis-page">
      <div className="analysis-hero-card">
        <div className="analysis-hero-copy">
          <div className="analysis-profile-heading">
            <img
              className="analysis-profile-avatar analysis-profile-avatar-image"
              src={getProfileImageSrc(user?.profileImageUrl)}
              alt={displayName}
              onError={handleProfileImageError}
            />
            <div>
              <span className="section-kicker">Anime analysis</span>
              <h1>{displayName}</h1>
              <p>사용자 ID {user?.id ?? '-'}</p>
            </div>
          </div>
          <p className="analysis-profile-note">
            내 컬렉션에 담긴 작품, 평점, 시청 기록을 바탕으로 취향 흐름을 정리했어요.
          </p>
          <span className="analysis-updated-at">
            마지막 계산 {formatUpdatedAt(item.updatedAt)}
          </span>
        </div>

        <div className="analysis-hero-actions">
          <button
            className="primary-button"
            type="button"
            onClick={() => {
              void handleRecalculate()
            }}
            disabled={isRecalculating || cooldownLeft > 0}
          >
            {isRecalculating
              ? '계산 중...'
              : cooldownLeft > 0
                ? `${cooldownLeft}초 후 다시 계산`
                : '분석 새로고침'}
          </button>
          <span className="analysis-refresh-note">연속 계산은 30초마다 한 번만 가능해요.</span>
        </div>
      </div>

      {state.error && (
        state.error === SERVER_CONNECTION_ERROR_MESSAGE
          ? <div className="connection-error-plain">{state.error}</div>
          : <div className="feedback-card is-error">{state.error}</div>
      )}

      <section className="analysis-summary-card">
        <div className="analysis-summary-grid">
          <article className="analysis-summary-item">
            <span>선호 장르</span>
            <strong>{getGenreLabel(item.favoriteGenre)}</strong>
          </article>
          <article className="analysis-summary-item">
            <span>총 작품 수</span>
            <strong>{item.totalCount.toLocaleString()}편</strong>
          </article>
          <article className="analysis-summary-item">
            <span>평균 점수</span>
            <strong>{averageScore !== null ? `${averageScore.toFixed(1)} / 10` : '미집계'}</strong>
          </article>
          <article className="analysis-summary-item">
            <span>총 시청 시간</span>
            <strong>{(item.totalWatchMinutes / 60).toFixed(1)}시간</strong>
          </article>
        </div>
      </section>

      <div className="analysis-panel-grid">
        <section className="analysis-panel analysis-overview-panel">
          <div className="analysis-panel-heading">
            <span className="detail-label">Overview</span>
            <h2>기본 통계</h2>
          </div>
          <div className="analysis-facts-grid">
            <article>
              <span>총 작품 수</span>
              <strong>{item.totalCount.toLocaleString()}</strong>
            </article>
            <article>
              <span>완주 작품</span>
              <strong>{item.completedCount.toLocaleString()}</strong>
            </article>
            <article>
              <span>보는 중</span>
              <strong>{item.watchingCount.toLocaleString()}</strong>
            </article>
            <article>
              <span>중단 작품</span>
              <strong>{item.droppedCount.toLocaleString()}</strong>
            </article>
            <article>
              <span>총 시청 화수</span>
              <strong>{item.totalWatchedEpisodes.toLocaleString()}화</strong>
            </article>
            <article>
              <span>가장 많이 본 연도</span>
              <strong>{item.favoriteReleasePeriod || '정보 없음'}</strong>
            </article>
            <article>
              <span>평균 방영 연도</span>
              <strong>{averageReleaseYear !== null ? averageReleaseYear.toFixed(1) : '정보 없음'}</strong>
            </article>
          </div>
        </section>

        <div className="analysis-tab-area">
          <div className="analysis-segmented-control" role="tablist" aria-label="분석 종류 선택">
            {analysisTabs.map((tab) => (
              <button
                className={activeTab === tab.value ? 'analysis-segment is-active' : 'analysis-segment'}
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.value}
                onClick={() => setActiveTab(tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'genre' && (
            <div className="analysis-tab-grid" role="tabpanel">
              <section className="analysis-panel">
                <div className="analysis-panel-heading">
                  <span className="detail-label">Genre score</span>
                  <h2>장르별 평균 점수</h2>
                </div>
                <div className="analysis-list">
                  {genreAvgScore.length > 0 ? genreAvgScore.map(([genre, rawScore]) => {
                    const normalizedScore = toFiniteNumber(rawScore) ?? 0

                    return (
                      <button
                        className={
                          genreAnimeState.selectedGenre === genre
                            ? 'analysis-genre-score-row analysis-genre-score-button is-active'
                            : 'analysis-genre-score-row analysis-genre-score-button'
                        }
                        key={`score-${genre}`}
                        type="button"
                        onClick={() => {
                          void handleSelectGenre(genre)
                        }}
                      >
                        <div className="analysis-genre-score-copy">
                          <span>{getGenreLabel(genre)}</span>
                          <div className="analysis-score-stars" aria-hidden="true">
                            {Array.from({ length: 5 }).map((_, index) => (
                              <div className="analysis-score-star-shell" key={`${genre}-${index}`}>
                                <span className="analysis-score-star-base">★</span>
                                <span
                                  className="analysis-score-star-fill"
                                  style={{ width: getStarFillPercent(normalizedScore, index) }}
                                >
                                  ★
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <strong>{normalizedScore.toFixed(1)} / 10</strong>
                      </button>
                    )
                  }) : renderEmptyMessage('아직 장르별 평균 점수 데이터가 없어요.')}
                </div>
              </section>

              <section className="analysis-panel">
                <div className="analysis-panel-heading">
                  <span className="detail-label">Genre</span>
                  <h2>장르 분포</h2>
                </div>
                {genreDistributionChartData.length > 0 ? (
                  <Suspense fallback={<div className="analysis-chart-skeleton" />}>
                    <GenreDistributionPieChart
                      data={genreDistributionChartData}
                      selectedKey={genreAnimeState.selectedGenre}
                      onSelectGenre={(genre) => {
                        void handleSelectGenre(genre)
                      }}
                    />
                  </Suspense>
                ) : renderEmptyMessage('아직 장르 분포 데이터가 없어요.')}
              </section>

              <section className="analysis-panel">
                <div className="analysis-panel-heading">
                  <span className="detail-label">Watch time</span>
                  <h2>장르별 시청 시간</h2>
                </div>
                {genreWatchMinutesChartData.length > 0 ? (
                  <Suspense fallback={<div className="analysis-chart-skeleton" />}>
                    <GenreWatchMinutesPieChart
                      data={genreWatchMinutesChartData}
                      selectedKey={genreAnimeState.selectedGenre}
                      onSelectGenre={(genre) => {
                        void handleSelectGenre(genre)
                      }}
                    />
                  </Suspense>
                ) : renderEmptyMessage('아직 장르별 시청 시간 데이터가 없어요.')}
              </section>

            </div>
          )}

          {activeTab === 'year' && (
            <div className="analysis-year-tab" role="tabpanel">
              <section className="analysis-panel analysis-panel-wide">
                <div className="analysis-panel-heading">
                  <span className="detail-label">Release year</span>
                  <h2>연도별 감상 작품 수</h2>
                </div>
                {releaseYearChartData.length > 0 ? (
                  <>
                    <Suspense fallback={<div className="analysis-chart-skeleton analysis-chart-skeleton-wide" />}>
                      <ReleaseYearBarChart
                        data={releaseYearChartData}
                        selectedYear={yearAnimeState.selectedYear}
                        onSelectYear={(year) => {
                          void handleSelectReleaseYear(year)
                        }}
                      />
                    </Suspense>
                    <ReleaseDecadeProgress entries={releaseDistribution} />
                  </>
                ) : renderEmptyMessage('아직 연도별 감상 데이터가 없어요.')}
              </section>

              <section className="analysis-panel analysis-panel-wide">
                <div className="analysis-panel-heading">
                  <span className="detail-label">Year score</span>
                  <h2>연도별 평균 평점</h2>
                  <p>평점이 있는 작품이 3편 이상인 연도만 모아 내 평균과 커뮤니티 평균을 비교해요.</p>
                </div>
                {yearlyScoreState.isLoading && <div className="analysis-empty-state">연도별 평점 분석을 불러오는 중이에요.</div>}
                {yearlyScoreState.error && !yearlyScoreState.isLoading && renderEmptyMessage(yearlyScoreState.error)}
                {!yearlyScoreState.isLoading && !yearlyScoreState.error && yearlyScoreState.item && yearlyScoreState.item.items.length > 0 && (
                  <>
                    <div className="analysis-year-score-summary">
                      <article>
                        <span>최고 연도</span>
                        <strong>{yearlyScoreState.item.summary.bestYear ?? '-'}</strong>
                      </article>
                      <article>
                        <span>최저 연도</span>
                        <strong>{yearlyScoreState.item.summary.worstYear ?? '-'}</strong>
                      </article>
                      <article>
                        <span>전체 평균</span>
                        <strong>{formatAnalysisScore(yearlyScoreState.item.summary.averageScore)}점</strong>
                      </article>
                      <article>
                        <span>분석 연도</span>
                        <strong>{yearlyScoreState.item.summary.yearCount.toLocaleString()}개</strong>
                      </article>
                    </div>
                    <Suspense fallback={<div className="analysis-chart-skeleton analysis-chart-skeleton-wide" />}>
                      <YearlyScoreLineChart
                        data={yearlyScoreState.item.items}
                        selectedYear={yearAnimeState.selectedYear}
                        onSelectYear={(year) => {
                          void handleSelectReleaseYear(year)
                        }}
                      />
                    </Suspense>
                  </>
                )}
                {!yearlyScoreState.isLoading && !yearlyScoreState.error && (!yearlyScoreState.item || yearlyScoreState.item.items.length === 0) && (
                  <div className="analysis-empty-state">연도별 평점 분석에 표시할 데이터가 아직 없어요.</div>
                )}
              </section>

            </div>
          )}

          {activeTab === 'score' && (
            <div className="analysis-score-tab" role="tabpanel">
              <section className="analysis-panel analysis-panel-wide">
                <div className="analysis-panel-heading">
                  <span className="detail-label">Score distribution</span>
                  <h2>평점 분포</h2>
                </div>
                {scoreDistributionChartData.length > 0 ? (
                  <Suspense fallback={<div className="analysis-chart-skeleton analysis-chart-skeleton-wide" />}>
                    <ScoreDistributionBarChart
                      data={scoreDistributionChartData}
                      selectedScore={scoreAnimeState.selectedScore}
                      onSelectScore={(score) => {
                        void handleSelectScore(score)
                      }}
                    />
                  </Suspense>
                ) : renderEmptyMessage('아직 평점 분포 데이터가 없어요.')}
              </section>

            </div>
          )}
        </div>
      </div>

      <AnalysisAnimeToast
        title={
          activeTab === 'genre'
            ? `${getGenreLabel(genreAnimeState.selectedGenre)} 감상 작품`
            : activeTab === 'year'
              ? `${yearAnimeState.selectedYear}년 감상 작품`
              : `${scoreAnimeState.selectedScore}점대 감상 작품`
        }
        description="선택한 분석 항목에 해당하는 애니예요."
        items={
          activeTab === 'genre'
            ? genreAnimeState.items
            : activeTab === 'year'
              ? yearAnimeState.items
              : scoreAnimeState.items
        }
        isLoading={
          activeTab === 'genre'
            ? genreAnimeState.isLoading
            : activeTab === 'year'
              ? yearAnimeState.isLoading
              : scoreAnimeState.isLoading
        }
        error={
          activeTab === 'genre'
            ? genreAnimeState.error
            : activeTab === 'year'
              ? yearAnimeState.error
              : scoreAnimeState.error
        }
        isOpen={
          activeTab === 'genre'
            ? Boolean(genreAnimeState.selectedGenre)
            : activeTab === 'year'
              ? Boolean(yearAnimeState.selectedYear)
              : Boolean(scoreAnimeState.selectedScore)
        }
        onClose={() => {
          if (activeTab === 'genre') {
            setGenreAnimeState({ selectedGenre: null, items: [], isLoading: false, error: null })
          } else if (activeTab === 'year') {
            setYearAnimeState({ selectedYear: null, items: [], isLoading: false, error: null })
          } else {
            setScoreAnimeState({ selectedScore: null, items: [], isLoading: false, error: null })
          }
        }}
      />

      <section className="analysis-panel analysis-bubble-panel">
        <div className="analysis-panel-heading">
          <span className="detail-label">Genre preference</span>
          <h2>장르 취향 버블 차트</h2>
          <p>내 평균과 커뮤니티 평균을 각각의 전체 평균 대비로 정규화해, 취향이 어느 쪽으로 기우는지 볼 수 있어요.</p>
        </div>
        {genreBubbleState.isLoading && <div className="analysis-empty-state">장르 취향 차트를 불러오는 중이에요.</div>}
        {genreBubbleState.error && !genreBubbleState.isLoading && renderEmptyMessage(genreBubbleState.error)}
        {!genreBubbleState.isLoading && !genreBubbleState.error && genreBubbleState.item && genreBubbleState.item.items.length > 0 && (
          <Suspense fallback={<div className="analysis-chart-skeleton analysis-chart-skeleton-wide" />}>
            <GenrePreferenceBubbleChart
              data={genreBubbleState.item.items}
              selectedGenre={genreAnimeState.selectedGenre}
              onSelectGenre={(genre) => {
                setActiveTab('genre')
                void handleSelectGenre(genre)
              }}
            />
          </Suspense>
        )}
        {!genreBubbleState.isLoading && !genreBubbleState.error && (!genreBubbleState.item || genreBubbleState.item.items.length === 0) && (
          <div className="analysis-empty-state">표시할 장르 취향 데이터가 아직 없어요.</div>
        )}
      </section>

      <StudioRankingSection cacheOwnerId={userId} cacheVersion={cacheVersion} />

      <VoiceActorRankingSection cacheOwnerId={userId} cacheVersion={cacheVersion} ownerLabel="내" />
    </section>
  )
}
