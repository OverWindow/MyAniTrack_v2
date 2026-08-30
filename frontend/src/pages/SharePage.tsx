import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ConnectionErrorState } from '../components/ConnectionErrorState'
import { fetchShareDescriptor } from '../lib/shares'
import type { ShareDescriptor } from '../types/share'
import { UserAnalysisPage } from './UserAnalysisPage'
import { UserCollectionPage } from './UserCollectionPage'

type SharePageState = {
  token: string | undefined
  descriptor: ShareDescriptor | null
  isLoading: boolean
  error: string | null
}

function getShareError(error: unknown) {
  const value = error as Error & { code?: string; status?: number }
  if (value.code === 'SHARE_EXPIRED' || value.status === 410) {
    return '이 공유 링크는 만료되었어요.'
  }
  return '공유 링크를 찾을 수 없거나 더 이상 사용할 수 없어요.'
}

export function SharePage() {
  const { token } = useParams<{ token: string }>()
  const [state, setState] = useState<SharePageState>({ token, descriptor: null, isLoading: true, error: null })

  useEffect(() => {
    const previousTitle = document.title
    const existing = document.querySelector<HTMLMetaElement>('meta[name="robots"]')
    const previous = existing?.content
    const meta = existing ?? document.head.appendChild(document.createElement('meta'))
    meta.name = 'robots'
    meta.content = 'noindex,nofollow,noarchive'

    return () => {
      if (existing && previous !== undefined) existing.content = previous
      else meta.remove()
      document.title = previousTitle
    }
  }, [])

  useEffect(() => {
    if (!token) {
      return
    }

    const controller = new AbortController()

    fetchShareDescriptor(token, controller.signal)
      .then((descriptor) => {
        setState({ token, descriptor, isLoading: false, error: null })
        document.title = `${descriptor.owner.username}님의 ${descriptor.resourceType === 'COLLECTION' ? '컬렉션' : '분석'} | MyAniTrack`
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setState({ token, descriptor: null, isLoading: false, error: getShareError(error) })
      })

    return () => controller.abort()
  }, [token])

  if (!token || (state.token === token && state.error)) {
    return (
      <section className="collection-page">
        <ConnectionErrorState message={state.token === token ? state.error ?? '잘못된 공유 주소예요.' : '잘못된 공유 주소예요.'} />
        <Link className="secondary-button" to="/">홈으로 돌아가기</Link>
      </section>
    )
  }

  if (state.token !== token || state.isLoading || !state.descriptor) {
    return <section className="collection-page"><div className="feedback-card">공유 화면을 불러오는 중...</div></section>
  }

  return state.descriptor.resourceType === 'COLLECTION'
    ? <UserCollectionPage shareToken={token} />
    : <UserAnalysisPage shareToken={token} />
}
