import { tr } from '../i18n'
import { Link } from 'react-router-dom'
import type { Location } from 'react-router-dom'
import type { UserSeriesCollectionItem } from '../types/collection'

type SeriesCollectionGridProps = {
  items: UserSeriesCollectionItem[]
  location: Location
  fromPage: string
  collectionLabel: string
}

export function SeriesCollectionSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="series-collection-grid">
      {Array.from({ length: count }).map((_, index) => (
        <article className="series-collection-card skeleton-card" key={`series-skeleton-${index}`}>
          <div className="skeleton-poster" />
          <div className="skeleton-line short" />
          <div className="skeleton-line long" />
        </article>
      ))}
    </div>
  )
}

export function SeriesCollectionGrid({
  items,
  location,
  fromPage,
  collectionLabel,
}: SeriesCollectionGridProps) {
  return (
    <div className="series-collection-grid">
      {items.map((series) => {
        const targetAnimeId = series.canonicalAnimeId ?? series.items[0]?.anime.id

        return (
          <article className="series-collection-card" key={series.seriesId}>
            {targetAnimeId ? (
              <Link
                className="series-collection-cover-link"
                to={`/anime/${targetAnimeId}`}
                state={{ fromPage, backgroundLocation: location }}
              >
                {series.coverImageExtraLarge || series.coverImageLarge ? (
                  <img
                    className="series-collection-cover"
                    src={series.coverImageExtraLarge || series.coverImageLarge || ''}
                    alt={series.title || tr("시리즈 대표 이미지")}
                    loading="lazy"
                  />
                ) : (
                  <div className="series-collection-cover-placeholder">No image</div>
                )}
              </Link>
            ) : null}
            <div className="series-collection-copy">
              <div className="series-collection-heading">
                <div>
                  <span className="series-collection-scope">
                    {series.scope === 'mainline' ? tr("본편 시리즈") : tr("관련 작품 전체")}
                  </span>
                  <h3>{series.title || tr("이름 없는 시리즈")}</h3>
                </div>
                <strong>{series.completionRate}%</strong>
              </div>
              <div className="series-collection-progress" aria-label={tr("완주율 {{v0}}%", { v0: series.completionRate })}>
                <span style={{ width: `${Math.min(100, Math.max(0, series.completionRate))}%` }} />
              </div>
              <p>
                {series.completedRequiredMemberCount}/{series.requiredMemberCount} {tr("필수 작품 완주")}
                {' · '}
                {collectionLabel} {series.collectedMemberCount}{tr("개")}
              </p>
              <div className="series-member-strip">
                {series.items.map((member) => (
                  <Link
                    key={member.anime.id}
                    className={member.userList ? 'series-member-item is-collected' : 'series-member-item'}
                    to={`/anime/${member.anime.id}`}
                    state={{ fromPage, backgroundLocation: location }}
                    title={`${member.anime.title}${member.userList ? ` · ${member.userList.status}` : tr(" · 미등록")}`}
                  >
                    {member.anime.coverImageLarge ? (
                      <img src={member.anime.coverImageLarge} alt={member.anime.title} loading="lazy" />
                    ) : (
                      <span>{member.anime.title.slice(0, 1)}</span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}
