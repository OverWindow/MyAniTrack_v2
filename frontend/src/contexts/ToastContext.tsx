/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { CircleAlert, CircleCheck, X } from 'lucide-react'

type ToastItem = {
  id: number
  message: string
  variant: 'error' | 'success'
}

type ToastContextValue = {
  showError: (message: string) => void
  showSuccess: (message: string) => void
  dismissToast: (id: number) => void
}

const TOAST_DURATION_MS = 3_000
const MAX_VISIBLE_TOASTS = 3

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextIdRef = useRef(1)
  const timersRef = useRef(new Map<number, number>())

  const dismissToast = useCallback((id: number) => {
    const timerId = timersRef.current.get(id)

    if (timerId !== undefined) {
      window.clearTimeout(timerId)
      timersRef.current.delete(id)
    }

    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback((message: string, variant: ToastItem['variant']) => {
    const normalizedMessage = message.trim()

    if (!normalizedMessage) return

    setToasts((current) => {
      if (current.some((toast) => toast.message === normalizedMessage && toast.variant === variant)) {
        return current
      }

      const nextToast = { id: nextIdRef.current, message: normalizedMessage, variant }
      nextIdRef.current += 1
      return [...current, nextToast].slice(-MAX_VISIBLE_TOASTS)
    })
  }, [])

  const showError = useCallback((message: string) => showToast(message, 'error'), [showToast])
  const showSuccess = useCallback((message: string) => showToast(message, 'success'), [showToast])

  useEffect(() => {
    const visibleIds = new Set(toasts.map((toast) => toast.id))

    for (const [id, timerId] of timersRef.current) {
      if (!visibleIds.has(id)) {
        window.clearTimeout(timerId)
        timersRef.current.delete(id)
      }
    }

    for (const toast of toasts) {
      if (timersRef.current.has(toast.id)) continue

      const timerId = window.setTimeout(() => dismissToast(toast.id), TOAST_DURATION_MS)
      timersRef.current.set(toast.id, timerId)
    }
  }, [dismissToast, toasts])

  useEffect(() => () => {
    for (const timerId of timersRef.current.values()) {
      window.clearTimeout(timerId)
    }
    timersRef.current.clear()
  }, [])

  const value = useMemo(() => ({ showError, showSuccess, dismissToast }), [dismissToast, showError, showSuccess])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" aria-label="알림">
        {toasts.map((toast) => (
          <div className={`error-toast ${toast.variant === 'success' ? 'success-toast' : ''}`} role={toast.variant === 'error' ? 'alert' : 'status'} key={toast.id}>
            {toast.variant === 'success'
              ? <CircleCheck className="error-toast-icon" size={20} aria-hidden="true" />
              : <CircleAlert className="error-toast-icon" size={20} aria-hidden="true" />}
            <p>{toast.message}</p>
            <button
              type="button"
              className="error-toast-close"
              onClick={() => dismissToast(toast.id)}
              aria-label="알림 닫기"
            >
              <X size={17} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const value = useContext(ToastContext)

  if (!value) {
    throw new Error('useToast는 ToastProvider 안에서 사용해야 합니다.')
  }

  return value
}

export function useErrorToast(message?: string | null) {
  const { showError } = useToast()
  const lastMessageRef = useRef<string | null>(null)

  useEffect(() => {
    const normalizedMessage = message?.trim() || null

    if (!normalizedMessage) {
      lastMessageRef.current = null
      return
    }

    if (lastMessageRef.current === normalizedMessage) return

    lastMessageRef.current = normalizedMessage
    showError(normalizedMessage)
  }, [message, showError])
}
