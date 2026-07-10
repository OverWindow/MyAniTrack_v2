import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ConnectionErrorState } from './ConnectionErrorState'
import {
  getAnalysisCache,
  getAnalysisCacheKey,
  setAnalysisCache,
} from '../lib/analysisCache'
import { getProfileImageSrc, handleProfileImageError } from '../lib/avatar'
import { SERVER_CONNECTION_ERROR_MESSAGE, getFriendlyErrorMessage } from '../lib/errors'
import { fetchVoiceActorRanking } from '../lib/stats'
import type {
  VoiceActorPersonName,
  VoiceActorRankingItem,
  VoiceActorRankingSort,
} from '../types/stats'

type VoiceActorRankingSectionProps = {
  cacheOwnerId?: number | string | null
  cacheVersion?: number
  userId?: string
  ownerLabel?: string
}

type RankingState = {
  count: VoiceActorRankingItem[]
  score: VoiceActorRankingItem[]
  isLoading: boolean
  error: string | null
}

function getPersonName(name?: VoiceActorPersonName | null) {
  return name?.userPreferred || name?.full || name?.native || '이름 정보 없음'
}

function getVoiceActorImage(item: VoiceActorRankingItem) {
  return item.voiceActor.image.large || item.voiceActor.image.medium || null
}

function getRankingMeta(item: VoiceActorRankingItem, sort: VoiceActorRankingSort) {
  if (sort === 'score') {
    return `평균 ${item.averageScore !== null ? item.averageScore.toFixed(2) : '-'}점 · 평가 ${item.ratedAnimeCount}편`
  }

  return `${item.animeCount}편 · 캐릭터 ${item.characterCount}명`
}

function VoiceActorRankingList({
  items,
  sort,
}: {
  items: VoiceActorRankingItem[]
  sort: VoiceActorRankingSort
}) {
  if (items.length === 0) {
    return <div className="analysis-empty-state">아직 표시할 성우 랭킹이 없어요.</div>
  }

  return (
    <div className="voice-actor-ranking-list">
      {items.map((item, index) => {
        const name = getPersonName(item.voiceActor.name)
        const rank = index + 1
        const rankClassName = rank <= 3 ? ` is-top-rank is-rank-${rank}` : ''

        return (
          <Link
            className={`voice-actor-ranking-card${rankClassName}`}
            key={`${sort}-${item.voiceActor.id}`}
            to={`/voice-actors/${item.voiceActor.id}`}
          >
            <span className="voice-actor-rank">{rank}위</span>
            <img
              className="voice-actor-avatar"
              src={getProfileImageSrc(getVoiceActorImage(item))}
              alt={name}
              loading="lazy"
              onError={handleProfileImageError}
            />
            <span className="voice-actor-ranking-copy">
              <strong>{name}</strong>
              <small>{getRankingMeta(item, sort)}</small>
            </span>
          </Link>
        )
      })}
    </div>
  )
}

export function VoiceActorRankingSection({
  cacheOwnerId,
  cacheVersion = 0,
  userId,
  ownerLabel = '이 사용자',
}: VoiceActorRankingSectionProps) {
  const [rankingState, setRankingState] = useState<RankingState>({
    count: [],
    score: [],
    isLoading: true,
    error: null,
  })

  useEffect(() => {
    if (!cacheOwnerId && !userId) {
      return
    }

    const controller = new AbortController()
    let isCancelled = false

    const loadRanking = async () => {
      setRankingState((current) => ({ ...current, isLoading: true, error: null }))
      const cacheKey = cacheOwnerId ? getAnalysisCacheKey(cacheOwnerId, 'voiceActorRanking') : null

      try {
        const cached = cacheKey
          ? await getAnalysisCache<{ count: VoiceActorRankingItem[], score: VoiceActorRankingItem[] }>(cacheKey)
          : null

        if (isCancelled || controller.signal.aborted) {
          return
        }

        if (cached) {
          setRankingState({ count: cached.count, score: cached.score, isLoading: false, error: null })
          return
        }

        const [count, score] = await Promise.all([
          fetchVoiceActorRanking({
            userId,
            sort: 'count',
            limit: 20,
            signal: controller.signal,
          }),
          fetchVoiceActorRanking({
            userId,
            sort: 'score',
            minRatedAnimeCount: 3,
            limit: 20,
            signal: controller.signal,
          }),
        ])

        if (isCancelled || controller.signal.aborted) {
          return
        }

        if (cacheKey) {
          await setAnalysisCache(cacheKey, { count, score })
        }

        setRankingState({ count, score, isLoading: false, error: null })
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') {
          return
        }

        setRankingState({
          count: [],
          score: [],
          isLoading: false,
          error: getFriendlyErrorMessage(loadError, '성우 랭킹을 불러오지 못했어요.'),
        })
      }
    }

    void loadRanking()

    return () => {
      isCancelled = true
      controller.abort()
    }
  }, [cacheOwnerId, cacheVersion, userId])

  return (
    <section className="analysis-panel voice-actor-section">
      <div className="analysis-panel-heading">
        <span className="detail-label">Voice actors</span>
        <h2>성우 취향 랭킹</h2>
        <p>{ownerLabel} 컬렉션 기준으로 가장 많이 본 성우와 평균 평점이 높은 성우를 보여줘요.</p>
      </div>

      {rankingState.isLoading && <div className="analysis-empty-state">성우 랭킹을 불러오는 중이에요.</div>}
      {rankingState.error && !rankingState.isLoading && (
        rankingState.error === SERVER_CONNECTION_ERROR_MESSAGE
          ? <ConnectionErrorState message={rankingState.error} />
          : <div className="analysis-empty-state">{rankingState.error}</div>
      )}

      {!rankingState.isLoading && !rankingState.error && (
        <div className="voice-actor-ranking-grid">
          <div>
            <div className="voice-actor-ranking-heading">
              <strong>가장 많이 본 성우</strong>
              <span>출연 애니 수 기준</span>
            </div>
            <VoiceActorRankingList
              items={rankingState.count}
              sort="count"
            />
          </div>

          <div>
            <div className="voice-actor-ranking-heading">
              <strong>평점이 높은 성우</strong>
              <span>평가 작품 3편 이상 기준</span>
            </div>
            <VoiceActorRankingList
              items={rankingState.score}
              sort="score"
            />
          </div>
        </div>
      )}
    </section>
  )
}
