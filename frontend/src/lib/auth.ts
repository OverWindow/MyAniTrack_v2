import type {
  AuthResponse,
  AuthTokens,
  AuthUser,
  LoginPayload,
  SignupPayload,
  StoredSession,
  UpdateProfilePayload,
} from '../types/auth'

const SESSION_STORAGE_KEY = 'myanitrack.auth.session'

let refreshPromise: Promise<AuthTokens> | null = null

function getApiBaseUrl() {
  const baseUrl = import.meta.env.VITE_API_BASE_URL

  if (!baseUrl) {
    throw new Error('VITE_API_BASE_URL이 설정되지 않았습니다.')
  }

  return baseUrl
}

function createUrl(path: string) {
  return new URL(path, getApiBaseUrl()).toString()
}

export function getStoredSession(): StoredSession | null {
  const raw = window.localStorage.getItem(SESSION_STORAGE_KEY)

  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as StoredSession
  } catch {
    window.localStorage.removeItem(SESSION_STORAGE_KEY)
    return null
  }
}

export function saveStoredSession(session: StoredSession) {
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
}

export function clearStoredSession() {
  window.localStorage.removeItem(SESSION_STORAGE_KEY)
}

function getErrorMessage(status: number, fallback: string) {
  if (status === 400) {
    return '요청 형식이 올바르지 않아요.'
  }

  if (status === 401) {
    return '인증 정보가 올바르지 않거나 만료되었어요.'
  }

  if (status === 404) {
    return '요청한 정보를 찾을 수 없어요.'
  }

  if (status >= 500) {
    return '서버 오류가 발생했어요. 잠시 후 다시 시도해주세요.'
  }

  return fallback
}

async function parseAuthResponse(response: Response, fallback: string) {
  if (!response.ok) {
    throw new Error(getErrorMessage(response.status, fallback))
  }

  return (await response.json()) as AuthResponse
}

export async function signup(payload: SignupPayload) {
  const response = await fetch(createUrl('/api/auth/signup'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return parseAuthResponse(response, '회원가입에 실패했어요.')
}

export async function login(payload: LoginPayload) {
  const response = await fetch(createUrl('/api/auth/login'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return parseAuthResponse(response, '로그인에 실패했어요.')
}

export async function refreshAuth(refreshToken: string) {
  const response = await fetch(createUrl('/api/auth/refresh'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  })

  if (!response.ok) {
    throw new Error(getErrorMessage(response.status, '토큰 갱신에 실패했어요.'))
  }

  return (await response.json()) as AuthTokens
}

export async function fetchMe(accessToken?: string) {
  const response = accessToken
    ? await authFetch(createUrl('/api/auth/me'), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
    : await authFetch(createUrl('/api/auth/me'))

  if (!response.ok) {
    throw new Error(getErrorMessage(response.status, '내 정보를 불러오지 못했어요.'))
  }

  return (await response.json()) as AuthUser
}

export async function logoutCurrentDevice(refreshToken: string) {
  const response = await fetch(createUrl('/api/auth/logout'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  })

  if (!response.ok) {
    throw new Error(getErrorMessage(response.status, '로그아웃에 실패했어요.'))
  }
}

export async function logoutAllDevices(accessToken: string) {
  const response = await fetch(createUrl('/api/auth/logout-all'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    throw new Error(getErrorMessage(response.status, '모든 기기 로그아웃에 실패했어요.'))
  }
}

export async function updateProfile(payload: UpdateProfilePayload) {
  const formData = new FormData()

  if (payload.username !== undefined) {
    formData.append('username', payload.username)
  }

  if (payload.profileImage) {
    formData.append('profileImage', payload.profileImage)
  }

  if (payload.removeProfileImage) {
    formData.append('removeProfileImage', 'true')
  }

  const response = await authFetch(createUrl('/api/me/profile'), {
    method: 'PATCH',
    body: formData,
  })

  if (!response.ok) {
    throw new Error(getErrorMessage(response.status, '프로필 수정에 실패했어요.'))
  }

  const data = (await response.json()) as {
    success: boolean
    message: string
    user: AuthUser
  }

  return data.user
}

async function ensureFreshTokens() {
  const session = getStoredSession()

  if (!session?.refreshToken) {
    throw new Error('세션이 만료되었어요. 다시 로그인해주세요.')
  }

  if (!refreshPromise) {
    refreshPromise = refreshAuth(session.refreshToken)
      .then((tokens) => {
        const nextSession: StoredSession = {
          ...tokens,
          user: session.user,
        }

        saveStoredSession(nextSession)
        return tokens
      })
      .finally(() => {
        refreshPromise = null
      })
  }

  return refreshPromise
}

export async function authFetch(input: string, init: RequestInit = {}) {
  const session = getStoredSession()
  const headers = new Headers(init.headers)

  if (session?.accessToken) {
    headers.set('Authorization', `Bearer ${session.accessToken}`)
  }

  let response = await fetch(input, {
    ...init,
    headers,
  })

  if (response.status !== 401 || !session?.refreshToken) {
    return response
  }

  try {
    const tokens = await ensureFreshTokens()
    const retryHeaders = new Headers(init.headers)
    retryHeaders.set('Authorization', `Bearer ${tokens.accessToken}`)

    response = await fetch(input, {
      ...init,
      headers: retryHeaders,
    })
  } catch {
    clearStoredSession()
    throw new Error('세션이 만료되었어요. 다시 로그인해주세요.')
  }

  return response
}
