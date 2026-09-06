import { tr } from '../i18n'
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
import { useAuth } from './AuthContext'
import {
  fetchFriendRequests,
  fetchFriends,
  getCachedFriendsSession,
  removeFriend,
  saveFriendsSessionCache,
  sendFriendRequest,
  sortFriendsByNewest,
  updateFriendRequest,
} from '../lib/friends'
import { getFriendlyErrorMessage } from '../lib/errors'
import type { FriendItem, FriendRequestAction, FriendRequestItem } from '../types/friends'

const FRIENDS_PENDING_REFRESH_INTERVAL_MS = 15_000

type FriendsState = {
  incoming: FriendRequestItem[]
  outgoing: FriendRequestItem[]
  friends: FriendItem[]
  isLoading: boolean
  error: string | null
}

type RefreshFriendsOptions = {
  signal?: AbortSignal
  silent?: boolean
}

type FriendsContextValue = FriendsState & {
  refreshFriends: (options?: RefreshFriendsOptions) => Promise<void>
  sendRequest: (username: string) => Promise<string>
  respondToRequest: (requestId: number, action: FriendRequestAction) => Promise<string>
  deleteFriend: (friendUserId: number) => Promise<void>
}

const FriendsContext = createContext<FriendsContextValue | null>(null)

const emptyFriendsState = {
  incoming: [],
  outgoing: [],
  friends: [],
  isLoading: false,
  error: null,
} satisfies FriendsState

function getInitialFriendsState() {
  const cachedData = getCachedFriendsSession()

  if (cachedData) {
    return {
      incoming: cachedData.incoming,
      outgoing: cachedData.outgoing,
      friends: sortFriendsByNewest(cachedData.friends),
      isLoading: false,
      error: null,
    } satisfies FriendsState
  }

  return {
    ...emptyFriendsState,
    isLoading: true,
  } satisfies FriendsState
}

function persistFriendsState(nextState: Pick<FriendsState, 'incoming' | 'outgoing' | 'friends'>) {
  saveFriendsSessionCache({
    incoming: nextState.incoming,
    outgoing: nextState.outgoing,
    friends: nextState.friends,
  })
}

export function FriendsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const [state, setState] = useState<FriendsState>(() => getInitialFriendsState())

  const refreshFriends = useCallback(
    async (options: RefreshFriendsOptions = {}) => {
      if (!isAuthenticated) {
        setState(emptyFriendsState)
        return
      }

      if (!options.silent) {
        setState((current) => ({
          ...current,
          isLoading: true,
          error: null,
        }))
      }

      try {
        const [requests, friends] = await Promise.all([
          fetchFriendRequests(options.signal),
          fetchFriends(options.signal),
        ])
        const nextData = {
          incoming: requests.incoming,
          outgoing: requests.outgoing,
          friends: sortFriendsByNewest(friends),
        }

        persistFriendsState(nextData)
        setState({
          ...nextData,
          isLoading: false,
          error: null,
        })
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }

        setState((current) => ({
          ...current,
          isLoading: false,
          error: getFriendlyErrorMessage(error, tr("친구 정보를 불러오지 못했어요.")),
        }))
      }
    },
    [isAuthenticated],
  )

  useEffect(() => {
    if (!isAuthenticated) {
      setState(emptyFriendsState)
      return
    }

    const cachedData = getCachedFriendsSession()

    const controller = new AbortController()

    if (cachedData) {
      setState({
        incoming: cachedData.incoming,
        outgoing: cachedData.outgoing,
        friends: sortFriendsByNewest(cachedData.friends),
        isLoading: false,
        error: null,
      })
    }

    void refreshFriends({ signal: controller.signal, silent: Boolean(cachedData) })

    return () => controller.abort()
  }, [isAuthenticated, refreshFriends])

  useEffect(() => {
    if (!isAuthenticated || state.outgoing.length === 0) {
      return
    }

    const refreshPendingRequests = () => {
      void refreshFriends({ silent: true })
    }

    const intervalId = window.setInterval(refreshPendingRequests, FRIENDS_PENDING_REFRESH_INTERVAL_MS)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshPendingRequests()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isAuthenticated, refreshFriends, state.outgoing.length])

  const value = useMemo<FriendsContextValue>(
    () => ({
      ...state,
      refreshFriends,
      async sendRequest(username) {
        const result = await sendFriendRequest({ username })
        await refreshFriends({ silent: true })
        return result.message || tr("친구 요청을 보냈어요.")
      },
      async respondToRequest(requestId, action) {
        await updateFriendRequest(requestId, action)
        await refreshFriends({ silent: true })

        if (action === 'accept') {
          return tr("친구 요청을 수락했어요.")
        }

        if (action === 'reject') {
          return tr("친구 요청을 거절했어요.")
        }

        return tr("보낸 친구 요청을 취소했어요.")
      },
      async deleteFriend(friendUserId) {
        const previousState = state
        const nextData = {
          incoming: state.incoming,
          outgoing: state.outgoing,
          friends: state.friends.filter((friend) => friend.user.id !== friendUserId),
        }

        persistFriendsState(nextData)
        setState({
          ...nextData,
          isLoading: false,
          error: null,
        })

        try {
          await removeFriend(friendUserId)
        } catch (error) {
          persistFriendsState(previousState)
          setState(previousState)
          throw error
        }
      },
    }),
    [refreshFriends, state],
  )

  return <FriendsContext.Provider value={value}>{children}</FriendsContext.Provider>
}

export function useFriends() {
  const context = useContext(FriendsContext)

  if (!context) {
    throw new Error(tr("useFriends는 FriendsProvider 안에서 사용해야 합니다."))
  }

  return context
}
