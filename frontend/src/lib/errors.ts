import { localizeExternalMessage, tr } from '../i18n'
export const SERVER_CONNECTION_ERROR_MESSAGE = tr("서버와의 연결을 실패 했어요ㅠㅠ")

export function isServerConnectionError(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }

  const message = error.message.toLowerCase()

  return (
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('network error') ||
    message.includes('load failed')
  )
}

export function getFriendlyErrorMessage(error: unknown, fallback: string) {
  if (isServerConnectionError(error)) {
    return SERVER_CONNECTION_ERROR_MESSAGE
  }

  return error instanceof Error
    ? localizeExternalMessage(error.message, fallback)
    : fallback
}
