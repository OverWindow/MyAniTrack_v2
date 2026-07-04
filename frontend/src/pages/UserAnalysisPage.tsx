import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AnalysisAnimeToast } from '../components/AnalysisAnimeToast'
import { ReleaseDecadeProgress } from '../components/ReleaseDecadeProgress'
import { VoiceActorRankingSection } from '../components/VoiceActorRankingSection'
import { StudioRankingSection } from './AnalysisPage'
import { getProfileImageSrc, handleProfileImageError } from '../lib/avatar'
import { SERVER_CONNECTION_ERROR_MESSAGE, getFriendlyErrorMessage } from '../lib/errors'
import { fetchGenreBubbleStats, fetchYearlyScoreStats, formatUpdatedAt, formatWatchHours, getGenreLabel } from '../lib/stats'
import { fetchPublicUserAnimeStats, fetchPublicUserCollection } from '../lib/users'
import type { AnimeGenre } from '../types/anime'
import type { UserAnimeListItem } from '../types/collection'
import type { AnimeStatsItem, GenreBubbleResponse, YearlyScoreStats } from '../types/stats'
import type { PublicUserProfile } from '../types/users'
import '../styles/pages/AnalysisPage.css'
import '../styles/pages/UserAnalysisPage.css'

type UserAnalysisState = {
  user: PublicUserProfile | null
  item: AnimeStatsItem | null
  isLoading: boolean
  error: string | null
}

