import { getLocaleTag } from '../i18n'
import { getTitleLanguage, tr } from '../i18n'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ConnectionErrorState } from '../components/ConnectionErrorState'
import { ErrorToast } from '../components/ErrorToast'
import { VoiceActorCharacterWorks } from '../components/VoiceActorCharacterWorks'
import { useAuth } from '../contexts/AuthContext'
import { getProfileImageSrc, handleProfileImageError } from '../lib/avatar'
import { getFriendlyErrorMessage } from '../lib/errors'
import { fetchVoiceActorAnime } from '../lib/stats'
import { groupVoiceActorCharacterWorks } from '../lib/voiceActorCharacterWorks'
import {
  fetchVoiceActorDetail,
  getVoiceActorDisplayName,
  getVoiceActorImage,
} from '../lib/voiceActors'
import type { VoiceActorDetailItem, VoiceActorDetailPayload } from '../types/voiceActor'
import type { VoiceActorAnimeItem, VoiceActorAnimeResponse } from '../types/stats'
import '../styles/pages/VoiceActorDetailPage.css'

type VoiceActorDetailState = {
  item: VoiceActorDetailPayload | null
  isLoading: boolean
  isLoadingMore: boolean
  error: string | null
  moreError: string | null
}

type CreditFilter = 'all' | 'completed'

type WatchedCreditState = {
  items: VoiceActorAnimeItem[]
  pageInfo: VoiceActorAnimeResponse['pageInfo'] | null
  isLoading: boolean
  isLoadingMore: boolean
  error: string | null
  moreError: string | null
}

const DETAIL_LIMIT = 20

