import type {
  AuthResponse,
  AuthTokens,
  AuthUser,
  LoginPayload,
  PasswordResetConfirmResponse,
  PasswordResetRequestResponse,
  SignupPayload,
  SignupResponse,
  StoredSession,
  UpdateAgreementsPayload,
  UpdateProfilePayload,
  UserAgreements,
  VerifyEmailConfirmResponse,
  VerifyEmailResendResponse,
} from '../types/auth'

const SESSION_STORAGE_KEY = 'myanitrack.auth.session'
const PENDING_AGREEMENTS_KEY = 'myanitrack.pending.agreements'
const ACCESS_TOKEN_REFRESH_BUFFER_MS = 60_000

let refreshPromise: Promise<AuthTokens> | null = null
let memoryAccessToken: string | null = null
let memoryAccessTokenExpiresAt: number | null = null

type PendingAgreementsState = {
  email: string
  payload: UpdateAgreementsPayload
}

type AuthApiError = Error & {
  code?: string
  status?: number
}

function createAuthError(message: string, status?: number, code?: string) {
  return Object.assign(new Error(message), { status, code }) as AuthApiError
}

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

function getAccessTokenExpiresAt(accessTokenExpiresIn: number) {
  return Date.now() + Math.max(accessTokenExpiresIn, 1) * 1000
}

function normalizeStoredSession(session: StoredSession) {
  return {
    user: session.user ?? null,
    accessTokenExpiresAt:
      typeof session.accessTokenExpiresAt === 'number' && Number.isFinite(session.accessTokenExpiresAt)
        ? session.accessTokenExpiresAt
        : undefined,
  } satisfies StoredSession
}

export function createStoredSession(tokens: AuthTokens, user: AuthUser | null) {
  setMemoryTokens(tokens)
  return {
    user,
    accessTokenExpiresAt: getAccessTokenExpiresAt(tokens.accessTokenExpiresIn),
  } satisfies StoredSession
}

function setMemoryTokens(tokens: AuthTokens) {
  memoryAccessToken = tokens.accessToken
  memoryAccessTokenExpiresAt = getAccessTokenExpiresAt(tokens.accessTokenExpiresIn)
}

function clearMemoryTokens() {
  memoryAccessToken = null
  memoryAccessTokenExpiresAt = null
}

function getMemoryAccessToken() {
  return memoryAccessToken
}

export function getStoredSession(): StoredSession | null {
  const raw = window.localStorage.getItem(SESSION_STORAGE_KEY)

  if (!raw) {
    return null
  }

  try {
    return normalizeStoredSession(JSON.parse(raw) as StoredSession)
  } catch {
    window.localStorage.removeItem(SESSION_STORAGE_KEY)
    return null
  }
}

export function saveStoredSession(session: StoredSession) {
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
}

export function clearStoredSession() {
  clearMemoryTokens()
  window.localStorage.removeItem(SESSION_STORAGE_KEY)
}

export function savePendingAgreements(email: string, payload: UpdateAgreementsPayload) {
  const nextValue: PendingAgreementsState = {
    email: email.trim().toLowerCase(),
    payload,
  }

  window.localStorage.setItem(PENDING_AGREEMENTS_KEY, JSON.stringify(nextValue))
}

export function consumePendingAgreements(email: string) {
  const raw = window.localStorage.getItem(PENDING_AGREEMENTS_KEY)

  if (!raw) {
    return null
  }

  try {
    const stored = JSON.parse(raw) as PendingAgreementsState

    if (stored.email !== email.trim().toLowerCase()) {
      return null
    }

    window.localStorage.removeItem(PENDING_AGREEMENTS_KEY)
    return stored.payload
  } catch {
    window.localStorage.removeItem(PENDING_AGREEMENTS_KEY)
    return null
  }
}

export function isSessionExpiredError(error: unknown) {
  return error instanceof Error && error.message.includes('세션이 만료되었어요')
}

export function isEmailVerificationRequiredError(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as AuthApiError).code === 'EMAIL_VERIFICATION_REQUIRED')
}

