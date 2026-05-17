import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  fetchFriendRequests,
  fetchFriends,
  formatFriendAnimeCount,
  getCachedFriendsSession,
  getFriendPreviewName,
  removeFriend,
  saveFriendsSessionCache,
  sendFriendRequest,
  sortFriendsByNewest,
  updateFriendRequest,
} from '../lib/friends'
import { getProfileImageSrc, handleProfileImageError } from '../lib/avatar'
import type { FriendItem, FriendRequestAction, FriendRequestItem } from '../types/friends'
import '../styles/pages/FriendsPage.css'

type FriendsState = {
  incoming: FriendRequestItem[]
  outgoing: FriendRequestItem[]
  friends: FriendItem[]
  isLoading: boolean
  error: string | null
}

function FriendAvatar({ user }: { user: FriendRequestItem['user'] | FriendItem['user'] }) {
  const displayName = getFriendPreviewName(user)

  if (user.profileImageUrl) {
    return (
      <img
        className="friends-avatar friends-avatar-image"
        src={getProfileImageSrc(user.profileImageUrl)}
        alt={displayName}
        onError={handleProfileImageError}
      />
    )
  }

  return (
    <img
      className="friends-avatar friends-avatar-image"
      src={getProfileImageSrc(null)}
      alt={displayName}
      onError={handleProfileImageError}
    />
  )
}

