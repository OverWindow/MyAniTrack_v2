/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  clearStoredSession,
  consumePendingAgreements,
  createStoredSession,
  fetchMe,
  getSessionRefreshDelay,
  getStoredSession,
  isSessionExpiredError,
  login,
  logoutAllDevices,
  logoutCurrentDevice,
  refreshStoredSession,
  saveStoredSession,
  signup,
  updateMyAgreements,
  updateProfile,
} from '../lib/auth'
import type {
  AuthResponse,
  AuthUser,
  LoginPayload,
  SignupPayload,
  SignupResponse,
  UpdateProfilePayload,
} from '../types/auth'

type AuthContextValue = {
  user: AuthUser | null
  isAuthenticated: boolean
  isBootstrapping: boolean
  loginWithEmail: (payload: LoginPayload) => Promise<void>
  signupWithEmail: (payload: SignupPayload) => Promise<SignupResponse>
  logout: () => Promise<void>
  logoutEverywhere: () => Promise<void>
  refreshMe: () => Promise<void>
  updateMyProfile: (payload: UpdateProfilePayload) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function persistSession(response: AuthResponse) {
  saveStoredSession(createStoredSession(response, response.user))
}

function replaceStoredSessionUser(nextUser: AuthUser | null) {
  const session = getStoredSession()

  if (!session) {
    return
  }

  saveStoredSession({
    ...session,
    user: nextUser,
  })
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const initialSession = getStoredSession()
  const [user, setUser] = useState<AuthUser | null>(() => initialSession?.user ?? null)
  const [isBootstrapping, setIsBootstrapping] = useState(true)

  useEffect(() => {
    const session = getStoredSession()

    const loadMe = async () => {
      try {
        await refreshStoredSession()
        const me = await fetchMe()
        setUser(me)
        replaceStoredSessionUser(me)
      } catch (error) {
        if (isSessionExpiredError(error)) {
          clearStoredSession()
          setUser(null)
        } else {
          setUser((current) => current ?? session?.user ?? null)
        }
      } finally {
        setIsBootstrapping(false)
      }
    }

    void loadMe()
  }, [])

  useEffect(() => {
    if (!user) {
      return
    }

    const session = getStoredSession()

    const timeoutId = window.setTimeout(() => {
      const refreshInBackground = async () => {
        try {
          const nextSession = await refreshStoredSession()
          setUser((current) => current ?? nextSession.user ?? null)
        } catch (error) {
          if (isSessionExpiredError(error)) {
            clearStoredSession()
            setUser(null)
          }
        }
      }

      void refreshInBackground()
    }, getSessionRefreshDelay(session ?? { user }))

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [user])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isBootstrapping,
      async loginWithEmail(payload) {
        const response = await login(payload)
        persistSession(response)
        setUser(response.user)

        const pendingAgreements = consumePendingAgreements(response.user.email)

        if (pendingAgreements) {
          try {
            await updateMyAgreements(pendingAgreements)
          } catch {
            // Ignore agreement sync failures during login; the user can retry later.
          }
        }
      },
      async signupWithEmail(payload) {
        return signup(payload)
      },
      async logout() {
        try {
          await logoutCurrentDevice()
        } finally {
          clearStoredSession()
          setUser(null)
        }
      },
      async logoutEverywhere() {
        try {
          await logoutAllDevices()
        } finally {
          clearStoredSession()
          setUser(null)
        }
      },
      async refreshMe() {
        await refreshStoredSession()
        const me = await fetchMe()
        setUser(me)
        replaceStoredSessionUser(me)
      },
      async updateMyProfile(payload) {
        if (!user) {
          throw new Error('로그인 후에 프로필을 수정할 수 있어요.')
        }

        const updatedUser = await updateProfile(payload)
        setUser(updatedUser)
        saveStoredSession({ ...(getStoredSession() ?? {}), user: updatedUser })
      },
    }),
    [isBootstrapping, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth는 AuthProvider 안에서 사용해야 합니다.')
  }

  return context
}
