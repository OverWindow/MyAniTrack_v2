import { useErrorToast } from '../contexts/ToastContext'

export function ErrorToast({ message }: { message?: string | null }) {
  useErrorToast(message)
  return null
}
