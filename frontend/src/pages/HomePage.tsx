import { tr } from '../i18n'
import { Link } from 'react-router-dom'
import landingDashboardImage from '../assets/landing-dashboard.png'
import '../styles/pages/HomePage.css'

const LANDING_REVIEWS = [
  {
    name: 'minji.log',
    role: tr("시즌 애니 기록 중"),
    comment: tr("봤던 작품이 쌓일수록 내 취향이 숫자로 보이는 게 좋아요."),
  },
  {
    name: 'junho_97',
    role: tr("완결작 위주 감상"),
    comment: tr("별점만 남기는 앱보다 훨씬 정리된 느낌이에요."),
  },
  {
    name: 'hemin',
    role: tr("평점 남기는 편"),
    comment: tr("내가 어떤 작품을 자주 보는지 한눈에 들어와요."),
  },
  {
    name: 'seungwoo.k',
    role: tr("극장판 챙겨봄"),
    comment: tr("컬렉션에서 예전에 본 작품 찾기가 편해서 계속 쓰게 돼요."),
  },
  {
    name: 'nari_watch',
    role: tr("장르별로 정리 중"),
    comment: tr("분석 탭 보는 맛이 있어요. 취향이 생각보다 뚜렷하더라고요."),
  },
]

const HOW_TO_STEPS = [
  {
    number: '01',
    label: 'Start',
    title: tr("로그인하기"),
    description: tr("내 감상 기록과 분석 결과를 안전하게 저장할 계정으로 시작해요."),
    href: '/login',
    action: tr("로그인하기"),
  },
  {
    number: '02',
    label: 'Explore',
    title: tr("애니 탐색하기"),
    description: tr("탐색 탭에서 제목과 장르로 지금까지 본 작품을 찾아보세요."),
    href: '/explore',
    action: tr("작품 찾기"),
  },
  {
    number: '03',
    label: 'Collect',
    title: tr("컬렉션에 기록하기"),
    description: tr("작품을 추가하고 감상 상태, 진행도와 내 평점을 함께 남겨요."),
    href: '/collection',
    action: tr("컬렉션 보기"),
  },
  {
    number: '04',
    label: 'Analyze',
    title: tr("자동 분석 확인하기"),
    description: tr("쌓인 기록을 바탕으로 장르, 연도, 포맷, 스튜디오와 성우 취향을 자동으로 분석해요."),
    href: '/analysis',
    action: tr("내 분석 보기"),
  },
]

