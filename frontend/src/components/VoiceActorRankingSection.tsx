import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { ConnectionErrorState } from './ConnectionErrorState'
import { ErrorToast } from './ErrorToast'
import { VoiceActorCharacterWorks } from './VoiceActorCharacterWorks'
import {
  getAnalysisCache,
  getAnalysisCacheKey,
  setAnalysisCache,
} from '../lib/analysisCache'
import { getProfileImageSrc, handleProfileImageError } from '../lib/avatar'
import { getFriendlyErrorMessage } from '../lib/errors'
import { fetchVoiceActorAnime, fetchVoiceActorRanking } from '../lib/stats'
import { groupVoiceActorCharacterWorks } from '../lib/voiceActorCharacterWorks'
import type {
  VoiceActorAnimeResponse,
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

type VoiceActorAnimeState = {
  data: VoiceActorAnimeResponse | null
  isLoading: boolean
  isLoadingMore: boolean
  error: string | null
  moreError: string | null
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

function getCharacterImage(character: VoiceActorAnimeResponse['items'][number]['characters'][number]) {
  return character.image.large || character.image.medium || null
}

function getAnimeImage(item: VoiceActorAnimeResponse['items'][number]) {
  return item.anime.coverImageExtraLarge || item.anime.coverImageLarge || null
}

function getAnimeMeta(item: VoiceActorAnimeResponse['items'][number]) {
  return [
    item.anime.seasonYear ? String(item.anime.seasonYear) : null,
    item.anime.format,
    item.userList?.score !== null && item.userList?.score !== undefined
      ? `내 평점 ${item.userList.score}점`
      : '평점 없음',
  ].filter(Boolean).join(' · ')
}

function VoiceActorRankingList({
  items,
  sort,
  selectedVoiceActorId,
  onSelect,
}: {
  items: VoiceActorRankingItem[]
  sort: VoiceActorRankingSort
  selectedVoiceActorId?: number | null
  onSelect: (item: VoiceActorRankingItem) => void
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
        const activeClassName = selectedVoiceActorId === item.voiceActor.id ? ' is-active' : ''

        return (
          <button
            className={`voice-actor-ranking-card${rankClassName}${activeClassName}`}
            key={`${sort}-${item.voiceActor.id}`}
            type="button"
            aria-haspopup="dialog"
            aria-label={`${name} 내가 본 작품 보기`}
            onClick={() => onSelect(item)}
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
          </button>
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
  const [selectedVoiceActor, setSelectedVoiceActor] = useState<VoiceActorRankingItem['voiceActor'] | null>(null)
  const [animeState, setAnimeState] = useState<VoiceActorAnimeState>({
    data: null,
    isLoading: false,
    isLoadingMore: false,
    error: null,
    moreError: null,
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

  useEffect(() => {
    if (!selectedVoiceActor) {
      return
    }

    const controller = new AbortController()
    let isCancelled = false

    const loadAnime = async () => {
      setAnimeState({
        data: null,
        isLoading: true,
        isLoadingMore: false,
        error: null,
        moreError: null,
      })

      const cacheKey = cacheOwnerId
        ? getAnalysisCacheKey(cacheOwnerId, 'voiceActorAnime', `${selectedVoiceActor.id}:completed`)
        : null

      try {
        const cached = cacheKey
          ? await getAnalysisCache<VoiceActorAnimeResponse>(cacheKey)
          : null

        if (isCancelled || controller.signal.aborted) {
          return
        }

        if (cached) {
          setAnimeState({
            data: cached,
            isLoading: false,
            isLoadingMore: false,
            error: null,
            moreError: null,
          })
          return
        }

        const data = await fetchVoiceActorAnime({
          userId,
          voiceActorId: selectedVoiceActor.id,
          titleLanguage: 'ko',
          status: 'completed',
          limit: 20,
          signal: controller.signal,
        })

        if (isCancelled || controller.signal.aborted) {
          return
        }

        if (cacheKey) {
          await setAnalysisCache(cacheKey, data)
        }

        setAnimeState({
          data,
          isLoading: false,
          isLoadingMore: false,
          error: null,
          moreError: null,
        })
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') {
          return
        }

        setAnimeState({
          data: null,
          isLoading: false,
          isLoadingMore: false,
          error: getFriendlyErrorMessage(loadError, '성우의 작품 목록을 불러오지 못했어요.'),
          moreError: null,
        })
      }
    }

    void loadAnime()

    return () => {
      isCancelled = true
      controller.abort()
    }
  }, [cacheOwnerId, cacheVersion, selectedVoiceActor, userId])

  useEffect(() => {
    if (!selectedVoiceActor) {
      return
    }

    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedVoiceActor(null)
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [selectedVoiceActor])

  const handleLoadMore = async () => {
    if (
      !selectedVoiceActor
      || !animeState.data?.pageInfo.hasNext
      || !animeState.data.pageInfo.nextCursor
      || animeState.isLoadingMore
    ) {
      return
    }

    setAnimeState((current) => ({ ...current, isLoadingMore: true, moreError: null }))

    try {
      const nextData = await fetchVoiceActorAnime({
        userId,
        voiceActorId: selectedVoiceActor.id,
        titleLanguage: animeState.data.pageInfo.titleLanguage,
        status: 'completed',
        limit: animeState.data.pageInfo.limit,
        cursor: animeState.data.pageInfo.nextCursor,
      })

      const mergedData: VoiceActorAnimeResponse = {
        ...nextData,
        items: [...animeState.data.items, ...nextData.items],
      }

      if (cacheOwnerId) {
        await setAnalysisCache(
          getAnalysisCacheKey(cacheOwnerId, 'voiceActorAnime', `${selectedVoiceActor.id}:completed`),
          mergedData,
        )
      }

      setAnimeState({
        data: mergedData,
        isLoading: false,
        isLoadingMore: false,
        error: null,
        moreError: null,
      })
    } catch (loadError) {
      setAnimeState((current) => ({
        ...current,
        isLoadingMore: false,
        moreError: getFriendlyErrorMessage(loadError, '작품을 더 불러오지 못했어요.'),
      }))
    }
  }

  const selectedVoiceActorName = getPersonName(selectedVoiceActor?.name)
  const selectedCharacterGroups = groupVoiceActorCharacterWorks(animeState.data?.items.flatMap((item) => (
    item.characters.map((character) => ({
      character: {
        id: character.id,
        name: getPersonName(character.name),
        nativeName: character.name.native,
        image: getCharacterImage(character),
        meta: character.role || null,
      },
      work: {
        id: item.anime.id,
        title: item.anime.title,
        image: getAnimeImage(item),
        label: 'Completed',
        meta: getAnimeMeta(item),
      },
    }))
  )) ?? [])
  const selectedCharacterCount = selectedCharacterGroups.length

  return (
    <section className="analysis-panel voice-actor-section">
      <div className="analysis-panel-heading">
        <span className="detail-label">Voice actors</span>
        <h2>성우 취향 랭킹</h2>
        <p>{ownerLabel} 컬렉션 기준으로 가장 많이 본 성우와 평균 평점이 높은 성우를 보여줘요.</p>
      </div>

      {rankingState.isLoading && <div className="analysis-empty-state">성우 랭킹을 불러오는 중이에요.</div>}
      {rankingState.error && !rankingState.isLoading && (
        <ConnectionErrorState message={rankingState.error} />
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
              selectedVoiceActorId={selectedVoiceActor?.id}
              onSelect={(item) => setSelectedVoiceActor(item.voiceActor)}
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
              selectedVoiceActorId={selectedVoiceActor?.id}
              onSelect={(item) => setSelectedVoiceActor(item.voiceActor)}
            />
          </div>
        </div>
      )}

      {selectedVoiceActor && createPortal(
        <div
          className="voice-actor-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedVoiceActor(null)
            }
          }}
        >
          <section
            className="voice-actor-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="voice-actor-modal-title"
          >
            <header className="voice-actor-modal-header">
              <Link
                className="voice-actor-modal-profile-link"
                to={`/voice-actors/${selectedVoiceActor.id}`}
                aria-label={`${selectedVoiceActorName} 성우 상세 페이지로 이동`}
                onClick={() => setSelectedVoiceActor(null)}
              >
                <img
                  src={getProfileImageSrc(selectedVoiceActor.image.large || selectedVoiceActor.image.medium || null)}
                  alt={selectedVoiceActorName}
                  onError={handleProfileImageError}
                />
                <div className="voice-actor-modal-profile-copy">
                  <span className="detail-label">Completed works</span>
                  <h3 id="voice-actor-modal-title">{selectedVoiceActorName}</h3>
                  <p>
                    {animeState.data
                      ? `${ownerLabel}가 본 작품 ${animeState.data.items.length.toLocaleString()}편 · 캐릭터 ${selectedCharacterCount.toLocaleString()}명`
                      : `${ownerLabel}가 본 작품에서 맡은 캐릭터를 모아봐요.`}
                  </p>
                </div>
              </Link>
              <button
                className="voice-actor-modal-close"
                type="button"
                aria-label="성우 작품 모달 닫기"
                autoFocus
                onClick={() => setSelectedVoiceActor(null)}
              >
                ×
              </button>
            </header>

            <div className="voice-actor-modal-body">
              {animeState.isLoading && (
                <div className="analysis-empty-state">내가 본 작품을 불러오는 중이에요.</div>
              )}

              {animeState.error && !animeState.isLoading && (
                <ConnectionErrorState message={animeState.error} />
              )}

              {!animeState.isLoading && !animeState.error && selectedCharacterGroups.length === 0 && (
                <div className="analysis-empty-state">이 성우가 출연한 완주 작품이 아직 없어요.</div>
              )}

              {!animeState.isLoading && !animeState.error && selectedCharacterGroups.length > 0 && (
                <div className="voice-actor-modal-work-list">
                  <VoiceActorCharacterWorks
                    key={selectedVoiceActor.id}
                    groups={selectedCharacterGroups}
                    variant="modal"
                    onNavigate={() => setSelectedVoiceActor(null)}
                  />
                </div>
              )}

              {animeState.moreError && (
                <ErrorToast message={animeState.moreError} />
              )}

              {animeState.data?.pageInfo.hasNext && (
                <button
                  className="voice-actor-more-button voice-actor-modal-more"
                  type="button"
                  disabled={animeState.isLoadingMore}
                  onClick={() => { void handleLoadMore() }}
                >
                  {animeState.isLoadingMore ? '불러오는 중...' : '작품 더 보기'}
                </button>
              )}
            </div>
          </section>
        </div>,
        document.body,
      )}
    </section>
  )
}
