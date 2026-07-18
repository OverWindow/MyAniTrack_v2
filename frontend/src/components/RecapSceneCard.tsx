import { getGenreLabel } from '../lib/stats'
import { getRecapAnimeTitle, getRecapImageUrl } from '../lib/recap'
import type { UserAnimeListItem } from '../types/collection'
import type { RecapAssetMap, RecapData, RecapScene, RecapTheme } from '../types/recap'

type RecapSceneCardProps = {
  scene: RecapScene
  data: RecapData
  favorites: UserAnimeListItem[]
  theme: RecapTheme
  assets: RecapAssetMap
  exportMode?: boolean
}

const DNA_LABELS: Record<string, string> = {
  completion: '작품 완주력',
  seriesCompletion: '시리즈 완주력',
  genreExploration: '장르 탐험도',
  eraExploration: '시대 탐험도',
  ratingActivity: '평가 적극성',
  watchImmersion: '시청 몰입도',
}

function getInitials(username: string) {
  return username.trim().slice(0, 2).toUpperCase() || 'MY'
}

function resolveImage(url: string | null | undefined, assets: RecapAssetMap, exportMode: boolean) {
  if (!url) {
    return null
  }

  return exportMode ? assets[url] ?? null : assets[url] ?? url
}

function formatWatchHours(totalMinutes: number) {
  return Math.round(totalMinutes / 60).toLocaleString('ko-KR')
}

function getRadarPoint(index: number, score: number, count: number, radius = 258) {
  const angle = -Math.PI / 2 + (Math.PI * 2 * index) / count
  const scaledRadius = radius * Math.max(0, Math.min(100, score)) / 100

  return {
    x: 360 + Math.cos(angle) * scaledRadius,
    y: 360 + Math.sin(angle) * scaledRadius,
  }
}

function DnaRadar({ data }: { data: RecapData['viewingDna'] }) {
  if (!data || data.axes.length === 0) {
    return <div className="recap-scene-empty">아직 DNA를 그릴 만큼 기록이 충분하지 않아요.</div>
  }

  const axes = data.axes
  const rings = [20, 40, 60, 80, 100]
  const polygonPoints = axes
    .map((axis, index) => getRadarPoint(index, axis.available ? axis.score : 0, axes.length))
    .map((point) => `${point.x},${point.y}`)
    .join(' ')

  return (
    <svg className="recap-dna-radar" viewBox="0 0 720 720" role="img" aria-label="감상 DNA 육각형 차트">
      {rings.map((ring) => (
        <polygon
          key={ring}
          points={axes.map((_, index) => {
            const point = getRadarPoint(index, ring, axes.length)
            return `${point.x},${point.y}`
          }).join(' ')}
          fill="none"
          stroke="currentColor"
          strokeOpacity={ring === 100 ? 0.28 : 0.12}
          strokeWidth="3"
        />
      ))}
      {axes.map((axis, index) => {
        const outer = getRadarPoint(index, 100, axes.length)
        const label = getRadarPoint(index, 118, axes.length)

        return (
          <g key={axis.key}>
            <line x1="360" y1="360" x2={outer.x} y2={outer.y} stroke="currentColor" strokeOpacity="0.12" strokeWidth="3" />
            <text x={label.x} y={label.y} textAnchor="middle" dominantBaseline="middle">
              {DNA_LABELS[axis.key] ?? axis.label}
            </text>
          </g>
        )
      })}
      <polygon className="recap-dna-shape" points={polygonPoints} />
      {axes.map((axis, index) => {
        const point = getRadarPoint(index, axis.available ? axis.score : 0, axes.length)
        return <circle key={axis.key} cx={point.x} cy={point.y} r="10" />
      })}
    </svg>
  )
}

function FavoriteCollage({ favorites, assets, exportMode }: Pick<RecapSceneCardProps, 'favorites' | 'assets'> & { exportMode: boolean }) {
  return (
    <div className={`recap-favorite-collage is-count-${favorites.length}`}>
      {favorites.map((favorite, index) => {
        const url = getRecapImageUrl(favorite)
        const src = resolveImage(url, assets, exportMode)

        return (
          <article className="recap-favorite-poster" key={favorite.id}>
            {src ? <img src={src} alt="" /> : <span>{getRecapAnimeTitle(favorite).slice(0, 1)}</span>}
            <div>
              <small>MY FAVORITE {String(index + 1).padStart(2, '0')}</small>
              <strong>{getRecapAnimeTitle(favorite)}</strong>
            </div>
          </article>
        )
      })}
    </div>
  )
}

