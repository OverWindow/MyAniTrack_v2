import { useMemo, useState } from 'react'
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

const ITEMS_PER_PAGE = 6

export function AnalysisAnimeToast({
  title,
  description,
  items,
  isLoading,
  error,
  isOpen,
  onClose,
}: AnalysisAnimeToastProps) {
  const [pageState, setPageState] = useState({ key: '', page: 1 })
  const pageKey = `${title}:${items.map((item) => item.id).join(',')}`
  const totalPages = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE))
  const page = pageState.key === pageKey
    ? Math.min(pageState.page, totalPages)
    : 1
  const visibleItems = useMemo(
    () => items.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE),
    [items, page],
  )

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
        <>
          <div className="analysis-anime-toast-list">
            {visibleItems.map((entry) => (
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
          {totalPages > 1 && (
            <div className="analysis-anime-toast-pagination" aria-label="감상 작품 페이지">
              <button
                type="button"
                onClick={() => setPageState((current) => ({
                  key: pageKey,
                  page: Math.max(1, (current.key === pageKey ? current.page : page) - 1),
                }))}
                disabled={page === 1}
              >
                이전
              </button>
              <span>{page} / {totalPages}</span>
              <button
                type="button"
                onClick={() => setPageState((current) => ({
                  key: pageKey,
                  page: Math.min(totalPages, (current.key === pageKey ? current.page : page) + 1),
                }))}
                disabled={page === totalPages}
              >
                다음
              </button>
            </div>
          )}
        </>
      )}
    </aside>
  )
}