function getErrorMessage(status: number, fallback: string) {
  if (status === 400) {
    return '요청 형식이 올바르지 않아요.'
  }

  if (status === 401) {
    return '인증 정보가 올바르지 않거나 만료되었어요.'
  }

  if (status === 403) {
    return '이 작업을 수행할 권한이 없어요.'
  }

  if (status === 404) {
    return '요청한 정보를 찾을 수 없어요.'
  }

  if (status >= 500) {
    return '서버 오류가 발생했어요. 잠시 후 다시 시도해주세요.'
  }

  return fallback
}

function extractAuthUser(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  if ('user' in payload && payload.user && typeof payload.user === 'object') {
    return payload.user as AuthUser
  }

  return payload as AuthUser
}

async function parseAuthResponse(response: Response, fallback: string) {
  if (!response.ok) {
    throw createAuthError(getErrorMessage(response.status, fallback), response.status)
  }

  return (await response.json()) as AuthResponse
}

async function parseJsonSafe<T>(response: Response) {
  try {
    return (await response.json()) as T
  } catch {
    return null
  }
}

export async function signup(payload: SignupPayload) {
  const response = await fetch(createUrl('/api/auth/signup'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw createAuthError(getErrorMessage(response.status, '회원가입에 실패했어요.'), response.status)
  }

  return (await response.json()) as SignupResponse
}

export async function login(payload: LoginPayload) {
  const response = await fetch(createUrl('/api/auth/login'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (response.status === 403) {
    const data = await parseJsonSafe<{ success?: boolean; message?: string }>(response)

    if (data?.message === 'Email verification required') {
      throw createAuthError('이메일 인증이 필요해요. 메일 인증 후 다시 로그인해주세요.', 403, 'EMAIL_VERIFICATION_REQUIRED')
    }
  }

  return parseAuthResponse(response, '로그인에 실패했어요.')
}

export async function resendVerificationEmail(email: string) {
  const response = await fetch(createUrl('/api/auth/verify-email/resend'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  })

  if (!response.ok) {
    throw createAuthError(getErrorMessage(response.status, '인증 메일 재전송에 실패했어요.'), response.status)
  }

  return (await response.json()) as VerifyEmailResendResponse
}

export async function confirmEmailVerification(token: string) {
  const response = await fetch(createUrl('/api/auth/verify-email/confirm'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token }),
  })

  if (!response.ok) {
    throw createAuthError(getErrorMessage(response.status, '이메일 인증 확인에 실패했어요.'), response.status)
  }

  return (await response.json()) as VerifyEmailConfirmResponse
}

export async function requestPasswordReset(email: string) {
  const response = await fetch(createUrl('/api/auth/password-reset/request'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  })

  if (!response.ok) {
    throw createAuthError(getErrorMessage(response.status, '비밀번호 재설정 메일 요청에 실패했어요.'), response.status)
  }

  return (await response.json()) as PasswordResetRequestResponse
}

export async function confirmPasswordReset(token: string, newPassword: string) {
  const response = await fetch(createUrl('/api/auth/password-reset/confirm'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token, newPassword }),
  })

  if (!response.ok) {
    const data = await parseJsonSafe<{ success?: boolean; message?: string }>(response)
    const serverMessage = data?.message

    if (serverMessage === 'token is required') {
      throw createAuthError('재설정 토큰이 없어 비밀번호를 변경할 수 없어요.', response.status)
    }

    if (serverMessage === 'password must be between 8 and 72 characters') {
      throw createAuthError('비밀번호는 8자 이상 72자 이하로 입력해주세요.', response.status)
    }

    if (serverMessage === 'Invalid password reset token') {
      throw createAuthError('재설정 링크가 올바르지 않아요. 새 메일을 다시 요청해주세요.', response.status)
    }

    if (serverMessage === 'Password reset token has already been used') {
      throw createAuthError('이미 사용된 재설정 링크예요. 새 메일을 다시 요청해주세요.', response.status)
    }

    if (serverMessage === 'Password reset token has expired') {
      throw createAuthError('재설정 링크가 만료됐어요. 새 메일을 다시 요청해주세요.', response.status)
    }

    throw createAuthError(serverMessage || getErrorMessage(response.status, '비밀번호 재설정에 실패했어요.'), response.status)
  }

  return (await response.json()) as PasswordResetConfirmResponse
}

