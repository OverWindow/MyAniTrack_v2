import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { formatUpdatedAt, formatWatchHours, getGenreLabel } from '../lib/stats'
import { fetchPublicUserAnimeStats } from '../lib/users'
import type { AnimeStatsItem } from '../types/stats'
import type { PublicUserProfile } from '../types/users'
import '../styles/pages/AnalysisPage.css'
import '../styles/pages/UserAnalysisPage.css'

type UserAnalysisState = {
  user: PublicUserProfile | null
  item: AnimeStatsItem | null
  isLoading: boolean
  error: string | null
}

function getTopEntries(record: Record<string, number>, limit = 6) {
  return Object.entries(record)
    .sort(([, leftValue], [, rightValue]) => rightValue - leftValue)
    .slice(0, limit)
}

function getMaxValue(entries: Array<[string, number]>) {
  return entries.reduce((max, [, value]) => Math.max(max, value), 0)
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

export function UserAnalysisPage() {
  const { userId } = useParams<{ userId: string }>()
  const [state, setState] = useState<UserAnalysisState>({
    user: null,
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
          error: loadError instanceof Error ? loadError.message : '분석 정보를 불러오지 못했어요.',
        })
      }
    }

    void loadStats()

    return () => controller.abort()
  }, [userId])

  const genreDistribution = useMemo(() => getTopEntries(state.item?.genreDistribution ?? {}), [state.item?.genreDistribution])
  const genreWatchMinutes = useMemo(() => getTopEntries(state.item?.genreWatchMinutes ?? {}), [state.item?.genreWatchMinutes])
  const genreAvgScore = useMemo(() => getTopEntries(state.item?.genreAvgScore ?? {}), [state.item?.genreAvgScore])
  const releaseDistribution = useMemo(() => getTopEntries(state.item?.releaseYearDistribution ?? {}), [state.item?.releaseYearDistribution])
  const scoreDistribution = useMemo(
    () => Object.entries(state.item?.scoreDistribution ?? {}).sort(([left], [right]) => Number(left) - Number(right)),
    [state.item?.scoreDistribution],
  )

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
        <div className="feedback-card is-error">{state.error ?? '분석 정보를 찾을 수 없어요.'}</div>
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
          <span className="section-kicker">Friend analysis</span>
          <h1>{user.username}님의 애니 취향 분석</h1>
          <p>{item.preferenceSummary || '이 유저의 공개 컬렉션을 바탕으로 취향 분석을 정리해드려요.'}</p>
          <span className="analysis-updated-at">마지막 계산 {formatUpdatedAt(item.updatedAt)}</span>
        </div>

        <div className="analysis-hero-actions user-analysis-actions">
          <Link className="secondary-button" to={`/users/${userId}/anime-list`}>
            컬렉션 보기
          </Link>
        </div>
      </div>

      <div className="analysis-summary-grid">
        <article className="analysis-summary-card">
          <span>선호 장르</span>
          <strong>{getGenreLabel(item.favoriteGenre)}</strong>
        </article>
        <article className="analysis-summary-card">
          <span>선호 시기</span>
          <strong>{item.favoriteReleasePeriod || '정보 없음'}</strong>
        </article>
        <article className="analysis-summary-card">
          <span>평균 점수</span>
          <strong>{averageScore !== null ? `${averageScore.toFixed(1)} / 10` : '미집계'}</strong>
        </article>
        <article className="analysis-summary-card">
          <span>총 시청 시간</span>
          <strong>{formatWatchHours(item.totalWatchMinutes)}</strong>
        </article>
      </div>

      <div className="analysis-panel-grid">
        <section className="analysis-panel">
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
            <article><span>평균 방영 연도</span><strong>{averageReleaseYear !== null ? averageReleaseYear.toFixed(1) : '정보 없음'}</strong></article>
          </div>
        </section>

        <section className="analysis-panel">
          <div className="analysis-panel-heading"><span className="detail-label">Genre</span><h2>장르 분포</h2></div>
          <div className="analysis-bar-list">
            {genreDistribution.length > 0 ? genreDistribution.map(([genre, count]) => {
              const maxValue = getMaxValue(genreDistribution)
              const width = maxValue > 0 ? `${(count / maxValue) * 100}%` : '0%'
              return (
                <div className="analysis-bar-item" key={`distribution-${genre}`}>
                  <div className="analysis-bar-header"><span>{getGenreLabel(genre)}</span><strong>{count}편</strong></div>
                  <div className="analysis-bar-track"><div className="analysis-bar-fill" style={{ width }} /></div>
                </div>
              )
            }) : renderEmptyMessage('아직 장르 분포 데이터가 없어요.')}
          </div>
        </section>

        <section className="analysis-panel">
          <div className="analysis-panel-heading"><span className="detail-label">Watch time</span><h2>장르별 시청 시간</h2></div>
          <div className="analysis-bar-list">
            {genreWatchMinutes.length > 0 ? genreWatchMinutes.map(([genre, minutes]) => {
              const maxValue = getMaxValue(genreWatchMinutes)
              const width = maxValue > 0 ? `${(minutes / maxValue) * 100}%` : '0%'
              return (
                <div className="analysis-bar-item" key={`minutes-${genre}`}>
                  <div className="analysis-bar-header"><span>{getGenreLabel(genre)}</span><strong>{formatWatchHours(minutes)}</strong></div>
                  <div className="analysis-bar-track"><div className="analysis-bar-fill is-soft" style={{ width }} /></div>
                </div>
              )
            }) : renderEmptyMessage('아직 장르별 시청 시간 데이터가 없어요.')}
          </div>
        </section>

        <section className="analysis-panel">
          <div className="analysis-panel-heading"><span className="detail-label">Genre score</span><h2>장르별 평균 점수</h2></div>
          <div className="analysis-list">
            {genreAvgScore.length > 0 ? genreAvgScore.map(([genre, score]) => (
              <article className="analysis-list-row" key={`score-${genre}`}>
                <span>{getGenreLabel(genre)}</span>
                <strong>{toFiniteNumber(score)?.toFixed(1) ?? '0.0'} / 10</strong>
              </article>
            )) : renderEmptyMessage('아직 장르별 평균 점수 데이터가 없어요.')}
          </div>
        </section>

        <section className="analysis-panel">
          <div className="analysis-panel-heading"><span className="detail-label">Release period</span><h2>선호 시기</h2></div>
          <div className="analysis-bar-list">
            {releaseDistribution.length > 0 ? releaseDistribution.map(([year, count]) => {
              const maxValue = getMaxValue(releaseDistribution)
              const width = maxValue > 0 ? `${(count / maxValue) * 100}%` : '0%'
              return (
                <div className="analysis-bar-item" key={`release-${year}`}>
                  <div className="analysis-bar-header"><span>{year}년대</span><strong>{count}편</strong></div>
                  <div className="analysis-bar-track"><div className="analysis-bar-fill is-dark" style={{ width }} /></div>
                </div>
              )
            }) : renderEmptyMessage('아직 시기 분포 데이터가 없어요.')}
          </div>
        </section>

        <section className="analysis-panel">
          <div className="analysis-panel-heading"><span className="detail-label">Score distribution</span><h2>평점 분포</h2></div>
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
