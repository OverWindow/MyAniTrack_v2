import serverConnectionErrorImage from '../assets/server-connection-error.png'
import { useErrorToast } from '../contexts/ToastContext'
import { SERVER_CONNECTION_ERROR_MESSAGE } from '../lib/errors'

type ConnectionErrorStateProps = {
  className?: string
  message?: string | null
  onRetry?: (() => void) | null
}

export function ConnectionErrorState({
  className = '',
  message = SERVER_CONNECTION_ERROR_MESSAGE,
  onRetry = () => window.location.reload(),
}: ConnectionErrorStateProps) {
  useErrorToast(message)
  const classNames = ['connection-error-plain', className].filter(Boolean).join(' ')

  return (
    <div className={classNames}>
      <img src={serverConnectionErrorImage} alt="" aria-hidden="true" loading="lazy" />
      <p>지금은 콘텐츠를 표시할 수 없어요.</p>
      {onRetry && (
        <button className="secondary-button" type="button" onClick={onRetry}>
          다시 시도
        </button>
      )}
    </div>
  )
}