export async function checkUsernameAvailability(username: string) {
  const url = new URL('/api/auth/check-username', getApiBaseUrl())
  url.searchParams.set('username', username)

  const response = await fetch(url.toString())

  if (response.status === 400) {
    const data = (await response.json()) as { success: false; message: string }
    throw new Error(data.message)
  }

  if (!response.ok) {
    throw new Error(getErrorMessage(response.status, '닉네임 중복 확인에 실패했어요.'))
  }

  return (await response.json()) as {
    success: true
    username: string
    available: boolean
  }
}

export async function refreshAuth() {
  const response = await fetch(createUrl('/api/auth/refresh'), {
    method: 'POST',
    credentials: 'include',
  })

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('세션이 만료되었어요. 다시 로그인해주세요.')
    }

    throw new Error(getErrorMessage(response.status, '토큰 갱신에 실패했어요.'))
  }

  const tokens = (await response.json()) as AuthTokens
  setMemoryTokens(tokens)
  return tokens
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

  const data = await response.json()
  const user = extractAuthUser(data)

  if (!user) {
    throw new Error('내 정보를 불러오지 못했어요.')
  }

  return user
}

export async function fetchMyAgreements() {
  const response = await authFetch(createUrl('/api/me/agreements'))

  if (!response.ok) {
    throw new Error(getErrorMessage(response.status, '약관 동의 상태를 불러오지 못했어요.'))
  }

  const data = (await response.json()) as {
    success: boolean
    item: UserAgreements
  }

  return data.item
}

export async function updateMyAgreements(payload: UpdateAgreementsPayload) {
  const response = await authFetch(createUrl('/api/me/agreements'), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(getErrorMessage(response.status, '약관 동의 저장에 실패했어요.'))
  }

  const data = (await response.json()) as {
    success: boolean
    item: UserAgreements
  }

  return data.item
}

export async function logoutCurrentDevice() {
  const response = await fetch(createUrl('/api/auth/logout'), {
    method: 'POST',
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error(getErrorMessage(response.status, '로그아웃에 실패했어요.'))
  }
}

export async function logoutAllDevices() {
  const headers = new Headers()
  const accessToken = getMemoryAccessToken()

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  const response = await fetch(createUrl('/api/auth/logout-all'), {
    method: 'POST',
    credentials: 'include',
    headers,
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
    const data = await parseJsonSafe<{ success?: boolean; message?: string }>(response)

    if (data?.message === 'Username already exists') {
      throw createAuthError('이미 사용 중인 닉네임이에요.', response.status)
    }

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

  if (!refreshPromise) {
    refreshPromise = refreshAuth()
      .then((tokens) => {
        const nextSession = createStoredSession(tokens, session?.user ?? null)
        saveStoredSession(nextSession)
        return tokens
      })
      .finally(() => {
        refreshPromise = null
      })
  }

  return refreshPromise
}

export async function refreshStoredSession() {
  const tokens = await ensureFreshTokens()
  const nextSession = getStoredSession()

  if (!nextSession) {
    const restoredSession = createStoredSession(tokens, null)
    saveStoredSession(restoredSession)
    return restoredSession
  }

  return nextSession
}

export function getSessionRefreshDelay(session: StoredSession) {
  const expiresAt = memoryAccessTokenExpiresAt ?? session.accessTokenExpiresAt ?? Date.now() + 15_000
  const remainingMs = expiresAt - Date.now() - ACCESS_TOKEN_REFRESH_BUFFER_MS
  return Math.max(remainingMs, 15_000)
}

export async function authFetch(input: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  const accessToken = getMemoryAccessToken()

  if (accessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  let response = await fetch(input, {
    ...init,
    credentials: 'include',
    headers,
  })

  if (response.status !== 401) {
    return response
  }

  try {
    const tokens = await ensureFreshTokens()
    const retryHeaders = new Headers(init.headers)
    retryHeaders.set('Authorization', `Bearer ${tokens.accessToken}`)

    response = await fetch(input, {
      ...init,
      credentials: 'include',
      headers: retryHeaders,
    })
  } catch {
    clearStoredSession()
    throw new Error('세션이 만료되었어요. 다시 로그인해주세요.')
  }

  return response
}
