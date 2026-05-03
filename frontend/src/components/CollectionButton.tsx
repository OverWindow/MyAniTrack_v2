import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { addToCollection, getCachedCollectionEntry } from '../lib/collection'
import '../styles/components/CollectionButton.css'

type CollectionButtonProps = {
  animeId: number
}

export function CollectionButton({ animeId }: CollectionButtonProps) {
  const { isAuthenticated } = useAuth()
  const initialAddedState = Boolean(getCachedCollectionEntry(animeId))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [isAdded, setIsAdded] = useState(initialAddedState)

  const handleAdd = async () => {
    if (isAdded || isSubmitting) {
      return
    }

    setIsSubmitting(true)
    setMessage(null)

    try {
      await addToCollection({
        animeId,
        status: 'completed',
      })
      setIsAdded(true)
      setMessage('컬렉션에 추가했어요.')
    } catch (submitError) {
      setMessage(
        submitError instanceof Error
          ? submitError.message
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
        onClick={() => {
          void handleAdd()
        }}
        disabled={isSubmitting}
      >
        {isSubmitting ? '추가 중...' : isAdded ? '추가됨' : '+'}
      </button>
      {message && <span className="collection-mini-message">{message}</span>}
    </div>
  )
}
