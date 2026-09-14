import { tr } from '../i18n'
import { useState } from 'react'
import { Share2 } from 'lucide-react'
import { useToast } from '../contexts/ToastContext'
import { saveMyShare } from '../lib/shares'
import type { ShareResourceType } from '../types/share'
import '../styles/components/ShareButton.css'

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  textarea.style.pointerEvents = 'none'
  document.body.appendChild(textarea)
  textarea.select()

  try {
    if (!document.execCommand('copy')) {
      throw new Error(tr("클립보드 복사에 실패했어요."))
    }
  } finally {
    textarea.remove()
  }
}

export function ShareButton({ resourceType }: { resourceType: ShareResourceType }) {
  const { showError, showSuccess } = useToast()
  const [isSharing, setIsSharing] = useState(false)

  const handleShare = async () => {
    if (isSharing) return

    setIsSharing(true)
    let url: string

    try {
      const share = await saveMyShare(resourceType, null)
      url = share.url
    } catch {
      showError(tr("공유 링크를 만들지 못했어요. 잠시 후 다시 시도해주세요."))
      setIsSharing(false)
      return
    }

    try {
      await copyText(url)
      showSuccess(tr("공유 링크가 클립보드에 복사되었어요."))
    } catch {
      showError(tr("공유 링크는 생성했지만 클립보드에 복사하지 못했어요."))
    } finally {
      setIsSharing(false)
    }
  }

  const label = resourceType === 'COLLECTION' ? tr("컬렉션 공유 링크 복사") : tr("분석 공유 링크 복사")

  return (
    <button
      className="share-trigger-button"
      type="button"
      onClick={() => { void handleShare() }}
      disabled={isSharing}
      aria-label={label}
      aria-busy={isSharing}
      title={label}
    >
      <Share2 size={19} aria-hidden="true" />
    </button>
  )
}
