import { authFetch } from './auth'
import { tr } from '../i18n'
import type {
  MaintenanceSettings,
  MaintenanceSettingsResponse,
  MaintenanceSettingsUpdate,
} from '../types/maintenance'

function getApiBaseUrl() {
  const baseUrl = import.meta.env.VITE_API_BASE_URL

  if (!baseUrl) {
    throw new Error(tr('VITE_API_BASE_URL이 설정되지 않았습니다.'))
  }

  return baseUrl
}

function createMaintenanceUrl(path: string) {
  return new URL(path, getApiBaseUrl()).toString()
}

export async function fetchMaintenanceSettings(signal?: AbortSignal): Promise<MaintenanceSettings> {
  const response = await fetch(createMaintenanceUrl('/api/maintenance'), {
    cache: 'no-store',
    signal,
  })

  if (!response.ok) {
    throw new Error(tr('서비스 상태를 확인하지 못했어요.'))
  }

  return ((await response.json()) as MaintenanceSettingsResponse).item
}

export async function updateMaintenanceSettings(payload: MaintenanceSettingsUpdate) {
  const response = await authFetch(createMaintenanceUrl('/admin/maintenance'), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    if (response.status === 400) {
      throw new Error(tr('제목과 안내 문구의 입력값을 확인해주세요.'))
    }
    if (response.status === 401) {
      throw new Error(tr('관리자 인증이 필요해요. 다시 로그인해주세요.'))
    }
    if (response.status === 403) {
      throw new Error(tr('관리자 권한이 있는 계정만 사용할 수 있어요.'))
    }
    throw new Error(tr('점검 모드 설정을 저장하지 못했어요.'))
  }

  return ((await response.json()) as MaintenanceSettingsResponse).item
}

const MAINTENANCE_BYPASS_PATHS = new Set([
  '/login',
  '/signup',
  '/auth/callback',
  '/verify-email/pending',
  '/verify-email/confirm',
  '/password-reset',
  '/password-reset/confirm',
  '/terms',
  '/privacy',
  '/account-deletion',
])

export function isMaintenanceBypassPath(pathname: string) {
  return MAINTENANCE_BYPASS_PATHS.has(pathname)
}

export type MaintenanceGateState = 'loading' | 'maintenance' | 'app'

export function getMaintenanceGateState(options: {
  pathname: string
  settings: MaintenanceSettings | null
  isMaintenanceLoading: boolean
  isAuthBootstrapping: boolean
  isAdmin: boolean
}): MaintenanceGateState {
  if (options.isMaintenanceLoading) {
    return 'loading'
  }

  if (!options.settings?.enabled || isMaintenanceBypassPath(options.pathname)) {
    return 'app'
  }

  if (options.isAuthBootstrapping) {
    return 'loading'
  }

  return options.isAdmin ? 'app' : 'maintenance'
}
