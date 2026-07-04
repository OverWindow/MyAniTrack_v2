import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getAnalysisCache,
  getAnalysisCacheKey,
  setAnalysisCache,
} from '../lib/analysisCache'
import { getProfileImageSrc, handleProfileImageError } from '../lib/avatar'
import { fetchVoiceActorAnime, fetchVoiceActorRanking } from '../lib/stats'
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

type DetailState = {
  selected: VoiceActorRankingItem | null
  item: VoiceActorAnimeResponse | null
  isLoading: boolean
  error: string | null
}

type CharacterAppearance = {
  id: number
  name: string
  imageUrl: string | null
  role?: string | null
  works: Array<{
    id: number
    title: string
    score?: number | null
    progress?: number | null
  }>
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

function getCharacterAppearances(detail: VoiceActorAnimeResponse) {
  const characterMap = new Map<number, CharacterAppearance>()

  for (const entry of detail.items) {
    for (const character of entry.characters) {
      const characterName = getPersonName(character.name)
      const current = characterMap.get(character.id) ?? {
        id: character.id,
        name: characterName,
        imageUrl: getCharacterImage(character),
        role: character.role,
        works: [],
      }

      if (!current.works.some((work) => work.id === entry.anime.id)) {
        current.works.push({
          id: entry.anime.id,
          title: entry.anime.title,
          score: entry.userList?.score,
          progress: entry.userList?.progress,
        })
      }

      characterMap.set(character.id, current)
    }
  }

  return Array.from(characterMap.values()).sort((left, right) => {
    if (right.works.length !== left.works.length) {
      return right.works.length - left.works.length
    }

    return left.name.localeCompare(right.name)
  })
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
          const rank = index + 1
          const rankClassName = rank <= 3 ? ` is-top-rank is-rank-${rank}` : ''

          return (
            <button
              className={`${selectedId === item.voiceActor.id ? 'voice-actor-ranking-card is-active' : 'voice-actor-ranking-card'}${rankClassName}`}
              key={`${sort}-${item.voiceActor.id}`}
              type="button"
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

      {hasMore && (
        <button className="voice-actor-more-button" type="button" onClick={onToggleExpanded}>
          {isExpanded ? '접기' : `더보기 ${items.length - INITIAL_VISIBLE_RANKING_COUNT}명`}
        </button>
      )}
    </>
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
  const [openCharacterWorksId, setOpenCharacterWorksId] = useState<number | null>(null)
  const detailRequestIdRef = useRef(0)

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
          error: loadError instanceof Error ? loadError.message : '성우 랭킹을 불러오지 못했어요.',
        })
      }
    }

    void loadRanking()

    return () => {
      isCancelled = true
      controller.abort()
    }
  }, [cacheOwnerId, cacheVersion, userId])

  const closeDetailModal = () => {
    detailRequestIdRef.current += 1
    setDetailState({
      selected: null,
      item: null,
      isLoading: false,
      error: null,
    })
    setOpenCharacterWorksId(null)
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
    setOpenCharacterWorksId(null)

    try {
      const cacheKey = cacheOwnerId ? getAnalysisCacheKey(cacheOwnerId, 'voiceActorAnime', String(item.voiceActor.id)) : null
      const cached = cacheKey ? await getAnalysisCache<VoiceActorAnimeResponse>(cacheKey) : null

      if (detailRequestIdRef.current !== requestId) {
        return
      }

      if (cached) {
        setDetailState({
          selected: item,
          item: cached,
          isLoading: false,
          error: null,
        })
        return
      }

      const detail = await fetchVoiceActorAnime({
        userId,
        voiceActorId: item.voiceActor.id,
        titleLanguage: 'ko',
        limit: 20,
      })

      if (detailRequestIdRef.current !== requestId) {
        return
      }

      if (cacheKey) {
        await setAnalysisCache(cacheKey, detail)
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
  const characterAppearances = detailState.item ? getCharacterAppearances(detailState.item) : []

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
            {!detailState.isLoading && !detailState.error && characterAppearances.length === 0 && (
              <div className="analysis-empty-state">표시할 캐릭터 정보가 없어요.</div>
            )}
            {!detailState.isLoading && !detailState.error && characterAppearances.length > 0 && (
              <div className="voice-actor-character-result-list">
                {characterAppearances.map((character) => {
                  const singleWork = character.works.length === 1 ? character.works[0] : null

                  return (
                    <article className="voice-actor-character-result-card" key={character.id}>
                      <img
                        src={getProfileImageSrc(character.imageUrl)}
                        alt={character.name}
                        loading="lazy"
                        onError={handleProfileImageError}
                      />
                      <div className="voice-actor-character-result-copy">
                        <strong>{character.name}</strong>
                        {singleWork ? (
                          <Link to={`/anime/${singleWork.id}`}>{singleWork.title}</Link>
                        ) : (
                          <span>{character.works.length.toLocaleString()}개 작품</span>
                        )}
                        {character.role && <small>{character.role}</small>}
                      </div>

                      {!singleWork && (
                        <div className="voice-actor-character-menu-wrap">
                          <button
                            className="voice-actor-character-menu-button"
                            type="button"
                            aria-label={`${character.name} 출연 작품 보기`}
                            aria-expanded={openCharacterWorksId === character.id}
                            onClick={() => setOpenCharacterWorksId((current) => (current === character.id ? null : character.id))}
                          >
                            •••
                          </button>

                          {openCharacterWorksId === character.id && (
                            <div className="voice-actor-character-menu" role="menu">
                              {character.works.map((work) => (
                                <Link key={work.id} to={`/anime/${work.id}`} role="menuitem">
                                  <strong>{work.title}</strong>
                                  <span>
                                    {work.score !== null && work.score !== undefined
                                      ? `${Number(work.score).toFixed(1)}점`
                                      : '미평점'}
                                    {work.progress !== null && work.progress !== undefined
                                      ? ` · ${work.progress}화`
                                      : ''}
                                  </span>
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </article>
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
