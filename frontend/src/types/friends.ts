export type FriendUser = {
  id: number
  username: string
  profileImageUrl?: string | null
  bio?: string | null
  animeListCount: number
}

export type FriendRequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled'

export type FriendRequestAction = 'accept' | 'reject' | 'cancel'

export type FriendRequestPayload =
  | {
      receiverId: number
      username?: never
    }
  | {
      username: string
      receiverId?: never
    }

export type FriendRequestItem = {
  id: number
  requesterId: number
  receiverId: number
  status: FriendRequestStatus
  createdAt?: string
  respondedAt?: string | null
  user: FriendUser
}

export type OutgoingFriendRequestResult = {
  id: number
  status: FriendRequestStatus
  receiver: FriendUser
}

export type FriendItem = {
  id: number
  createdAt: string
  user: FriendUser
}

export type FriendRequestsResponse = {
  success: boolean
  incoming: FriendRequestItem[]
  outgoing: FriendRequestItem[]
}

export type FriendsResponse = {
  success: boolean
  items: FriendItem[]
}

export type SendFriendRequestResponse = {
  success: boolean
  message: string
  item: OutgoingFriendRequestResult
}

export type UpdateFriendRequestResponse = {
  success: boolean
  message: string
  item: FriendRequestItem
}