export function HomePage() {
  return (
    <div className="home-page">
      <section className="home-immersive-hero" aria-label={tr("MyAniTrack 소개")}>
        <div
          className="home-immersive-backdrop"
          style={{ backgroundImage: `url(${landingDashboardImage})` }}
        />
        <div className="home-immersive-shade" />

        <div className="home-immersive-copy">
          <h1>{tr("애니 취향을")} <br/> {tr("기록하고 분석하는")} <br/>{tr("가장 선명한 창")}</h1>
          <p>
            {tr("감상한 작품과 평점, 시청 시간을 모아 장르, 스튜디오, 성우, 포맷 흐름까지 한 화면에서\n            확인하세요.")}
          </p>
          <div className="home-immersive-actions">
            <Link className="primary-button" to="/explore">
              {tr("작품 둘러보기")}
            </Link>
            <Link className="secondary-button" to="/collection">
              {tr("내 컬렉션 보기")}
            </Link>
          </div>
        </div>

        <div className="home-immersive-signals" aria-label={tr("주요 기능")}>
          <span>{tr("컬렉션 기록")}</span>
          <span>{tr("취향 분석")}</span>
          <span>{tr("친구 비교")}</span>
        </div>
      </section>

      <section className="home-guide-section" aria-labelledby="home-guide-title">
        <div className="home-guide-heading">
          <div>
            <span className="detail-label">How it works</span>
            <h2 id="home-guide-title">{tr("기록을 시작하면")}<br />{tr("취향이 보이기 시작해요")}</h2>
          </div>
          <p>
            {tr("작품을 일일이 정리할 필요 없이 본 애니를 컬렉션에 추가하세요.\n            기록이 쌓일수록 MyAniTrack이 나만의 감상 패턴을 자동으로 정리해줘요.")}
          </p>
        </div>

        <ol className="home-guide-steps">
          {HOW_TO_STEPS.map((step) => (
            <li className="home-guide-step" key={step.number}>
              <div className="home-guide-step-marker">
                <span>{step.number}</span>
                <small>{step.label}</small>
              </div>
              <div className="home-guide-step-copy">
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </div>
              <Link to={step.href}>{step.action}<span aria-hidden="true"> →</span></Link>
            </li>
          ))}
        </ol>

        <div className="home-guide-social">
          <div className="home-guide-social-index" aria-hidden="true">
            <strong>05</strong>
            <span>Together</span>
          </div>
          <div className="home-guide-social-copy">
            <span className="detail-label">{tr("한 걸음 더")}</span>
            <h3>{tr("친구의 취향까지 함께 발견하세요")}</h3>
            <p>
              {tr("친구 요청을 보내고 연결되면 친구가 기록한 애니 컬렉션과 자동 분석 결과를 바로 둘러볼 수 있어요.\n              서로 어떤 작품을 좋아하는지 비교하며 다음 작품도 발견해보세요.")}
            </p>
          </div>
          <div className="home-guide-social-flow" aria-label={tr("친구 기능 이용 순서")}>
            <span>{tr("친구 추가")}</span>
            <i aria-hidden="true">→</i>
            <span>{tr("컬렉션 보기")}</span>
            <i aria-hidden="true">→</i>
            <span>{tr("분석 보기")}</span>
          </div>
          <Link className="primary-button home-guide-friends-link" to="/friends">
            {tr("친구 찾아보기")}
          </Link>
        </div>
      </section>

      <section className="home-review-section" aria-labelledby="home-review-title">
        <div className="home-review-heading">
          <h2 id="home-review-title">{tr("먼저 써본 사람들의 한마디")}</h2>
        </div>

        <div className="home-review-track" aria-label={tr("사용자 리뷰")}>
          {LANDING_REVIEWS.map((review) => (
            <article className="home-review-card" key={review.name}>
              <div className="home-review-stars" aria-label={tr("5점 만점")}>
                <span>★</span>
                <span>★</span>
                <span>★</span>
                <span>★</span>
                <span>★</span>
              </div>
              <blockquote className="home-review-comment">“{review.comment}”</blockquote>
              <div className="home-review-author">
                <span className="home-review-avatar">{review.name.slice(0, 1)}</span>
                <div>
                  <strong>{review.name}</strong>
                  <span>{review.role}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <footer className="home-footer">
        <div className="home-footer-inner">
          <div className="home-footer-brand">
            <Link to="/" aria-label={tr("MyAniTrack 홈")}>MyAniTrack</Link>
            <p>{tr("본 애니를 기록하고, 나만의 취향과 친구의 컬렉션을 함께 발견하세요.")}</p>
          </div>

          <nav className="home-footer-nav" aria-label={tr("서비스 바로가기")}>
            <div>
              <strong>{tr("서비스")}</strong>
              <Link to="/explore">{tr("애니 탐색")}</Link>
              <Link to="/collection">{tr("내 컬렉션")}</Link>
              <Link to="/analysis">{tr("취향 분석")}</Link>
            </div>
            <div>
              <strong>{tr("함께하기")}</strong>
              <Link to="/friends">{tr("친구")}</Link>
              <Link to="/login">{tr("로그인")}</Link>
              <Link to="/signup">{tr("회원가입")}</Link>
            </div>
            <div>
              <strong>{tr("정책")}</strong>
              <Link to="/privacy">{tr("개인정보처리방침")}</Link>
              <Link to="/account-deletion">{tr("계정 및 데이터 삭제")}</Link>
            </div>
          </nav>
        </div>

        <div className="home-footer-bottom">
          <span>© {new Date().getFullYear()} MyAniTrack</span>
          <span>Anime collection &amp; taste analytics</span>
        </div>
      </footer>
    </div>
  )
}
