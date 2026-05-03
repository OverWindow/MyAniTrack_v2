import { Link } from 'react-router-dom'
import '../styles/pages/HomePage.css'

const stats = [
  { value: '1,248h', label: '누적 시청 시간' },
  { value: '4.5 / 5', label: '평균 내 평점' },
  { value: '86%', label: '친구 취향 일치도' },
]

const features = [
  {
    title: '기록',
    text: '본 애니와 감상 상태를 간단하게 저장하고 이어서 관리할 수 있어요.',
  },
  {
    title: '비교',
    text: '내 점수와 다른 사람들의 평점을 함께 보며 작품을 더 입체적으로 볼 수 있어요.',
  },
  {
    title: '분석',
    text: '선호 장르, 방영 시기, 시청 시간 같은 취향 데이터를 정리해줘요.',
  },
]

const snapshots = [
  { label: '선호 장르', value: '미스터리 · 드라마 · 판타지' },
  { label: '자주 보는 시기', value: '2010s - 2020s' },
  { label: '친구와 겹친 작품', value: '128편' },
]

export function HomePage() {
  return (
    <div className="home-page">
      <section className="home-hero">
        <div className="home-hero-copy">
          <span className="eyebrow">Minimal anime tracking for your taste</span>
          <h1>본 애니를 기록하고, 취향으로 정리하는 가장 단순한 방법</h1>
          <p className="home-hero-description">
            MyAniTrack은 감상 기록, 평점 비교, 취향 분석, 친구 비교를 한 화면 흐름 안에서
            자연스럽게 이어주는 애니 아카이브예요.
          </p>

          <div className="home-hero-actions">
            <Link className="primary-button" to="/explore">
              탐색 시작하기
            </Link>
            <Link className="secondary-button" to="/signup">
              가입하고 기록하기
            </Link>
          </div>
        </div>

        <aside className="home-preview-card" aria-label="서비스 미리보기">
          <span className="panel-label">Today in MyAniTrack</span>
          <div className="home-preview-block">
            <strong>취향 요약</strong>
            <p>드라마와 미스터리를 가장 자주 보고, 최근엔 일상물 평점이 높아요.</p>
          </div>
          <div className="home-preview-metrics">
            {stats.map((stat) => (
              <div key={stat.label}>
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="home-stats">
        {stats.map((stat) => (
          <article className="home-stat-card" key={stat.label}>
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </article>
        ))}
      </section>

      <section className="home-section">
        <div className="home-section-heading">
          <span className="section-kicker">Core experience</span>
          <h2>기록, 비교, 분석을 군더더기 없이</h2>
        </div>

        <div className="home-feature-grid">
          {features.map((feature) => (
            <article className="home-feature-card" key={feature.title}>
              <span className="home-feature-index" aria-hidden="true">
                {feature.title}
              </span>
              <p>{feature.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-section home-summary-section">
        <div className="home-section-heading">
          <span className="section-kicker">Taste snapshot</span>
          <h2>내 취향을 한눈에 읽는 요약 카드</h2>
        </div>

        <div className="home-summary-grid">
          {snapshots.map((item) => (
            <article className="home-summary-card" key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
