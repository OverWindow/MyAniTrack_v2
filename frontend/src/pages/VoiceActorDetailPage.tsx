import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ConnectionErrorState } from '../components/ConnectionErrorState'
import { getProfileImageSrc, handleProfileImageError } from '../lib/avatar'
import { getFriendlyErrorMessage, SERVER_CONNECTION_ERROR_MESSAGE } from '../lib/errors'
import {
  fetchVoiceActorDetail,
  getVoiceActorDisplayName,
  getVoiceActorImage,
} from '../lib/voiceActors'
import type { VoiceActorDetailItem, VoiceActorDetailPayload } from '../types/voiceActor'
import '../styles/pages/VoiceActorDetailPage.css'

type VoiceActorDetailState = {
  item: VoiceActorDetailPayload | null
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
      ? `평균 ${item.anime.averageScore}점`
      : null,
  ].filter(Boolean).join(' · ')
}

function getCharacterMeta(item: VoiceActorDetailItem) {
  return [
    item.character.role,
    item.voiceActing.languageV2,
  ].filter(Boolean).join(' · ')
}

export function VoiceActorDetailPage() {
  const { voiceActorId } = useParams()
  const navigate = useNavigate()
  const [state, setState] = useState<VoiceActorDetailState>({
    item: null,
    isLoading: true,
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
        error: '성우 ID가 올바르지 않아요.',
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
          titleLanguage: 'ko',
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
          error: getFriendlyErrorMessage(error, '성우 상세 정보를 불러오지 못했어요.'),
          moreError: null,
        })
      }
    }

    void loadDetail()

    return () => controller.abort()
  }, [voiceActorId])

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
        moreError: getFriendlyErrorMessage(error, '더 많은 출연 정보를 불러오지 못했어요.'),
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
        {state.error === SERVER_CONNECTION_ERROR_MESSAGE
          ? <ConnectionErrorState message={state.error} />
          : <div className="feedback-card">{state.error || '성우 정보를 표시할 수 없어요.'}</div>}
      </section>
    )
  }

  const voiceActor = state.item.voiceActor
  const displayName = getVoiceActorDisplayName(voiceActor.name)
  const description = stripHtml(voiceActor.description)

  return (
    <section className="voice-actor-detail-page">
      <button className="detail-back-link detail-back-button" type="button" onClick={() => navigate(-1)}>
        ← 이전 화면
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

      <div className="voice-actor-summary-grid" aria-label="성우 요약">
        <div>
          <span>출연 애니</span>
          <strong>{state.item.summary.animeCount.toLocaleString()}편</strong>
        </div>
        <div>
          <span>캐릭터</span>
          <strong>{state.item.summary.characterCount.toLocaleString()}명</strong>
        </div>
        <div>
          <span>크레딧</span>
          <strong>{state.item.summary.creditCount.toLocaleString()}개</strong>
        </div>
      </div>

      <section className="voice-actor-credit-section">
        <div className="voice-actor-credit-heading">
          <div>
            <h2>출연 캐릭터와 작품</h2>
            <p>{state.item.items.length.toLocaleString()}개 항목을 표시 중이에요.</p>
          </div>
        </div>

        {state.item.items.length === 0 ? (
          <div className="feedback-card">표시할 출연 정보가 없어요.</div>
        ) : (
          <div className="voice-actor-credit-grid">
            {state.item.items.map((item) => {
              const characterName = getVoiceActorDisplayName(item.character.name)
              const characterMeta = getCharacterMeta(item)
              const animeMeta = getAnimeMeta(item)

              return (
                <article className="voice-actor-credit-card" key={`${item.character.id}-${item.anime.id}-${item.voiceActing.sortOrder ?? 0}`}>
                  <div className="voice-actor-character-block">
                    <img
                      src={getProfileImageSrc(getVoiceActorImage(item.character.image))}
                      alt={characterName}
                      loading="lazy"
                      onError={handleProfileImageError}
                    />
                    <div>
                      <span>Character</span>
                      <strong>{characterName}</strong>
                      {item.character.name.native && <small>{item.character.name.native}</small>}
                      {characterMeta && <small>{characterMeta}</small>}
                    </div>
                  </div>

                  <Link className="voice-actor-anime-block" to={`/anime/${item.anime.id}`}>
                    <img
                      src={getProfileImageSrc(getAnimeImage(item))}
                      alt={item.anime.title}
                      loading="lazy"
                      onError={handleProfileImageError}
                    />
                    <span>
                      <small>Anime</small>
                      <strong>{item.anime.title}</strong>
                      {animeMeta && <em>{animeMeta}</em>}
                    </span>
                  </Link>
                </article>
              )
            })}
          </div>
        )}

        {state.moreError && (
          state.moreError === SERVER_CONNECTION_ERROR_MESSAGE
            ? <ConnectionErrorState message={state.moreError} />
            : <div className="feedback-card">{state.moreError}</div>
        )}

        {state.item.pageInfo.hasNext && (
          <button
            className="secondary-button voice-actor-load-more"
            type="button"
            disabled={state.isLoadingMore}
            onClick={() => { void handleLoadMore() }}
          >
            {state.isLoadingMore ? '불러오는 중...' : '더 보기'}
          </button>
        )}
      </section>
    </section>
  )
}
