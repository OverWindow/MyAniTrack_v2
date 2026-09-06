import { tr } from '../i18n'
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
  createStoredSession,
  createSupabaseStoredSession,
  completeSupabaseLogin,
  deleteMyAccount,
  fetchMe,
  getSessionRefreshDelay,
  getStoredSession,
  hasSupabaseSession,
  isSessionExpiredError,
  login,
  logoutSupabaseSession,
  logoutAllDevices,
  logoutCurrentDevice,
  refreshStoredSession,
  saveStoredSession,
  signInWithGoogle,
  updateProfile,
} from '../lib/auth'
import type {
  AuthResponse,
  AuthUser,
  LoginPayload,
  UpdateProfilePayload,
} from '../types/auth'

type AuthContextValue = {
  user: AuthUser | null
  isAuthenticated: boolean
  isBootstrapping: boolean
  loginWithEmail: (payload: LoginPayload) => Promise<void>
  loginWithGoogle: () => Promise<void>
  completeGoogleLogin: () => Promise<void>
  logout: () => Promise<void>
  logoutEverywhere: () => Promise<void>
  deleteAccount: () => Promise<void>
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
  const isAuthCallbackRoute = window.location.pathname === '/auth/callback'
  const [user, setUser] = useState<AuthUser | null>(() => isAuthCallbackRoute ? null : initialSession?.user ?? null)
  const [isBootstrapping, setIsBootstrapping] = useState(() => !isAuthCallbackRoute)

  useEffect(() => {
    if (isAuthCallbackRoute) {
      return
    }

    const session = getStoredSession()

    const loadMe = async () => {
      try {
        if (await hasSupabaseSession()) {
          const me = await fetchMe()
          setUser(me)
          saveStoredSession(createSupabaseStoredSession(me))
          return
        }

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
  }, [isAuthCallbackRoute])

  useEffect(() => {
    if (!user) {
      return
    }

    const session = getStoredSession()

    if (session?.authMode === 'supabase') {
      return
    }

    if (!session || session.authMode !== 'legacy') {
      return
    }

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

      },
      async loginWithGoogle() {
        await signInWithGoogle()
      },
      async completeGoogleLogin() {
        const nextUser = await completeSupabaseLogin()
        setUser(nextUser)
      },
      async logout() {
        try {
          await logoutCurrentDevice()
        } finally {
          await logoutSupabaseSession().catch(() => {})
          clearStoredSession()
          setUser(null)
        }
      },
      async logoutEverywhere() {
        try {
          await logoutAllDevices()
        } finally {
          await logoutSupabaseSession().catch(() => {})
          clearStoredSession()
          setUser(null)
        }
      },
      async deleteAccount() {
        await deleteMyAccount()

        try {
          await logoutSupabaseSession().catch(() => {})
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
        if (!getStoredSession()?.user) {
          throw new Error(tr("로그인 후에 프로필을 수정할 수 있어요."))
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
    throw new Error(tr("useAuth는 AuthProvider 안에서 사용해야 합니다."))
  }

  return context
}