type FilteredAnimeState = {
  selectedValue: string | null
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

function formatAnalysisScore(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '-'
}

export function UserAnalysisPage() {
  const { userId } = useParams<{ userId: string }>()
  const [state, setState] = useState<UserAnalysisState>({
    user: null,
    item: null,
    isLoading: true,
    error: null,
  })
  const [activeTab, setActiveTab] = useState<AnalysisTab>('genre')
  const [genreAnimeState, setGenreAnimeState] = useState<FilteredAnimeState>({
    selectedValue: null,
    items: [],
    isLoading: false,
    error: null,
  })
  const [yearAnimeState, setYearAnimeState] = useState<FilteredAnimeState>({
    selectedValue: null,
    items: [],
    isLoading: false,
    error: null,
  })
  const [scoreAnimeState, setScoreAnimeState] = useState<FilteredAnimeState>({
    selectedValue: null,
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
    if (!userId) {
      return
    }

    const controller = new AbortController()

    const loadStats = async () => {
      try {
        const data = await fetchPublicUserAnimeStats(userId, controller.signal)
        setState({ user: data.user, item: data.item, isLoading: false, error: null })
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') {
          return
        }

        setState({
          user: null,
          item: null,
          isLoading: false,
          error: getFriendlyErrorMessage(loadError, '분석 정보를 불러오지 못했어요.'),
        })
      }
    }

    void loadStats()

    return () => controller.abort()
  }, [userId])

  useEffect(() => {
    if (!userId) {
      return
    }

    const controller = new AbortController()

    const loadYearlyScores = async () => {
      setYearlyScoreState((current) => ({ ...current, isLoading: true, error: null }))

      try {
        const item = await fetchYearlyScoreStats({ userId, signal: controller.signal })
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

    return () => controller.abort()
  }, [userId])

  useEffect(() => {
    if (!userId) {
      return
    }

    const controller = new AbortController()

    const loadGenreBubble = async () => {
      setGenreBubbleState((current) => ({ ...current, isLoading: true, error: null }))

      try {
        const item = await fetchGenreBubbleStats({ userId, signal: controller.signal })
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

    return () => controller.abort()
  }, [userId])

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
  const scoreDistribution = useMemo(
    () => Object.entries(state.item?.scoreDistribution ?? {}).sort(([left], [right]) => Number(left) - Number(right)),
    [state.item?.scoreDistribution],
  )
  const genreDistributionChartData = useMemo<PieDatum[]>(
    () => getPieData(genreDistribution).map((entry) => ({ ...entry, label: getGenreLabel(entry.key) })),
    [genreDistribution],
  )
  const genreWatchMinutesChartData = useMemo<PieDatum[]>(
    () => getPieData(genreWatchMinutes).map((entry) => ({ ...entry, label: getGenreLabel(entry.key) })),
    [genreWatchMinutes],
  )
  const releaseYearChartData = useMemo<ReleaseYearChartDatum[]>(
    () => releaseDistribution.map(([year, count]) => ({ year, count })),
    [releaseDistribution],
  )
  const scoreDistributionChartData = useMemo<ScoreDistributionChartDatum[]>(
    () => scoreDistribution.map(([score, count]) => ({ score, label: `${score}점대`, count })),
    [scoreDistribution],
  )

  const handleSelectGenre = async (genre: string) => {
    if (!userId) {
      return
    }

    setGenreAnimeState({ selectedValue: genre, items: [], isLoading: true, error: null })

    try {
      const response = await fetchPublicUserCollection({
        userId,
        sort: 'score',
        limit: 50,
        genre: genre as AnimeGenre,
      })
      setGenreAnimeState({ selectedValue: genre, items: response.items, isLoading: false, error: null })
    } catch (error) {
      setGenreAnimeState({
        selectedValue: genre,
        items: [],
        isLoading: false,
        error: getFriendlyErrorMessage(error, '해당 장르 작품을 불러오지 못했어요.'),
      })
    }
  }

  const handleSelectReleaseYear = async (year: string) => {
    if (!userId) {
      return
    }

    const normalizedYear = Number(year)

    if (!Number.isInteger(normalizedYear) || normalizedYear < 1900 || normalizedYear > 2100) {
      setYearAnimeState({
        selectedValue: year,
        items: [],
        isLoading: false,
        error: '이 항목은 단일 연도가 아니라 기간이라서 작품 목록을 불러올 수 없어요.',
      })
      return
    }

    setYearAnimeState({ selectedValue: year, items: [], isLoading: true, error: null })

    try {
      const response = await fetchPublicUserCollection({
        userId,
        sort: 'score',
        limit: 50,
        year: normalizedYear,
      })
      setYearAnimeState({ selectedValue: year, items: response.items, isLoading: false, error: null })
    } catch (error) {
      setYearAnimeState({
        selectedValue: year,
        items: [],
        isLoading: false,
        error: getFriendlyErrorMessage(error, '해당 연도 작품을 불러오지 못했어요.'),
      })
    }
  }

  const handleSelectScore = async (score: string) => {
    if (!userId) {
      return
    }

    const normalizedScore = Number(score)

    if (!Number.isFinite(normalizedScore)) {
      setScoreAnimeState({
        selectedValue: score,
        items: [],
        isLoading: false,
        error: '선택한 평점 형식이 올바르지 않아요.',
      })
      return
    }

    setScoreAnimeState({ selectedValue: score, items: [], isLoading: true, error: null })

    try {
      const response = await fetchPublicUserCollection({
        userId,
        sort: 'score',
        limit: 50,
        score: normalizedScore,
      })
      setScoreAnimeState({ selectedValue: score, items: response.items, isLoading: false, error: null })
    } catch (error) {
      setScoreAnimeState({
        selectedValue: score,
        items: [],
        isLoading: false,
        error: getFriendlyErrorMessage(error, '해당 평점 작품을 불러오지 못했어요.'),
      })
    }
  }

  if (!userId) {
    return (
      <section className="analysis-page">
        <div className="feedback-card is-error">잘못된 사용자 경로예요.</div>
      </section>
    )
  }

  if (state.isLoading) {
    return (
      <section className="analysis-page">
        <div className="analysis-summary-grid">
          {Array.from({ length: 4 }).map((_, index) => (
            <article className="analysis-summary-card skeleton-card" key={`user-analysis-skeleton-${index}`}>
              <div className="skeleton-line short" />
              <div className="skeleton-line long" />
            </article>
          ))}
        </div>
      </section>
    )
  }

  if (state.error || !state.item || !state.user) {
    return (
      <section className="analysis-page">
        {state.error === SERVER_CONNECTION_ERROR_MESSAGE
          ? <div className="connection-error-plain">{state.error}</div>
          : <div className="feedback-card is-error">{state.error ?? '분석 정보를 찾을 수 없어요.'}</div>}
      </section>
    )
  }

  const item = state.item
  const user = state.user
  const averageScore = toFiniteNumber(item.avgScore)
  const averageReleaseYear = toFiniteNumber(item.avgReleaseYear)

  return (
    <section className="analysis-page user-analysis-page">
      <Link className="detail-back-link" to={`/users/${userId}/profile`}>
        프로필로 돌아가기
      </Link>

      <div className="analysis-hero-card">
        <div className="analysis-hero-copy">
          <div className="analysis-profile-heading">
            {user.profileImageUrl ? (
              <img
                className="analysis-profile-avatar analysis-profile-avatar-image"
                src={getProfileImageSrc(user.profileImageUrl)}
                alt={user.username}
                onError={handleProfileImageError}
              />
            ) : (
              <div className="analysis-profile-avatar" aria-hidden="true">
                {user.username.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <span className="section-kicker">Friend analysis</span>
              <h1>{user.username}</h1>
              <p>사용자 ID {user.id}</p>
            </div>
          </div>
          <p className="analysis-profile-note">
            이 유저의 공개 컬렉션, 평점, 시청 기록을 바탕으로 취향 흐름을 정리했어요.
          </p>
          <span className="analysis-updated-at">마지막 계산 {formatUpdatedAt(item.updatedAt)}</span>
        </div>

        <div className="analysis-hero-actions user-analysis-actions">
          <Link className="secondary-button" to={`/users/${userId}/anime-list`}>
            컬렉션 보기
          </Link>
        </div>
      </div>

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
            <strong>{formatWatchHours(item.totalWatchMinutes)}</strong>
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
            <article><span>총 작품 수</span><strong>{item.totalCount.toLocaleString()}</strong></article>
            <article><span>완주 작품</span><strong>{item.completedCount.toLocaleString()}</strong></article>
            <article><span>보는 중</span><strong>{item.watchingCount.toLocaleString()}</strong></article>
            <article><span>중단 작품</span><strong>{item.droppedCount.toLocaleString()}</strong></article>
            <article><span>총 시청 화수</span><strong>{item.totalWatchedEpisodes.toLocaleString()}화</strong></article>
            <article><span>선호 시기</span><strong>{item.favoriteReleasePeriod || '정보 없음'}</strong></article>
            <article><span>평균 방영 연도</span><strong>{averageReleaseYear !== null ? averageReleaseYear.toFixed(1) : '정보 없음'}</strong></article>
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
                          genreAnimeState.selectedValue === genre
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
                      selectedKey={genreAnimeState.selectedValue}
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
                      selectedKey={genreAnimeState.selectedValue}
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
                        selectedYear={yearAnimeState.selectedValue}
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
                  <p>평점이 있는 작품이 3편 이상인 연도만 모아 이 유저의 평균과 커뮤니티 평균을 비교해요.</p>
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
                        selectedYear={yearAnimeState.selectedValue}
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
                      selectedScore={scoreAnimeState.selectedValue}
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
            ? `${getGenreLabel(genreAnimeState.selectedValue)} 감상 작품`
            : activeTab === 'year'
              ? `${yearAnimeState.selectedValue}년 감상 작품`
              : `${scoreAnimeState.selectedValue}점대 감상 작품`
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
            ? Boolean(genreAnimeState.selectedValue)
            : activeTab === 'year'
              ? Boolean(yearAnimeState.selectedValue)
              : Boolean(scoreAnimeState.selectedValue)
        }
        onClose={() => {
          if (activeTab === 'genre') {
            setGenreAnimeState({ selectedValue: null, items: [], isLoading: false, error: null })
          } else if (activeTab === 'year') {
            setYearAnimeState({ selectedValue: null, items: [], isLoading: false, error: null })
          } else {
            setScoreAnimeState({ selectedValue: null, items: [], isLoading: false, error: null })
          }
        }}
      />

      <section className="analysis-panel analysis-bubble-panel">
        <div className="analysis-panel-heading">
          <span className="detail-label">Genre preference</span>
          <h2>장르 취향 버블 차트</h2>
          <p>이 유저의 평균과 커뮤니티 평균을 각각의 전체 평균 대비로 정규화해, 취향이 어느 쪽으로 기우는지 볼 수 있어요.</p>
        </div>
        {genreBubbleState.isLoading && <div className="analysis-empty-state">장르 취향 차트를 불러오는 중이에요.</div>}
        {genreBubbleState.error && !genreBubbleState.isLoading && renderEmptyMessage(genreBubbleState.error)}
        {!genreBubbleState.isLoading && !genreBubbleState.error && genreBubbleState.item && genreBubbleState.item.items.length > 0 && (
          <Suspense fallback={<div className="analysis-chart-skeleton analysis-chart-skeleton-wide" />}>
            <GenrePreferenceBubbleChart
              data={genreBubbleState.item.items}
              selectedGenre={genreAnimeState.selectedValue}
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

      <StudioRankingSection apiUserId={userId} cacheOwnerId={`public:${userId}`} />

      <VoiceActorRankingSection userId={userId} ownerLabel={user.username} />
    </section>
  )
}
