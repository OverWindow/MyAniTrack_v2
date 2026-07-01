import { Link } from 'react-router-dom'
import type { UserAnimeListItem } from '../types/collection'

type AnalysisAnimeToastProps = {
  title: string
  description: string
  items: UserAnimeListItem[]
  isLoading: boolean
  error: string | null
  isOpen: boolean
  onClose: () => void
}

export function AnalysisAnimeToast({
  title,
  description,
  items,
  isLoading,
  error,
  isOpen,
  onClose,
}: AnalysisAnimeToastProps) {
  if (!isOpen) {
    return null
  }

  return (
    <aside className="analysis-anime-toast" aria-live="polite">
      <div className="analysis-anime-toast-heading">
        <div>
          <strong>{title}</strong>
          <span>{description}</span>
        </div>
        <button className="analysis-anime-toast-close" type="button" onClick={onClose} aria-label="감상 작품 닫기">
          ×
        </button>
      </div>

      {isLoading && <div className="analysis-anime-toast-state">작품을 불러오는 중이에요.</div>}
      {error && !isLoading && <div className="analysis-anime-toast-state">{error}</div>}
      {!isLoading && !error && items.length === 0 && (
        <div className="analysis-anime-toast-state">표시할 작품이 없어요.</div>
      )}
      {!isLoading && !error && items.length > 0 && (
        <div className="analysis-anime-toast-list">
          {items.map((entry) => (
            <Link className="analysis-anime-toast-card" key={entry.id} to={`/anime/${entry.anime.id}`}>
              <span className="analysis-anime-toast-poster">
                <img
                  src={entry.anime.coverImageExtraLarge || entry.anime.coverImageLarge}
                  alt={entry.anime.title}
                  loading="lazy"
                />
                <small>
                  {entry.score !== null && entry.score !== undefined
                    ? `${Number(entry.score).toFixed(1)}점`
                    : entry.anime.seasonYear ?? '정보 없음'}
                </small>
              </span>
              <strong>{entry.anime.title}</strong>
            </Link>
          ))}
        </div>
      )}
    </aside>
  )
}
