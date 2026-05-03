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
  fetchMe,
  getStoredSession,
  login,
  logoutAllDevices,
  logoutCurrentDevice,
  saveStoredSession,
  signup,
  updateProfile,
} from '../lib/auth'
import type {
  AuthResponse,
  AuthUser,
  LoginPayload,
  SignupPayload,
  UpdateProfilePayload,
} from '../types/auth'

type AuthContextValue = {
  user: AuthUser | null
  isAuthenticated: boolean
  isBootstrapping: boolean
  loginWithEmail: (payload: LoginPayload) => Promise<void>
  signupWithEmail: (payload: SignupPayload) => Promise<void>
  logout: () => Promise<void>
  logoutEverywhere: () => Promise<void>
  refreshMe: () => Promise<void>
  updateMyProfile: (payload: UpdateProfilePayload) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function persistSession(response: AuthResponse) {
  saveStoredSession({
    accessToken: response.accessToken,
    refreshToken: response.refreshToken,
    accessTokenExpiresIn: response.accessTokenExpiresIn,
    tokenType: response.tokenType,
    user: response.user,
  })
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const initialSession = getStoredSession()
  const [user, setUser] = useState<AuthUser | null>(() => initialSession?.user ?? null)
  const [isBootstrapping, setIsBootstrapping] = useState(() => Boolean(initialSession))

  useEffect(() => {
    const session = getStoredSession()

    if (!session?.accessToken) {
      return
    }

    const loadMe = async () => {
      try {
        const me = await fetchMe(session.accessToken)
        setUser(me)
        saveStoredSession({ ...session, user: me })
      } catch {
        clearStoredSession()
        setUser(null)
      } finally {
        setIsBootstrapping(false)
      }
    }

    void loadMe()
  }, [])

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
      async signupWithEmail(payload) {
        const response = await signup(payload)
        persistSession(response)
        setUser(response.user)
      },
      async logout() {
        const session = getStoredSession()

        if (session?.refreshToken) {
          try {
            await logoutCurrentDevice(session.refreshToken)
          } finally {
            clearStoredSession()
            setUser(null)
          }

          return
        }

        clearStoredSession()
        setUser(null)
      },
      async logoutEverywhere() {
        const session = getStoredSession()

        if (session?.accessToken) {
          try {
            await logoutAllDevices(session.accessToken)
          } finally {
            clearStoredSession()
            setUser(null)
          }

          return
        }

        clearStoredSession()
        setUser(null)
      },
      async refreshMe() {
        const session = getStoredSession()

        if (!session?.accessToken) {
          setUser(null)
          return
        }

        const me = await fetchMe(session.accessToken)
        setUser(me)
        saveStoredSession({ ...session, user: me })
      },
      async updateMyProfile(payload) {
        const session = getStoredSession()

        if (!session?.accessToken) {
          throw new Error('로그인 후에 프로필을 수정할 수 있어요.')
        }

        const updatedUser = await updateProfile(payload)
        setUser(updatedUser)
        saveStoredSession({ ...session, user: updatedUser })
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
