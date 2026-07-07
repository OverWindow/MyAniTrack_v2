import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ConnectionErrorState } from '../components/ConnectionErrorState'
import { fetchPopularAnime, getDisplayTitle, getPrimaryPoster } from '../lib/anime'
import { getFriendlyErrorMessage } from '../lib/errors'
import type { PopularAnimeItem } from '../types/anime'
import landingDashboardImage from '../assets/landing-dashboard.png'
import '../styles/pages/HomePage.css'

type HomeState = {
  popularAnime: PopularAnimeItem[]
  isLoading: boolean
  error: string | null
}

const FEATURE_ROTATION_MS = 6000

function getPopularityLabel(value?: number | null) {
  if (!value) {
    return '인기 집계 중'
  }

  return `인기도 ${value.toLocaleString()}`
}

export function HomePage() {
  const [state, setState] = useState<HomeState>({
    popularAnime: [],
    isLoading: true,
    error: null,
  })
  const [featuredIndex, setFeaturedIndex] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    const loadPopularAnime = async () => {
      try {
        const popularAnime = await fetchPopularAnime({
          limit: 18,
          signal: controller.signal,
        })

        if (controller.signal.aborted) {
          return
        }

        setState({
          popularAnime: popularAnime.slice(0, 18),
          isLoading: false,
          error: null,
        })
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        setState({
          popularAnime: [],
          isLoading: false,
          error: getFriendlyErrorMessage(error, '홈 정보를 불러오지 못했어요.'),
        })
      }
    }

    void loadPopularAnime()

    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (state.popularAnime.length <= 1) {
      return
    }

    const timer = window.setInterval(() => {
      setFeaturedIndex((current) => (current + 1) % state.popularAnime.length)
    }, FEATURE_ROTATION_MS)

    return () => window.clearInterval(timer)
  }, [state.popularAnime.length])

  const safeFeaturedIndex = state.popularAnime.length > 0
    ? featuredIndex % state.popularAnime.length
    : 0
  const featuredAnime = state.popularAnime[safeFeaturedIndex] ?? null
  const railAnime = useMemo(
    () => state.popularAnime.slice(0, 12),
    [state.popularAnime],
  )

  return (
    <div className="home-page">
      <section className="home-immersive-hero" aria-label="MyAniTrack 소개">
        <div
          className="home-immersive-backdrop"
          style={{ backgroundImage: `url(${landingDashboardImage})` }}
        />
        <div className="home-immersive-shade" />

        <div className="home-immersive-copy">
          <span className="section-kicker">MyAniTrack</span>
          <h1>애니 취향을 <br/> 기록하고 분석하는 <br/>가장 선명한 창</h1>
          <p>
            감상한 작품과 평점, 시청 시간을 모아 장르, 스튜디오, 성우, 포맷 흐름까지 한 화면에서
            확인하세요.
          </p>
          <div className="home-immersive-actions">
            <Link className="primary-button" to="/explore">
              작품 둘러보기
            </Link>
            <Link className="secondary-button" to="/collection">
              내 컬렉션 보기
            </Link>
          </div>
        </div>

        <div className="home-immersive-signals" aria-label="주요 기능">
          <span>컬렉션 기록</span>
          <span>취향 분석</span>
          <span>친구 비교</span>
        </div>
      </section>

      {state.error ? (
        <ConnectionErrorState className="home-connection-error" message={state.error} />
      ) : (
      <section className="home-cinematic-hero" aria-label="인기 애니 쇼케이스">
        {featuredAnime && (
          <div
            className="home-cinematic-backdrop"
            style={{
              backgroundImage: `linear-gradient(90deg, rgba(35, 29, 25, 0.95) 0%, rgba(35, 29, 25, 0.8) 42%, rgba(35, 29, 25, 0.26) 100%), url(${getPrimaryPoster(featuredAnime)})`,
            }}
          />
        )}

        <div className="home-cinematic-copy">
          <span className="section-kicker">MyAniTrack spotlight</span>
          <h1>{featuredAnime ? getDisplayTitle(featuredAnime) : '지금 많이 찾는 애니'}</h1>
          <div className="home-feature-meta">
            <span>Anime</span>
            <span>Collection</span>
            <span>{featuredAnime ? getPopularityLabel(featuredAnime.popularity) : 'Trending'}</span>
          </div>
          <p>
            오늘의 인기 작품을 둘러보고, 마음에 드는 애니를 컬렉션에 담아 취향 분석까지 이어가세요.
          </p>

          <div className="home-cinematic-actions">
            <Link className="primary-button" to="/explore">
              탐색 시작하기
            </Link>
            {featuredAnime && (
              <Link className="secondary-button" to={`/anime/${featuredAnime.id}`} state={{ fromPage: 'explore' }}>
                대표 작품 보기
              </Link>
            )}
          </div>
        </div>

        <div className="home-feature-poster-wrap" aria-hidden={!featuredAnime}>
          {featuredAnime ? (
            <img
              className="home-feature-poster"
              src={getPrimaryPoster(featuredAnime)}
              alt={getDisplayTitle(featuredAnime)}
            />
          ) : (
            <div className="home-feature-poster-placeholder" />
          )}
        </div>

        <div className="home-poster-rail" aria-label="인기 애니 목록">
          {state.isLoading && (
            Array.from({ length: 6 }).map((_, index) => (
              <div className="home-rail-card skeleton-card" key={`home-rail-loading-${index}`}>
                <div className="skeleton-line long" />
              </div>
            ))
          )}

          {!state.isLoading && railAnime.length > 0 && railAnime.map((anime, index) => (
            <button
              className={featuredAnime?.id === anime.id ? 'home-rail-card is-active' : 'home-rail-card'}
              key={anime.id}
              type="button"
              onClick={() => setFeaturedIndex(index)}
              aria-label={`${getDisplayTitle(anime)} 대표로 보기`}
            >
              <img
                src={getPrimaryPoster(anime)}
                alt={getDisplayTitle(anime)}
                loading={index < 4 ? 'eager' : 'lazy'}
              />
            </button>
          ))}

          {!state.isLoading && railAnime.length === 0 && !state.error && (
            <div className="feedback-card">인기 애니 정보를 아직 보여드릴 수 없어요.</div>
          )}
        </div>
      </section>
      )}
    </div>
  )
}