export function FriendsPage() {
  const { isAuthenticated } = useAuth()
  const [state, setState] = useState<FriendsState>(() => {
    const cachedData = getCachedFriendsSession()

    if (cachedData) {
      return {
        incoming: cachedData.incoming,
        outgoing: cachedData.outgoing,
        friends: sortFriendsByNewest(cachedData.friends),
        isLoading: false,
        error: null,
      }
    }

    return {
      incoming: [],
      outgoing: [],
      friends: [],
      isLoading: true,
      error: null,
    }
  })
  const [username, setUsername] = useState('')
  const [isSendingRequest, setIsSendingRequest] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [activeRequestId, setActiveRequestId] = useState<number | null>(null)
  const [activeFriendId, setActiveFriendId] = useState<number | null>(null)
  const [isIncomingOpen, setIsIncomingOpen] = useState(false)
  const [isOutgoingOpen, setIsOutgoingOpen] = useState(false)

  const loadFriendsDataFromApi = useCallback(async (signal?: AbortSignal) => {
    const [requests, friends] = await Promise.all([
      fetchFriendRequests(signal),
      fetchFriends(signal),
    ])
    const nextData = {
      incoming: requests.incoming,
      outgoing: requests.outgoing,
      friends: sortFriendsByNewest(friends),
    }

    saveFriendsSessionCache(nextData)
    setState({
      ...nextData,
      isLoading: false,
      error: null,
    })
  }, [])

  useEffect(() => {
    if (!isAuthenticated) {
      return
    }

    const controller = new AbortController()
    const cachedData = getCachedFriendsSession()

    if (cachedData) {
      return () => controller.abort()
    }

    const loadFriendsData = async () => {
      try {
        await loadFriendsDataFromApi(controller.signal)
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') {
          return
        }

        setState({
          incoming: [],
          outgoing: [],
          friends: [],
          isLoading: false,
          error:
            loadError instanceof Error
              ? loadError.message
              : '친구 정보를 불러오지 못했어요.',
        })
      }
    }

    void loadFriendsData()

    return () => controller.abort()
  }, [isAuthenticated, loadFriendsDataFromApi])

  const totalPendingCount = state.incoming.length + state.outgoing.length
  const summaryCards = useMemo(
    () => [
      { label: '친구 수', value: state.friends.length },
      { label: '받은 요청', value: state.incoming.length },
      { label: '보낸 요청', value: state.outgoing.length },
      { label: '대기 요청', value: totalPendingCount },
    ],
    [state.friends.length, state.incoming.length, state.outgoing.length, totalPendingCount],
  )

  const handleSendRequest = async () => {
    const normalizedUsername = username.trim()

    if (!normalizedUsername) {
      setFeedback('보낼 username을 입력해주세요.')
      return
    }

    setIsSendingRequest(true)
    setFeedback(null)

    try {
      const result = await sendFriendRequest({ username: normalizedUsername })
      setUsername('')
      setFeedback(result.message || '친구 요청을 보냈어요.')
      await loadFriendsDataFromApi()
    } catch (requestError) {
      setFeedback(
        requestError instanceof Error
          ? requestError.message
          : '친구 요청을 보내지 못했어요.',
      )
    } finally {
      setIsSendingRequest(false)
    }
  }

  const handleRequestAction = async (requestId: number, action: FriendRequestAction) => {
    setActiveRequestId(requestId)
    setFeedback(null)

    try {
      await updateFriendRequest(requestId, action)

      if (action === 'accept') {
        setFeedback('친구 요청을 수락했어요.')
      } else if (action === 'reject') {
        setFeedback('친구 요청을 거절했어요.')
      } else {
        setFeedback('보낸 친구 요청을 취소했어요.')
      }
      await loadFriendsDataFromApi()
    } catch (actionError) {
      setFeedback(
        actionError instanceof Error
          ? actionError.message
          : '친구 요청을 처리하지 못했어요.',
      )
    } finally {
      setActiveRequestId(null)
    }
  }

  const handleRemoveFriend = async (friendUserId: number) => {
    setActiveFriendId(friendUserId)
    setFeedback(null)

    try {
      await removeFriend(friendUserId)
      setFeedback('친구를 목록에서 삭제했어요.')
      await loadFriendsDataFromApi()
    } catch (removeError) {
      setFeedback(
        removeError instanceof Error
          ? removeError.message
          : '친구를 삭제하지 못했어요.',
      )
    } finally {
      setActiveFriendId(null)
    }
  }

  if (!isAuthenticated) {
    return (
      <section className="friends-page">
        <div className="feedback-card">
          친구 탭은 로그인한 사용자만 볼 수 있어요. <Link to="/login">로그인</Link> 후 다시 확인해주세요.
        </div>
      </section>
    )
  }

  if (state.isLoading) {
    return (
      <section className="friends-page">
        <div className="friends-summary-grid">
          {Array.from({ length: 4 }).map((_, index) => (
            <article className="friends-summary-card skeleton-card" key={`friends-skeleton-${index}`}>
              <div className="skeleton-line short" />
              <div className="skeleton-line long" />
            </article>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className="friends-page">
      {feedback && <div className="feedback-card">{feedback}</div>}
      {state.error && <div className="feedback-card is-error">{state.error}</div>}

      <div className="friends-layout">
        <section className="friends-panel friends-list-panel friends-left-column">
          <div className="friends-panel-heading">
            <span className="detail-label">Friends list</span>
            <h2>현재 친구</h2>
          </div>

          <div className="friends-card-list">
            {state.friends.length === 0 ? (
              <div className="friends-empty-state">아직 친구가 없어요. 먼저 요청을 보내보세요.</div>
            ) : (
              state.friends.map((friend) => (
                <article className="friend-card" key={`friend-${friend.id}`}>
                  <Link className="friend-card-main friend-card-link" to={`/users/${friend.user.id}/profile`}>
                    <FriendAvatar user={friend.user} />
                    <div className="friend-card-copy">
                      <strong>{getFriendPreviewName(friend.user)}</strong>
                      <p>{friend.user.bio || '한 줄 소개가 아직 없어요.'}</p>
                      <span>{formatFriendAnimeCount(friend.user.animeListCount)}</span>
                    </div>
                  </Link>
                  <div className="friend-card-actions">
                    <Link className="secondary-button small-button" to={`/users/${friend.user.id}/anime-list`}>컬렉션</Link>
                    <Link className="secondary-button small-button" to={`/users/${friend.user.id}/anime-stats`}>분석</Link>
                    <button className="secondary-button small-button" type="button" onClick={() => { void handleRemoveFriend(friend.user.id) }} disabled={activeFriendId === friend.user.id}>
                      {activeFriendId === friend.user.id ? '삭제 중...' : '친구 삭제'}
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <div className="friends-right-column">
          <section className="friends-request-panel">
            <div className="friends-request-copy">
              <span className="detail-label">Add friend</span>
              <h2>친구 요청 보내기</h2>
            </div>
            <div className="friends-request-form">
              <label className="auth-field" htmlFor="friend-username">
                <span>username</span>
                <input
                  id="friend-username"
                  type="text"
                  placeholder="예: mika"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                />
              </label>
              <button className="primary-button friends-request-button" type="button" onClick={() => { void handleSendRequest() }} disabled={isSendingRequest}>
                {isSendingRequest ? '보내는 중...' : '요청 보내기'}
              </button>
            </div>
          </section>

          <div className="friends-summary-grid compact-summary-grid">
            {summaryCards.map((card) => {
              const isIncomingCard = card.label === '받은 요청'
              const isOutgoingCard = card.label === '보낸 요청'
              const isRequestCard = isIncomingCard || isOutgoingCard
              const isActive = (isIncomingCard && isIncomingOpen) || (isOutgoingCard && isOutgoingOpen)

              if (isRequestCard) {
                return (
                  <button
                    className={isActive ? 'friends-summary-card is-toggle is-active' : 'friends-summary-card is-toggle'}
                    key={card.label}
                    type="button"
                    aria-expanded={isActive}
                    onClick={() => {
                      if (isIncomingCard) {
                        setIsIncomingOpen((current) => !current)
                      } else {
                        setIsOutgoingOpen((current) => !current)
                      }
                    }}
                  >
                    <span>{card.label}</span>
                    <strong>{card.value.toLocaleString()}</strong>
                  </button>
                )
              }

              return (
                <article className="friends-summary-card" key={card.label}>
                  <span>{card.label}</span>
                  <strong>{card.value.toLocaleString()}</strong>
                </article>
              )
            })}
          </div>

          {isIncomingOpen && (
            <section className="friends-panel friends-panel-compact request-accordion is-open">
              <div className="friends-panel-heading">
                <span className="detail-label">Incoming</span>
                <h2>받은 요청</h2>
              </div>

              <div className="friends-card-list compact-list">
                {state.incoming.length === 0 ? (
                  <div className="friends-empty-state">아직 받은 친구 요청이 없어요.</div>
                ) : (
                  state.incoming.map((request) => (
                    <article className="friend-card friend-card-compact" key={`incoming-${request.id}`}>
                      <Link className="friend-card-main friend-card-link" to={`/users/${request.user.id}/profile`}>
                        <FriendAvatar user={request.user} />
                        <div className="friend-card-copy compact-copy">
                          <strong>{getFriendPreviewName(request.user)}</strong>
                          <span>{formatFriendAnimeCount(request.user.animeListCount)}</span>
                        </div>
                      </Link>
                      <div className="friend-card-actions compact-actions">
                        <button className="primary-button small-button" type="button" onClick={() => { void handleRequestAction(request.id, 'accept') }} disabled={activeRequestId === request.id}>수락</button>
                        <button className="secondary-button small-button" type="button" onClick={() => { void handleRequestAction(request.id, 'reject') }} disabled={activeRequestId === request.id}>거절</button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>
          )}

          {isOutgoingOpen && (
            <section className="friends-panel friends-panel-compact request-accordion is-open">
              <div className="friends-panel-heading">
                <span className="detail-label">Outgoing</span>
                <h2>보낸 요청</h2>
              </div>

              <div className="friends-card-list compact-list">
                {state.outgoing.length === 0 ? (
                  <div className="friends-empty-state">아직 보낸 친구 요청이 없어요.</div>
                ) : (
                  state.outgoing.map((request) => (
                    <article className="friend-card friend-card-compact" key={`outgoing-${request.id}`}>
                      <Link className="friend-card-main friend-card-link" to={`/users/${request.user.id}/profile`}>
                        <FriendAvatar user={request.user} />
                        <div className="friend-card-copy compact-copy">
                          <strong>{getFriendPreviewName(request.user)}</strong>
                          <span>{formatFriendAnimeCount(request.user.animeListCount)}</span>
                        </div>
                      </Link>
                      <div className="friend-card-actions compact-actions">
                        <button className="secondary-button small-button" type="button" onClick={() => { void handleRequestAction(request.id, 'cancel') }} disabled={activeRequestId === request.id}>취소</button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </section>
  )
}