export function RecapSceneCard({ scene, data, favorites, theme, assets, exportMode = false }: RecapSceneCardProps) {
  const { stats, user, viewingDna, genreBubble, formatDistribution } = data
  const profileSrc = resolveImage(user.profileImageUrl, assets, exportMode)
  const strongestAxis = viewingDna?.axes.find((axis) => axis.key === viewingDna.strongestAxis) ?? null
  const topGenres = genreBubble?.items.slice().sort((left, right) => right.preferenceScore - left.preferenceScore).slice(0, 4) ?? []
  const maxGenreScore = Math.max(...topGenres.map((genre) => Math.abs(genre.preferenceScore)), 1)
  const topFormat = formatDistribution?.summary.topFormatLabel ?? '아직 발견 중'

  return (
    <article
      className={`recap-scene recap-scene-${scene.key}${exportMode ? ' is-export' : ''}`}
      data-theme={theme}
      aria-label={scene.label}
    >
      <div className="recap-scene-orb is-one" />
      <div className="recap-scene-orb is-two" />
      <div className="recap-scene-grid" />

      {scene.key === 'cover' && (
        <div className="recap-cover-content">
          <span className="recap-kicker">MY ANIME TASTE RECAP</span>
          <div className="recap-profile-portrait">
            {profileSrc ? <img src={profileSrc} alt="" /> : <span>{getInitials(user.username)}</span>}
          </div>
          <p>{user.username}님의</p>
          <h2>애니 취향을<br />한 장씩 펼쳐볼게요</h2>
          <small>지금까지 쌓인 컬렉션과 감상 기록으로 만든 리캡</small>
        </div>
      )}

      {scene.key === 'totals' && (
        <div className="recap-scene-content">
          <span className="recap-kicker">YOUR ANIME JOURNEY</span>
          <h2>좋아하는 이야기에<br />이만큼의 시간을 보냈어요</h2>
          <div className="recap-hero-number">
            <strong>{formatWatchHours(stats.totalWatchMinutes)}</strong>
            <span>시간</span>
          </div>
          <div className="recap-stat-row">
            <div><strong>{stats.totalCount.toLocaleString('ko-KR')}</strong><span>기록한 작품</span></div>
            <div><strong>{stats.completedCount.toLocaleString('ko-KR')}</strong><span>완주 작품</span></div>
            <div><strong>{stats.totalWatchedEpisodes.toLocaleString('ko-KR')}</strong><span>감상 에피소드</span></div>
          </div>
        </div>
      )}

      {scene.key === 'favorites' && (
        <div className="recap-scene-content">
          <span className="recap-kicker">THE ONES I LOVE</span>
          <h2>몇 번을 다시 만나도<br />좋아할 나의 최애</h2>
          <FavoriteCollage favorites={favorites} assets={assets} exportMode={exportMode} />
        </div>
      )}

      {scene.key === 'dna' && (
        <div className="recap-scene-content">
          <span className="recap-kicker">VIEWING DNA</span>
          <h2>내 감상 습관의<br />여섯 가지 얼굴</h2>
          <DnaRadar data={viewingDna} />
          <div className="recap-scene-highlight">
            <span>가장 선명한 성향</span>
            <strong>{strongestAxis?.label ?? '기록을 쌓는 중'}</strong>
            {strongestAxis && <b>{strongestAxis.score.toFixed(1)}</b>}
          </div>
        </div>
      )}

      {scene.key === 'genre' && (
        <div className="recap-scene-content">
          <span className="recap-kicker">GENRE UNIVERSE</span>
          <h2>내가 가장 자주<br />머무른 장르는</h2>
          <div className="recap-favorite-genre">
            <strong>{getGenreLabel(stats.favoriteGenre)}</strong>
            <span>취향의 중심</span>
          </div>
          {topGenres.length > 0 ? (
            <div className="recap-genre-bars">
              {topGenres.map((genre) => (
                <div key={genre.genre}>
                  <span>{getGenreLabel(genre.genre)}</span>
                  <i><b style={{ width: `${Math.max(8, Math.abs(genre.preferenceScore) / maxGenreScore * 100)}%` }} /></i>
                  <strong>{genre.animeCount}편</strong>
                </div>
              ))}
            </div>
          ) : (
            <div className="recap-scene-empty">조금 더 감상하면 장르 우주가 채워져요.</div>
          )}
        </div>
      )}

      {scene.key === 'series' && (
        <div className="recap-scene-content">
          <span className="recap-kicker">THE WAY I WATCH</span>
          <h2>작품을 넘어<br />시리즈와 포맷으로</h2>
          <div className="recap-series-meter">
            <div>
              <span>본 시리즈</span>
              <strong>{stats.seriesStats?.watchedSeriesCount ?? 0}</strong>
            </div>
            <div>
              <span>완주 시리즈</span>
              <strong>{stats.seriesStats?.completedSeriesCount ?? 0}</strong>
            </div>
          </div>
          <div className="recap-detail-stack">
            <div><span>대표 포맷</span><strong>{topFormat}</strong></div>
            <div><span>가장 많이 본 시대</span><strong>{stats.favoriteReleasePeriod || '아직 발견 중'}</strong></div>
            <div><span>시리즈 완주율</span><strong>{(stats.seriesStats?.seriesCompletionRate ?? 0).toFixed(1)}%</strong></div>
          </div>
        </div>
      )}

      {scene.key === 'closing' && (
        <div className="recap-closing-content">
          <span className="recap-kicker">KEEP YOUR TASTE</span>
          <h2>{stats.preferenceSummary || '좋아하는 작품을 기록할수록 나만의 취향은 더 선명해져요.'}</h2>
          <div className="recap-closing-mark" aria-hidden="true"><span /></div>
          <p>나도 내 애니 취향 리캡 만들기</p>
          <strong>MyAniTrack</strong>
          <small>myanitrack.com</small>
        </div>
      )}
    </article>
  )
}
