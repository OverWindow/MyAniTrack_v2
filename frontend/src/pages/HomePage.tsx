import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchPopularAnime, getDisplayTitle, getPrimaryPoster } from '../lib/anime'
import type { PopularAnimeItem } from '../types/anime'
import '../styles/pages/HomePage.css'

type HomeState = {
  popularAnime: PopularAnimeItem[]
  isLoading: boolean
  error: string | null
}

const PLATFORM_ANIME_COUNT = 22201

export function HomePage() {
  const [state, setState] = useState<HomeState>({
    popularAnime: [],
    isLoading: true,
    error: null,
  })

  useEffect(() => {
    const controller = new AbortController()

    const loadPopularAnime = async () => {
      try {
        const popularAnime = await fetchPopularAnime({
          limit: 16,
          signal: controller.signal,
        })

        if (controller.signal.aborted) {
          return
        }

        setState({
          popularAnime: popularAnime.slice(0, 16),
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
          error: error instanceof Error ? error.message : '홈 정보를 불러오지 못했어요.',
        })
      }
    }

    void loadPopularAnime()

    return () => controller.abort()
  }, [])

  return (
    <div className="home-page">
      <section className="home-gallery-hero">
        <div className="home-gallery-copy">
          <span className="summary-kicker">Trending now</span>
          <h1>지금 많이 찾는 작품</h1>
          <p>
            인기 애니 포스터를 한눈에 둘러보고, 마음에 드는 작품은 바로 기록해보세요.
          </p>

          <div className="home-hero-actions">
            <Link className="primary-button" to="/explore">
              전체 탐색하기
            </Link>
            {state.popularAnime[0] && (
              <Link className="secondary-button" to={`/anime/${state.popularAnime[0].id}`} state={{ fromPage: 'explore' }}>
                대표 작품 보기
              </Link>
            )}
          </div>
        </div>

        <div className="home-anime-showcase" aria-label="인기 애니 전시">
          <div className="home-anime-showcase-wrapper">
          {state.popularAnime.length > 0 ? (
            state.popularAnime.slice(0, 16).map((anime, index) => (
              <Link
                className={`home-showcase-card home-showcase-card-${index + 1}`}
                key={anime.id}
                to={`/anime/${anime.id}`}
                state={{ fromPage: 'explore' }}
                aria-label={getDisplayTitle(anime)}
              >
                <img
                  src={getPrimaryPoster({
                    coverImageLarge: anime.coverImageLarge,
                    coverImageExtraLarge: anime.coverImageExtraLarge,
                  })}
                  alt={getDisplayTitle(anime)}
                  loading={index < 3 ? 'eager' : 'lazy'}
                />
              </Link>
            ))
          ) : (
            !state.isLoading && <div className="feedback-card">인기 애니 정보를 아직 보여드릴 수 없어요.</div>
          )}
          </div>
        </div>

        <aside className="home-platform-card" aria-label="플랫폼 현황">
          <span className="section-kicker">Platform</span>
          <strong>{PLATFORM_ANIME_COUNT.toLocaleString()}편</strong>
          <p>현재 MyAniTrack에 등록된 <br/>애니 수</p>
        </aside>
      </section>

      {state.error && <div className="feedback-card is-error">{state.error}</div>}

      <section className="home-flow-section" aria-labelledby="home-flow-title">
        <div className="home-flow-heading">
          <span className="section-kicker">How it works</span>
          <h2 id="home-flow-title">MyAniTrack 사용 방법</h2>
        </div>

        <div className="home-flow-card-grid">
          <Link className="home-flow-card home-flow-card-explore" to="/explore">
            <span className="home-flow-number">1</span>
            <div className="home-flow-card-copy">
              <h3>탐색</h3>
              <p>마음에 드는 애니를 찾아 내 리스트에 추가하고, 바로 별점과 진행도를 남겨요.</p>
            </div>
            <div className="home-flow-visual home-flow-visual-explore" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </Link>

          <Link className="home-flow-card home-flow-card-analysis" to="/analysis">
            <span className="home-flow-number">2</span>
            <div className="home-flow-card-copy">
              <h3>분석</h3>
              <p>추가한 애니를 기준으로 취향, 장르, 평점 분포를 한눈에 확인해요.</p>
            </div>
            <div className="home-flow-visual home-flow-visual-analysis" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </Link>

          <Link className="home-flow-card home-flow-card-friends" to="/friends">
            <span className="home-flow-number">3</span>
            <div className="home-flow-card-copy">
              <h3>친구</h3>
              <p>친구를 만들고 서로의 컬렉션과 분석을 보면서 새로운 작품을 발견해요.</p>
            </div>
            <div className="home-flow-visual home-flow-visual-friends" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </Link>
        </div>
      </section>
    </div>
  )
}