function stripHtml(value?: string | null) {
  if (!value) {
    return ''
  }

  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function getAnimeImage(item: VoiceActorDetailItem) {
  return item.anime.coverImageExtraLarge || item.anime.coverImageLarge || null
}

function getAnimeMeta(item: VoiceActorDetailItem) {
  return [
    item.anime.seasonYear ? String(item.anime.seasonYear) : null,
    item.anime.format,
    item.anime.averageScore !== null && item.anime.averageScore !== undefined
      ? tr("평균 {{v0}}점", { v0: item.anime.averageScore })
      : null,
  ].filter(Boolean).join(' · ')
}

function getCharacterMeta(item: VoiceActorDetailItem) {
  return [
    item.character.role,
    item.voiceActing.languageV2,
  ].filter(Boolean).join(' · ')
}

function getWatchedAnimeMeta(item: VoiceActorAnimeItem) {
  return [
    item.anime.seasonYear ? String(item.anime.seasonYear) : null,
    item.anime.format,
    item.userList?.score !== null && item.userList?.score !== undefined
      ? tr("내 평점 {{v0}}점", { v0: item.userList.score })
      : null,
  ].filter(Boolean).join(' · ')
}

export function VoiceActorDetailPage() {
  const { voiceActorId } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated, isBootstrapping } = useAuth()
  const [creditFilter, setCreditFilter] = useState<CreditFilter>('all')
  const [state, setState] = useState<VoiceActorDetailState>({
    item: null,
    isLoading: true,
    isLoadingMore: false,
    error: null,
    moreError: null,
  })
  const [watchedState, setWatchedState] = useState<WatchedCreditState>({
    items: [],
    pageInfo: null,
    isLoading: false,
    isLoadingMore: false,
    error: null,
    moreError: null,
  })

  useEffect(() => {
    if (!voiceActorId) {
      setState({
        item: null,
        isLoading: false,
        isLoadingMore: false,
        error: tr("성우 ID가 올바르지 않아요."),
        moreError: null,
      })
      return
    }

    const controller = new AbortController()

    const loadDetail = async () => {
      setState({
        item: null,
        isLoading: true,
        isLoadingMore: false,
        error: null,
        moreError: null,
      })

      try {
        const item = await fetchVoiceActorDetail({
          voiceActorId,
          titleLanguage: getTitleLanguage(),
          limit: DETAIL_LIMIT,
          signal: controller.signal,
        })

        if (controller.signal.aborted) {
          return
        }

        setState({
          item,
          isLoading: false,
          isLoadingMore: false,
          error: null,
          moreError: null,
        })
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }

        setState({
          item: null,
          isLoading: false,
          isLoadingMore: false,
          error: getFriendlyErrorMessage(error, tr("성우 상세 정보를 불러오지 못했어요.")),
          moreError: null,
        })
      }
    }

    void loadDetail()

    return () => controller.abort()
  }, [voiceActorId])

  useEffect(() => {
    if (creditFilter !== 'completed' || !isAuthenticated || !voiceActorId) {
      return
    }

    const controller = new AbortController()

    const loadWatchedCredits = async () => {
      setWatchedState({
        items: [],
        pageInfo: null,
        isLoading: true,
        isLoadingMore: false,
        error: null,
        moreError: null,
      })

      try {
        const result = await fetchVoiceActorAnime({
          voiceActorId: Number(voiceActorId),
          titleLanguage: getTitleLanguage(),
          status: 'completed',
          limit: DETAIL_LIMIT,
          signal: controller.signal,
        })

        if (controller.signal.aborted) {
          return
        }

        setWatchedState({
          items: result.items,
          pageInfo: result.pageInfo,
          isLoading: false,
          isLoadingMore: false,
          error: null,
          moreError: null,
        })
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }

        setWatchedState({
          items: [],
          pageInfo: null,
          isLoading: false,
          isLoadingMore: false,
          error: getFriendlyErrorMessage(error, tr("내가 본 작품을 불러오지 못했어요.")),
          moreError: null,
        })
      }
    }

    void loadWatchedCredits()

    return () => controller.abort()
  }, [creditFilter, isAuthenticated, voiceActorId])

  const handleLoadMore = async () => {
    if (!voiceActorId || !state.item?.pageInfo.hasNext || !state.item.pageInfo.nextCursor || state.isLoadingMore) {
      return
    }

    setState((current) => ({ ...current, isLoadingMore: true, moreError: null }))

    try {
      const nextItem = await fetchVoiceActorDetail({
        voiceActorId,
        titleLanguage: state.item.pageInfo.titleLanguage,
        limit: state.item.pageInfo.limit || DETAIL_LIMIT,
        cursor: state.item.pageInfo.nextCursor,
      })

      setState((current) => {
        if (!current.item) {
          return {
            item: nextItem,
            isLoading: false,
            isLoadingMore: false,
            error: null,
            moreError: null,
          }
        }

        return {
          item: {
            ...nextItem,
            items: [...current.item.items, ...nextItem.items],
          },
          isLoading: false,
          isLoadingMore: false,
          error: null,
          moreError: null,
        }
      })
    } catch (error) {
      setState((current) => ({
        ...current,
        isLoadingMore: false,
        moreError: getFriendlyErrorMessage(error, tr("더 많은 출연 정보를 불러오지 못했어요.")),
      }))
    }
  }

  const handleLoadMoreWatched = async () => {
    if (
      !voiceActorId
      || !watchedState.pageInfo?.hasNext
      || !watchedState.pageInfo.nextCursor
      || watchedState.isLoadingMore
    ) {
      return
    }

    setWatchedState((current) => ({ ...current, isLoadingMore: true, moreError: null }))

    try {
      const result = await fetchVoiceActorAnime({
        voiceActorId: Number(voiceActorId),
        titleLanguage: getTitleLanguage(),
        status: 'completed',
        limit: watchedState.pageInfo.limit || DETAIL_LIMIT,
        cursor: watchedState.pageInfo.nextCursor,
      })

      setWatchedState((current) => ({
        items: [...current.items, ...result.items],
        pageInfo: result.pageInfo,
        isLoading: false,
        isLoadingMore: false,
        error: null,
        moreError: null,
      }))
    } catch (error) {
      setWatchedState((current) => ({
        ...current,
        isLoadingMore: false,
        moreError: getFriendlyErrorMessage(error, tr("내가 본 작품을 더 불러오지 못했어요.")),
      }))
    }
  }

  if (state.isLoading) {
    return (
      <section className="voice-actor-detail-page">
        <div className="voice-actor-detail-loading skeleton-card">
          <div className="skeleton-line short" />
          <div className="skeleton-line long" />
        </div>
      </section>
    )
  }

  if (state.error || !state.item) {
    return (
      <section className="voice-actor-detail-page">
        <ConnectionErrorState message={state.error || tr("성우 정보를 표시할 수 없어요.")} />
      </section>
    )
  }

  const voiceActor = state.item.voiceActor
  const displayName = getVoiceActorDisplayName(voiceActor.name)
  const description = stripHtml(voiceActor.description)
  const allCharacterGroups = groupVoiceActorCharacterWorks(state.item.items.map((item) => ({
    character: {
      id: item.character.id,
      name: getVoiceActorDisplayName(item.character.name),
      nativeName: item.character.name.native,
      image: getVoiceActorImage(item.character.image),
      meta: getCharacterMeta(item),
    },
    work: {
      id: item.anime.id,
      title: item.anime.title,
      image: getAnimeImage(item),
      label: 'Anime',
      meta: getAnimeMeta(item),
    },
  })))
  const watchedCharacterGroups = groupVoiceActorCharacterWorks(watchedState.items.flatMap((animeItem) => (
    animeItem.characters.map((character) => ({
      character: {
        id: character.id,
        name: getVoiceActorDisplayName(character.name),
        nativeName: character.name.native,
        image: getVoiceActorImage(character.image),
        meta: character.role || null,
      },
      work: {
        id: animeItem.anime.id,
        title: animeItem.anime.title,
        image: animeItem.anime.coverImageExtraLarge || animeItem.anime.coverImageLarge || null,
        label: 'Completed',
        meta: getWatchedAnimeMeta(animeItem),
      },
    }))
  )))
  const visibleCharacterGroups = creditFilter === 'completed'
    ? watchedCharacterGroups
    : allCharacterGroups

  return (
    <section className="voice-actor-detail-page">
      <button className="detail-back-link detail-back-button" type="button" onClick={() => navigate(-1)}>
        {tr("← 이전 화면")}
      </button>

      <section className="voice-actor-hero">
        <div className="voice-actor-hero-image-wrap">
          <img
            className="voice-actor-hero-image"
            src={getProfileImageSrc(getVoiceActorImage(voiceActor.image))}
            alt={displayName}
            onError={handleProfileImageError}
          />
        </div>

        <div className="voice-actor-hero-copy">
          <h1>{displayName}</h1>
          <div className="voice-actor-hero-meta">
            {voiceActor.name.native && <span>{voiceActor.name.native}</span>}
            {voiceActor.languageV2 && <span>{voiceActor.languageV2}</span>}
            {voiceActor.siteUrl && (
              <a href={voiceActor.siteUrl} target="_blank" rel="noreferrer">
                AniList
              </a>
            )}
          </div>
          {description && <p>{description}</p>}
        </div>
      </section>

      <div className="voice-actor-summary-grid" aria-label={tr("성우 요약")}>
        <div>
          <span>{tr("출연 애니")}</span>
          <strong>{state.item.summary.animeCount.toLocaleString(getLocaleTag())}{tr("편")}</strong>
        </div>
        <div>
          <span>{tr("캐릭터")}</span>
          <strong>{state.item.summary.characterCount.toLocaleString(getLocaleTag())}{tr("명")}</strong>
        </div>
        <div>
          <span>{tr("크레딧")}</span>
          <strong>{state.item.summary.creditCount.toLocaleString(getLocaleTag())}{tr("개")}</strong>
        </div>
      </div>

      <section className="voice-actor-credit-section">
        <div className="voice-actor-credit-heading">
          <div>
            <h2>{tr("출연 캐릭터와 작품")}</h2>
            <p>
              {creditFilter === 'completed'
                ? tr("{{v0}}편 · 캐릭터 {{v1}}명을 표시 중이에요.", { v0: watchedState.items.length.toLocaleString(getLocaleTag()), v1: watchedCharacterGroups.length.toLocaleString(getLocaleTag()) })
                : tr("캐릭터 {{v0}}명을 표시 중이에요.", { v0: allCharacterGroups.length.toLocaleString(getLocaleTag()) })}
            </p>
          </div>
          <div className="voice-actor-credit-filters" role="group" aria-label={tr("출연작 필터")}>
            <button
              className={creditFilter === 'all' ? 'is-active' : ''}
              type="button"
              aria-pressed={creditFilter === 'all'}
              onClick={() => setCreditFilter('all')}
            >
              {tr("전체 출연작")}
            </button>
            <button
              className={creditFilter === 'completed' ? 'is-active' : ''}
              type="button"
              aria-pressed={creditFilter === 'completed'}
              disabled={isBootstrapping || !isAuthenticated}
              title={!isBootstrapping && !isAuthenticated ? tr("로그인 후 이용할 수 있어요.") : undefined}
              onClick={() => setCreditFilter('completed')}
            >
              {tr("내가 본 작품")}
            </button>
          </div>
        </div>

        {creditFilter === 'completed' && watchedState.isLoading && (
          <div className="feedback-card">{tr("내가 본 작품을 불러오는 중이에요.")}</div>
        )}

        {creditFilter === 'completed' && watchedState.error && !watchedState.isLoading && (
          <ConnectionErrorState message={watchedState.error} />
        )}

        {creditFilter === 'completed' && !watchedState.isLoading && !watchedState.error && watchedCharacterGroups.length === 0 && (
          <div className="feedback-card">{tr("이 성우가 출연한 완주 작품이 아직 없어요.")}</div>
        )}

        {creditFilter === 'completed' && !watchedState.isLoading && !watchedState.error && watchedCharacterGroups.length > 0 && (
          <div className="voice-actor-credit-grid">
            <VoiceActorCharacterWorks key="completed" groups={watchedCharacterGroups} variant="detail" />
          </div>
        )}

        {creditFilter === 'all' && (visibleCharacterGroups.length === 0 ? (
          <div className="feedback-card">{tr("표시할 출연 정보가 없어요.")}</div>
        ) : (
          <div className="voice-actor-credit-grid">
            <VoiceActorCharacterWorks key="all" groups={allCharacterGroups} variant="detail" />
          </div>
        ))}

        {creditFilter === 'all' && state.moreError && (
          <ErrorToast message={state.moreError} />
        )}

        {creditFilter === 'all' && state.item.pageInfo.hasNext && (
          <button
            className="secondary-button voice-actor-load-more"
            type="button"
            disabled={state.isLoadingMore}
            onClick={() => { void handleLoadMore() }}
          >
            {state.isLoadingMore ? tr("불러오는 중...") : tr("더 보기")}
          </button>
        )}

        {creditFilter === 'completed' && watchedState.moreError && (
          <ErrorToast message={watchedState.moreError} />
        )}

        {creditFilter === 'completed' && watchedState.pageInfo?.hasNext && (
          <button
            className="secondary-button voice-actor-load-more"
            type="button"
            disabled={watchedState.isLoadingMore}
            onClick={() => { void handleLoadMoreWatched() }}
          >
            {watchedState.isLoadingMore ? tr("불러오는 중...") : tr("더 보기")}
          </button>
        )}
      </section>
    </section>
  )
}
