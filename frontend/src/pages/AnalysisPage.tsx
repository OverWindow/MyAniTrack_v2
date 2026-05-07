import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  fetchMyAnimeStats,
  formatUpdatedAt,
  getGenreLabel,
  recalculateMyAnimeStats,
} from '../lib/stats'
import type { AnimeStatsItem } from '../types/stats'
import '../styles/pages/AnalysisPage.css'

type AnalysisState = {
  item: AnimeStatsItem | null
  isLoading: boolean
  error: string | null
}

type ReleaseYearChartDatum = {
  year: string
  count: number
}

type PieDatum = {
  label: string
  value: number
}

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

const RECALCULATE_COOLDOWN_SECONDS = 30

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
  return <div className="analysis-empty-state">{message}</div>
}

function getPieData(entries: Array<[string, number]>) {
  return entries.map(([label, value]) => ({ label, value }))
}

function getStarFillPercent(score: number, starIndex: number) {
  const scoreInStars = score / 2
  const fill = Math.max(0, Math.min(1, scoreInStars - starIndex))
  return `${fill * 100}%`
}

export function AnalysisPage() {
  const { isAuthenticated } = useAuth()
  const [state, setState] = useState<AnalysisState>({
    item: null,
    isLoading: true,
    error: null,
  })
  const [cooldownLeft, setCooldownLeft] = useState(0)
  const [isRecalculating, setIsRecalculating] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) {
      return
    }

    const controller = new AbortController()

    const loadStats = async () => {
      try {
        const item = await fetchMyAnimeStats(controller.signal)
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
            loadError instanceof Error
              ? loadError.message
              : '분석 정보를 불러오지 못했어요.',
        })
      }
    }

    void loadStats()

    return () => controller.abort()
  }, [isAuthenticated])

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
    () => getPieData(genreDistribution).map((entry) => ({ ...entry, label: getGenreLabel(entry.label) })),
    [genreDistribution],
  )
  const genreWatchMinutesChartData = useMemo<PieDatum[]>(
    () => getPieData(genreWatchMinutes).map((entry) => ({ ...entry, label: getGenreLabel(entry.label) })),
    [genreWatchMinutes],
  )
  const scoreDistribution = useMemo(
    () =>
      Object.entries(state.item?.scoreDistribution ?? {}).sort(
        ([left], [right]) => Number(left) - Number(right),
      ),
    [state.item?.scoreDistribution],
  )

  const handleRecalculate = async () => {
    if (cooldownLeft > 0 || isRecalculating) {
      return
    }

    setIsRecalculating(true)

    try {
      const item = await recalculateMyAnimeStats()
      setState({
        item,
        isLoading: false,
        error: null,
      })
      setCooldownLeft(RECALCULATE_COOLDOWN_SECONDS)
    } catch (refreshError) {
      setState((current) => ({
        ...current,
        error:
          refreshError instanceof Error
            ? refreshError.message
            : '분석을 다시 계산하지 못했어요.',
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
        <div className="feedback-card is-error">{state.error}</div>
      </section>
    )
  }

  const item = state.item
  const averageScore = toFiniteNumber(item?.avgScore)
  const averageReleaseYear = toFiniteNumber(item?.avgReleaseYear)

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
          <span className="section-kicker">Anime analysis</span>
          <h1>내 애니 취향 분석</h1>
          <p>{item.preferenceSummary || '내 컬렉션을 바탕으로 취향 분석을 정리해드려요.'}</p>
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

      {state.error && <div className="feedback-card is-error">{state.error}</div>}

      <div className="analysis-summary-grid">
        <article className="analysis-summary-card">
          <span>선호 장르</span>
          <strong>{getGenreLabel(item.favoriteGenre)}</strong>
        </article>
        <article className="analysis-summary-card">
          <span>총 작품 수</span>
          <strong>{item.totalCount.toLocaleString()}편</strong>
        </article>
        <article className="analysis-summary-card">
          <span>평균 점수</span>
          <strong>{averageScore !== null ? `${averageScore.toFixed(1)} / 10` : '미집계'}</strong>
        </article>
        <article className="analysis-summary-card">
          <span>총 시청 시간</span>
          <strong>{(item.totalWatchMinutes / 60).toFixed(1)}시간</strong>
        </article>
      </div>

      <div className="analysis-panel-grid">
        <section className="analysis-panel">
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

        <section className="analysis-panel">
          <div className="analysis-panel-heading">
            <span className="detail-label">Genre score</span>
            <h2>장르별 평균 점수</h2>
          </div>
          <div className="analysis-list">
            {genreAvgScore.length > 0 ? genreAvgScore.map(([genre, rawScore]) => {
              const normalizedScore = toFiniteNumber(rawScore) ?? 0

              return (
                <article className="analysis-genre-score-row" key={`score-${genre}`}>
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
                </article>
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
              <GenreDistributionPieChart data={genreDistributionChartData} />
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
              <GenreWatchMinutesPieChart data={genreWatchMinutesChartData} />
            </Suspense>
          ) : renderEmptyMessage('아직 장르별 시청 시간 데이터가 없어요.')}
        </section>

        <section className="analysis-panel analysis-panel-wide">
          <div className="analysis-panel-heading">
            <span className="detail-label">Release year</span>
            <h2>연도별 감상 작품 수</h2>
          </div>
          {releaseYearChartData.length > 0 ? (
            <Suspense fallback={<div className="analysis-chart-skeleton analysis-chart-skeleton-wide" />}>
              <ReleaseYearBarChart data={releaseYearChartData} />
            </Suspense>
          ) : renderEmptyMessage('아직 연도별 감상 데이터가 없어요.')}
        </section>

        <section className="analysis-panel analysis-panel-wide">
          <div className="analysis-panel-heading">
            <span className="detail-label">Score distribution</span>
            <h2>평점 분포</h2>
          </div>
          <div className="analysis-score-grid">
            {scoreDistribution.length > 0 ? scoreDistribution.map(([score, count]) => (
              <article className="analysis-score-card" key={`distribution-${score}`}>
                <strong>{score}점대</strong>
                <span>{count}편</span>
              </article>
            )) : renderEmptyMessage('아직 평점 분포 데이터가 없어요.')}
          </div>
        </section>
      </div>
    </section>
  )
}
