import { tr } from '../i18n'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorToast } from './ErrorToast'
import { useAuth } from '../contexts/AuthContext'
import {
  addToCollection,
  COLLECTION_CACHE_UPDATED_EVENT,
  deleteCollectionEntry,
  getCachedCollectionEntry,
} from '../lib/collection'
import '../styles/components/CollectionButton.css'

type CollectionButtonProps = {
  animeId: number
  maxProgress?: number | null
  initialIsAdded?: boolean
  useCacheState?: boolean
  loginLabel?: string
  loginAriaLabel?: string
  onAddedChange?: (isAdded: boolean) => void
}

export function CollectionButton({
  animeId,
  maxProgress,
  initialIsAdded = false,
  useCacheState = true,
  loginLabel = tr("로그인 후 추가"),
  loginAriaLabel,
  onAddedChange,
}: CollectionButtonProps) {
  const { isAuthenticated } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [localIsAdded, setLocalIsAdded] = useState<boolean | null>(null)
  const cacheIsAdded = isAuthenticated && useCacheState
    ? Boolean(getCachedCollectionEntry(animeId)) || initialIsAdded
    : false
  const isAdded = localIsAdded ?? (useCacheState ? cacheIsAdded : initialIsAdded)

  useEffect(() => {
    if (!isAuthenticated || !useCacheState) {
      return
    }

    const syncCachedState = () => {
      const cachedEntry = getCachedCollectionEntry(animeId)
      setLocalIsAdded(Boolean(cachedEntry))
    }

    const handleCollectionUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{ animeId?: number }>
      const updatedAnimeId = customEvent.detail?.animeId

      if (updatedAnimeId && updatedAnimeId !== animeId) {
        return
      }

      syncCachedState()
      setMessage(null)
      setError(null)
    }

    window.addEventListener(COLLECTION_CACHE_UPDATED_EVENT, handleCollectionUpdated as EventListener)

    return () => {
      window.removeEventListener(COLLECTION_CACHE_UPDATED_EVENT, handleCollectionUpdated as EventListener)
    }
  }, [animeId, isAuthenticated, useCacheState])

  const handleToggle = async () => {
    if (isSubmitting) {
      return
    }

    setIsSubmitting(true)
    setMessage(null)
    setError(null)

    try {
      if (isAdded) {
        await deleteCollectionEntry(animeId)
        setLocalIsAdded(false)
        onAddedChange?.(false)
        setMessage(tr("컬렉션에서 삭제했어요."))
      } else {
        await addToCollection({
          animeId,
          status: 'completed',
          ...(maxProgress && maxProgress > 0 ? { progress: maxProgress } : {}),
        })
        setLocalIsAdded(true)
        onAddedChange?.(true)
        setMessage(tr("컬렉션에 추가했어요."))
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : isAdded
            ? tr("컬렉션에서 삭제하지 못했어요.")
            : tr("컬렉션에 추가하지 못했어요."),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <Link
        className="collection-mini-button is-login"
        to="/login"
        aria-label={loginAriaLabel ?? loginLabel}
      >
        {loginLabel}
      </Link>
    )
  }

  return (
    <div className="collection-mini">
      <button
        className={isAdded ? 'collection-mini-button is-added' : 'collection-mini-button'}
        type="button"
        aria-label={isAdded ? tr("컬렉션에서 삭제") : tr("컬렉션에 추가")}
        onClick={() => {
          void handleToggle()
        }}
        disabled={isSubmitting}
      >
        {isSubmitting ? (isAdded ? tr("삭제 중...") : tr("추가 중...")) : isAdded ? tr("추가됨") : '+'}
      </button>
      {message && <span className="collection-mini-message">{message}</span>}
      <ErrorToast message={error} />
    </div>
  )
}
