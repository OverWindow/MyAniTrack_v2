import { authFetch, getStoredSession } from './auth'
import type {
  FriendItem,
  FriendRequestAction,
  FriendRequestItem,
  FriendRequestPayload,
  FriendRequestsResponse,
  FriendsResponse,
  SendFriendRequestResponse,
  UpdateFriendRequestResponse,
} from '../types/friends'

const FRIENDS_SESSION_STORAGE_KEY_PREFIX = 'myanitrack.friends.session-cache'

export type FriendsSessionCache = {
  incoming: FriendRequestItem[]
  outgoing: FriendRequestItem[]
  friends: FriendItem[]
}

function getFriendsSessionStorageKey() {
  const session = getStoredSession()
  const userId = session?.user?.id

  return userId
    ? `${FRIENDS_SESSION_STORAGE_KEY_PREFIX}:${String(userId)}`
    : `${FRIENDS_SESSION_STORAGE_KEY_PREFIX}:guest`
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

function getErrorMessage(status: number, fallback: string) {
  if (status === 400) {
    return '요청 값이 올바르지 않아요. 자기 자신에게 요청을 보냈는지 확인해주세요.'
  }

  if (status === 401) {
    return '로그인이 필요하거나 세션이 만료되었어요.'
  }

  if (status === 404) {
    return '요청한 사용자나 친구 관계를 찾을 수 없어요.'
  }

  if (status === 409) {
    return '이미 친구이거나 요청을 보낸 상태예요.'
  }

  if (status >= 500) {
    return '서버 오류가 발생했어요. 잠시 후 다시 시도해주세요.'
  }

  return fallback
}

export function getCachedFriendsSession() {
  const raw = window.sessionStorage.getItem(getFriendsSessionStorageKey())

  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as FriendsSessionCache
  } catch {
    window.sessionStorage.removeItem(getFriendsSessionStorageKey())
    return null
  }
}

export function saveFriendsSessionCache(data: FriendsSessionCache) {
  window.sessionStorage.setItem(getFriendsSessionStorageKey(), JSON.stringify(data))
}

export async function sendFriendRequest(payload: FriendRequestPayload) {
  const response = await authFetch(createUrl('/api/friends/requests'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(getErrorMessage(response.status, '친구 요청을 보내지 못했어요.'))
  }

  const data = (await response.json()) as SendFriendRequestResponse

  return {
    message: data.message,
    item: {
      id: data.item.id,
      requesterId: 0,
      receiverId: data.item.receiver.id,
      status: data.item.status,
      user: data.item.receiver,
    } as FriendRequestItem,
  }
}

export async function fetchFriendRequests(signal?: AbortSignal) {
  const response = await authFetch(createUrl('/api/friends/requests'), { signal })

  if (!response.ok) {
    throw new Error(getErrorMessage(response.status, '친구 요청 목록을 불러오지 못했어요.'))
  }

  const data = (await response.json()) as FriendRequestsResponse

  return {
    incoming: data.incoming ?? [],
    outgoing: data.outgoing ?? [],
  }
}

export async function updateFriendRequest(requestId: number, action: FriendRequestAction) {
  const response = await authFetch(createUrl(`/api/friends/requests/${requestId}`), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action }),
  })

  if (!response.ok) {
    throw new Error(getErrorMessage(response.status, '친구 요청 상태를 변경하지 못했어요.'))
  }

  const data = (await response.json()) as UpdateFriendRequestResponse
  return data.item
}

export async function fetchFriends(signal?: AbortSignal) {
  const response = await authFetch(createUrl('/api/friends'), { signal })

  if (!response.ok) {
    throw new Error(getErrorMessage(response.status, '친구 목록을 불러오지 못했어요.'))
  }

  const data = (await response.json()) as FriendsResponse
  return data.items ?? []
}

export async function removeFriend(friendUserId: number) {
  const response = await authFetch(createUrl(`/api/friends/${friendUserId}`), {
    method: 'DELETE',
  })

  if (!response.ok) {
    throw new Error(getErrorMessage(response.status, '친구를 삭제하지 못했어요.'))
  }
}

export function getFriendPreviewName(user?: { username?: string | null; id?: number | null }) {
  if (user?.username?.trim()) {
    return user.username.trim()
  }

  return user?.id ? `User ${user.id}` : 'Anime friend'
}

export function getFriendInitials(user?: { username?: string | null; id?: number | null }) {
  const name = getFriendPreviewName(user)
  return name.slice(0, 2).toUpperCase()
}

export function formatFriendAnimeCount(count?: number | null) {
  return `${(count ?? 0).toLocaleString()}개 작품`
}

export function sortFriendsByNewest(items: FriendItem[]) {
  return [...items].sort((left, right) => {
    const leftTime = new Date(left.createdAt).getTime()
    const rightTime = new Date(right.createdAt).getTime()
    return rightTime - leftTime
  })
}
