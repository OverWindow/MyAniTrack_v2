import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getProfileImageSrc, handleProfileImageError } from '../lib/avatar'
import { fetchVoiceActorAnime, fetchVoiceActorRanking } from '../lib/stats'
import type {
  VoiceActorAnimeResponse,
  VoiceActorPersonName,
  VoiceActorRankingItem,
  VoiceActorRankingSort,
} from '../types/stats'

type VoiceActorRankingSectionProps = {
  userId?: string
  ownerLabel?: string
}

type RankingState = {
  count: VoiceActorRankingItem[]
  score: VoiceActorRankingItem[]
  isLoading: boolean
  error: string | null
}

type DetailState = {
  selected: VoiceActorRankingItem | null
  item: VoiceActorAnimeResponse | null
  isLoading: boolean
  error: string | null
}

const INITIAL_VISIBLE_RANKING_COUNT = 5

function getPersonName(name?: VoiceActorPersonName | null) {
  return name?.userPreferred || name?.full || name?.native || '이름 정보 없음'
}

function getVoiceActorImage(item: VoiceActorRankingItem | VoiceActorAnimeResponse) {
  return item.voiceActor.image.large || item.voiceActor.image.medium || null
}

function getCharacterImage(character: VoiceActorAnimeResponse['items'][number]['characters'][number]) {
  return character.image.large || character.image.medium || null
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
  selectedId,
  isExpanded,
  onToggleExpanded,
  onSelect,
}: {
  items: VoiceActorRankingItem[]
  sort: VoiceActorRankingSort
  selectedId?: number
  isExpanded: boolean
  onToggleExpanded: () => void
  onSelect: (item: VoiceActorRankingItem) => void
}) {
  if (items.length === 0) {
    return <div className="analysis-empty-state">아직 표시할 성우 랭킹이 없어요.</div>
  }

  const visibleItems = isExpanded ? items : items.slice(0, INITIAL_VISIBLE_RANKING_COUNT)
  const hasMore = items.length > INITIAL_VISIBLE_RANKING_COUNT

  return (
    <>
      <div className="voice-actor-ranking-list">
        {visibleItems.map((item, index) => {
          const name = getPersonName(item.voiceActor.name)

          return (
            <button
              className={selectedId === item.voiceActor.id ? 'voice-actor-ranking-card is-active' : 'voice-actor-ranking-card'}
              key={`${sort}-${item.voiceActor.id}`}
              type="button"
              onClick={() => onSelect(item)}
            >
              <span className="voice-actor-rank">#{index + 1}</span>
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

      {hasMore && (
        <button className="voice-actor-more-button" type="button" onClick={onToggleExpanded}>
          {isExpanded ? '접기' : `더보기 ${items.length - INITIAL_VISIBLE_RANKING_COUNT}명`}
        </button>
      )}
    </>
  )
}

export function VoiceActorRankingSection({ userId, ownerLabel = '이 사용자' }: VoiceActorRankingSectionProps) {
  const [rankingState, setRankingState] = useState<RankingState>({
    count: [],
    score: [],
    isLoading: true,
    error: null,
  })
  const [detailState, setDetailState] = useState<DetailState>({
    selected: null,
    item: null,
    isLoading: false,
    error: null,
  })
  const [expandedRankings, setExpandedRankings] = useState<Record<VoiceActorRankingSort, boolean>>({
    count: false,
    score: false,
  })
  const detailRequestIdRef = useRef(0)

  useEffect(() => {
    const controller = new AbortController()

    const loadRanking = async () => {
      setRankingState((current) => ({ ...current, isLoading: true, error: null }))

      try {
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

        setRankingState({ count, score, isLoading: false, error: null })
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') {
          return
        }

        setRankingState({
          count: [],
          score: [],
          isLoading: false,
          error: loadError instanceof Error ? loadError.message : '성우 랭킹을 불러오지 못했어요.',
        })
      }
    }

    void loadRanking()

    return () => controller.abort()
  }, [userId])

  const closeDetailModal = () => {
    detailRequestIdRef.current += 1
    setDetailState({
      selected: null,
      item: null,
      isLoading: false,
      error: null,
    })
  }

  useEffect(() => {
    if (!detailState.selected) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeDetailModal()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [detailState.selected])

  const handleSelect = async (item: VoiceActorRankingItem) => {
    const requestId = detailRequestIdRef.current + 1
    detailRequestIdRef.current = requestId

    setDetailState({
      selected: item,
      item: null,
      isLoading: true,
      error: null,
    })

    try {
      const detail = await fetchVoiceActorAnime({
        userId,
        voiceActorId: item.voiceActor.id,
        titleLanguage: 'ko',
        limit: 20,
      })

      if (detailRequestIdRef.current !== requestId) {
        return
      }

      setDetailState({
        selected: item,
        item: detail,
        isLoading: false,
        error: null,
      })
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') {
        return
      }

      if (detailRequestIdRef.current !== requestId) {
        return
      }

      setDetailState({
        selected: item,
        item: null,
        isLoading: false,
        error: loadError instanceof Error ? loadError.message : '성우 상세 작품을 불러오지 못했어요.',
      })
    }
  }

  const selectedName = detailState.selected
    ? getPersonName(detailState.selected.voiceActor.name)
    : null

  return (
    <section className="analysis-panel voice-actor-section">
      <div className="analysis-panel-heading">
        <span className="detail-label">Voice actors</span>
        <h2>성우 취향 랭킹</h2>
        <p>{ownerLabel} 컬렉션 기준으로 가장 많이 본 성우와 평균 평점이 높은 성우를 보여줘요.</p>
      </div>

      {rankingState.isLoading && <div className="analysis-empty-state">성우 랭킹을 불러오는 중이에요.</div>}
      {rankingState.error && !rankingState.isLoading && (
        <div className="analysis-empty-state">{rankingState.error}</div>
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
              selectedId={detailState.selected?.voiceActor.id}
              isExpanded={expandedRankings.count}
              onToggleExpanded={() => setExpandedRankings((current) => ({ ...current, count: !current.count }))}
              onSelect={(item) => {
                void handleSelect(item)
              }}
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
              selectedId={detailState.selected?.voiceActor.id}
              isExpanded={expandedRankings.score}
              onToggleExpanded={() => setExpandedRankings((current) => ({ ...current, score: !current.score }))}
              onSelect={(item) => {
                void handleSelect(item)
              }}
            />
          </div>
        </div>
      )}

      {detailState.selected && (
        <div className="voice-actor-modal-backdrop" role="presentation" onMouseDown={closeDetailModal}>
          <section
            className="voice-actor-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="voice-actor-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="voice-actor-detail-heading">
              <img
                className="voice-actor-avatar"
                src={getProfileImageSrc(getVoiceActorImage(detailState.item ?? detailState.selected))}
                alt={selectedName ?? '성우'}
                loading="lazy"
                onError={handleProfileImageError}
              />
              <div>
                <span className="detail-label">Selected voice actor</span>
                <h3 id="voice-actor-modal-title">{selectedName}</h3>
              </div>
              <button
                className="voice-actor-modal-close"
                type="button"
                aria-label="성우 상세 닫기"
                onClick={closeDetailModal}
              >
                ×
              </button>
            </div>

            {detailState.isLoading && <div className="analysis-empty-state">출연 작품을 불러오는 중이에요.</div>}
            {detailState.error && !detailState.isLoading && (
              <div className="analysis-empty-state">{detailState.error}</div>
            )}
            {!detailState.isLoading && !detailState.error && detailState.item?.items.length === 0 && (
              <div className="analysis-empty-state">표시할 출연 작품이 없어요.</div>
            )}
            {!detailState.isLoading && !detailState.error && detailState.item && detailState.item.items.length > 0 && (
              <div className="voice-actor-anime-list">
                {detailState.item.items.map((entry) => {
                  const characterNames = entry.characters.map((character) => getPersonName(character.name)).join(', ')

                  return (
                    <Link className="voice-actor-anime-card" key={entry.anime.id} to={`/anime/${entry.anime.id}`}>
                      {entry.characters.length > 0 && (
                        <div className="voice-actor-character-list" aria-label="연기한 캐릭터">
                          {entry.characters.slice(0, 4).map((character) => {
                            const characterName = getPersonName(character.name)

                            return (
                              <span className="voice-actor-character-chip" key={character.id}>
                                <img
                                  src={getProfileImageSrc(getCharacterImage(character))}
                                  alt={characterName}
                                  loading="lazy"
                                  onError={handleProfileImageError}
                                />
                                <span>{characterName}</span>
                              </span>
                            )
                          })}
                        </div>
                      )}
                      <div className="voice-actor-anime-copy">
                        <strong>{entry.anime.title}</strong>
                        <span>{characterNames || '캐릭터 정보 없음'}</span>
                        <small>
                          {entry.userList?.score !== null && entry.userList?.score !== undefined
                            ? `${Number(entry.userList.score).toFixed(1)}점`
                            : '미평점'}
                          {entry.userList?.progress !== null && entry.userList?.progress !== undefined
                            ? ` · ${entry.userList.progress}화`
                            : ''}
                        </small>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  )
}
