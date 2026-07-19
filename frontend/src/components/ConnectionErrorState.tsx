import serverConnectionErrorImage from '../assets/server-connection-error.png'
import { SERVER_CONNECTION_ERROR_MESSAGE } from '../lib/errors'

type ConnectionErrorStateProps = {
  className?: string
  message?: string | null
}

export function ConnectionErrorState({
  className = '',
  message = SERVER_CONNECTION_ERROR_MESSAGE,
}: ConnectionErrorStateProps) {
  const classNames = ['connection-error-plain', className].filter(Boolean).join(' ')

  return (
    <div className={classNames}>
      <img src={serverConnectionErrorImage} alt="" aria-hidden="true" loading="lazy" />
      <p>{message || SERVER_CONNECTION_ERROR_MESSAGE}</p>
    </div>
  )
}
