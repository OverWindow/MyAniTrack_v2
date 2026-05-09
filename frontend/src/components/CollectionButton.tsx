import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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
}

export function CollectionButton({ animeId, maxProgress }: CollectionButtonProps) {
  const { isAuthenticated, user } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [isAdded, setIsAdded] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) {
      setIsAdded(false)
      setMessage(null)
      return
    }

    const syncCachedState = () => {
      setIsAdded(Boolean(getCachedCollectionEntry(animeId)))
    }

    const handleCollectionUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{ animeId?: number }>
      const updatedAnimeId = customEvent.detail?.animeId

      if (updatedAnimeId && updatedAnimeId !== animeId) {
        return
      }

      syncCachedState()
      setMessage(null)
    }

    syncCachedState()
    setMessage(null)
    window.addEventListener(COLLECTION_CACHE_UPDATED_EVENT, handleCollectionUpdated as EventListener)

    return () => {
      window.removeEventListener(COLLECTION_CACHE_UPDATED_EVENT, handleCollectionUpdated as EventListener)
    }
  }, [animeId, isAuthenticated, user?.id])

  const handleToggle = async () => {
    if (isSubmitting) {
      return
    }

    setIsSubmitting(true)
    setMessage(null)

    try {
      if (isAdded) {
        await deleteCollectionEntry(animeId)
        setIsAdded(false)
        setMessage('컬렉션에서 삭제했어요.')
      } else {
        await addToCollection({
          animeId,
          status: 'completed',
          ...(maxProgress && maxProgress > 0 ? { progress: maxProgress } : {}),
        })
        setIsAdded(true)
        setMessage('컬렉션에 추가했어요.')
      }
    } catch (submitError) {
      setMessage(
        submitError instanceof Error
          ? submitError.message
          : isAdded
            ? '컬렉션에서 삭제하지 못했어요.'
            : '컬렉션에 추가하지 못했어요.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <Link className="collection-mini-button is-login" to="/login">
        로그인 후 추가
      </Link>
    )
  }

  return (
    <div className="collection-mini">
      <button
        className={isAdded ? 'collection-mini-button is-added' : 'collection-mini-button'}
        type="button"
        aria-label={isAdded ? '컬렉션에서 삭제' : '컬렉션에 추가'}
        onClick={() => {
          void handleToggle()
        }}
        disabled={isSubmitting}
      >
        {isSubmitting ? (isAdded ? '삭제 중...' : '추가 중...') : isAdded ? '추가됨' : '+'}
      </button>
      {message && <span className="collection-mini-message">{message}</span>}
    </div>
  )
}
