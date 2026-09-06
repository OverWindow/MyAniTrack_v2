/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { fetchMaintenanceSettings } from '../lib/maintenance'
import type { MaintenanceSettings } from '../types/maintenance'

type MaintenanceContextValue = {
  settings: MaintenanceSettings | null
  isLoading: boolean
  refresh: () => Promise<void>
  syncSettings: (settings: MaintenanceSettings) => void
}

const MaintenanceContext = createContext<MaintenanceContextValue | null>(null)

export function MaintenanceProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<MaintenanceSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadSettings = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true)

    try {
      const nextSettings = await fetchMaintenanceSettings(signal)
      setSettings(nextSettings)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }

      // Fail open: a status endpoint failure must not accidentally take down the web app.
      setSettings(null)
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    void fetchMaintenanceSettings(controller.signal)
      .then((nextSettings) => {
        setSettings(nextSettings)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }

        // Fail open: a status endpoint failure must not accidentally take down the web app.
        setSettings(null)
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      })

    return () => controller.abort()
  }, [])

  const value = useMemo<MaintenanceContextValue>(() => ({
    settings,
    isLoading,
    refresh: () => loadSettings(),
    syncSettings: setSettings,
  }), [isLoading, loadSettings, settings])

  return <MaintenanceContext.Provider value={value}>{children}</MaintenanceContext.Provider>
}

export function useMaintenance() {
  const context = useContext(MaintenanceContext)

  if (!context) {
    throw new Error('useMaintenance must be used within MaintenanceProvider.')
  }

  return context
}
