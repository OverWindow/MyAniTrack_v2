import { useEffect, useState, type FormEvent } from 'react'
import { fetchAdminUserDetail, fetchAdminUsers } from '../lib/admin'
import { getProfileImageSrc, handleProfileImageError } from '../lib/avatar'
import type {
  AdminUserDetail,
  AdminUserListResponse,
  AdminUserRoleFilter,
} from '../types/admin'

type UserQuery = {
  page: number
  limit: number
  search: string
  role: AdminUserRoleFilter
}

const INITIAL_QUERY: UserQuery = {
  page: 1,
  limit: 20,
  search: '',
  role: 'ALL',
}

function formatDate(value?: string | null) {
  if (!value) {
    return '-'
  }

  const date = new Date(value.replace(' ', 'T'))

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatWatchTime(totalMinutes: number) {
  if (totalMinutes <= 0) {
    return '0시간'
  }

  return `${Math.round(totalMinutes / 60).toLocaleString('ko-KR')}시간`
}

export function AdminUserManager() {
  const [draftSearch, setDraftSearch] = useState('')
  const [query, setQuery] = useState<UserQuery>(INITIAL_QUERY)
  const [listState, setListState] = useState<{
    data: AdminUserListResponse | null
    isLoading: boolean
    error: string | null
  }>({ data: null, isLoading: true, error: null })
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [detailState, setDetailState] = useState<{
    item: AdminUserDetail | null
    isLoading: boolean
    error: string | null
  }>({ item: null, isLoading: false, error: null })

  useEffect(() => {
    const controller = new AbortController()

    const loadUsers = async () => {
      setListState((current) => ({ ...current, isLoading: true, error: null }))

      try {
        const data = await fetchAdminUsers({ ...query, signal: controller.signal })

        if (!controller.signal.aborted) {
          setListState({ data, isLoading: false, error: null })
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }

        setListState((current) => ({
          ...current,
          isLoading: false,
          error: error instanceof Error ? error.message : '사용자 목록을 불러오지 못했어요.',
        }))
      }
    }

    void loadUsers()
    return () => controller.abort()
  }, [query])

  useEffect(() => {
    if (!selectedUserId) {
      return
    }

    const controller = new AbortController()

    const loadDetail = async () => {
      setDetailState({ item: null, isLoading: true, error: null })

      try {
        const item = await fetchAdminUserDetail(selectedUserId, controller.signal)

        if (!controller.signal.aborted) {
          setDetailState({ item, isLoading: false, error: null })
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }

        setDetailState({
          item: null,
          isLoading: false,
          error: error instanceof Error ? error.message : '사용자 상세 정보를 불러오지 못했어요.',
        })
      }
    }

    void loadDetail()
    return () => controller.abort()
  }, [selectedUserId])

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSelectedUserId(null)
    setDetailState({ item: null, isLoading: false, error: null })
    setQuery((current) => ({ ...current, page: 1, search: draftSearch.trim() }))
  }

  const handleReset = () => {
    setDraftSearch('')
    setSelectedUserId(null)
    setDetailState({ item: null, isLoading: false, error: null })
    setQuery(INITIAL_QUERY)
  }

  const pageInfo = listState.data?.pageInfo
  const detail = detailState.item

  return (
    <section className="admin-user-manager">
      <form className="admin-user-search" onSubmit={handleSearch}>
        <label className="auth-field admin-user-search-field">
          <span>이메일 또는 사용자명</span>
          <input
            type="search"
            value={draftSearch}
            maxLength={100}
            placeholder="검색어를 입력하세요"
            onChange={(event) => setDraftSearch(event.target.value)}
          />
        </label>

        <label className="auth-field admin-user-role-field">
          <span>권한</span>
          <select
            value={query.role}
            onChange={(event) => {
              setSelectedUserId(null)
              setQuery((current) => ({
                ...current,
                page: 1,
                role: event.target.value as AdminUserRoleFilter,
              }))
            }}
          >
            <option value="ALL">전체 권한</option>
            <option value="USER">일반 사용자</option>
            <option value="ADMIN">관리자</option>
          </select>
        </label>

        <div className="admin-user-search-actions">
          <button className="primary-button" type="submit" disabled={listState.isLoading}>검색</button>
          <button className="secondary-button" type="button" onClick={handleReset} disabled={listState.isLoading}>초기화</button>
        </div>
      </form>

      <div className="admin-user-layout">
        <div className="admin-user-list-panel">
          <div className="admin-user-list-heading">
            <div>
              <h3>사용자 목록</h3>
              <p>{pageInfo ? `총 ${pageInfo.totalItems.toLocaleString('ko-KR')}명` : '사용자를 조회하고 있어요.'}</p>
            </div>
            {query.search && <span className="admin-user-filter-chip">“{query.search}”</span>}
          </div>

          {listState.isLoading && <div className="feedback-card">사용자 목록을 불러오는 중이에요.</div>}
          {listState.error && !listState.isLoading && <div className="feedback-card is-error">{listState.error}</div>}
          {!listState.isLoading && !listState.error && listState.data?.items.length === 0 && (
            <div className="feedback-card">조건에 맞는 사용자가 없어요.</div>
          )}

          {!listState.isLoading && !listState.error && listState.data && listState.data.items.length > 0 && (
            <div className="admin-user-list">
              {listState.data.items.map((item) => (
                <button
                  className={`admin-user-row${selectedUserId === item.id ? ' is-active' : ''}`}
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedUserId(item.id)}
                >
                  <span className="admin-user-identity">
                    <img
                      src={getProfileImageSrc(item.profileImageUrl)}
                      alt=""
                      loading="lazy"
                      onError={handleProfileImageError}
                    />
                    <span>
                      <strong>{item.username}</strong>
                      <small>{item.email}</small>
                    </span>
                  </span>
                  <span className={`admin-user-role is-${item.role.toLowerCase()}`}>{item.role}</span>
                  <span className="admin-user-metric">
                    <strong>{item.animeListCount.toLocaleString('ko-KR')}</strong>
                    <small>작품</small>
                  </span>
                  <span className="admin-user-metric">
                    <strong>{item.completedCount.toLocaleString('ko-KR')}</strong>
                    <small>완주</small>
                  </span>
                  <span className="admin-user-metric">
                    <strong>{item.activeSessionCount.toLocaleString('ko-KR')}</strong>
                    <small>세션</small>
                  </span>
                </button>
              ))}
            </div>
          )}

          {pageInfo && pageInfo.totalPages > 0 && (
            <div className="admin-user-pagination">
              <button
                className="secondary-button"
                type="button"
                disabled={!pageInfo.hasPrevious || listState.isLoading}
                onClick={() => {
                  setSelectedUserId(null)
                  setQuery((current) => ({ ...current, page: Math.max(1, current.page - 1) }))
                }}
              >
                이전
              </button>
              <span>{pageInfo.page} / {pageInfo.totalPages}</span>
              <button
                className="secondary-button"
                type="button"
                disabled={!pageInfo.hasNext || listState.isLoading}
                onClick={() => {
                  setSelectedUserId(null)
                  setQuery((current) => ({ ...current, page: current.page + 1 }))
                }}
              >
                다음
              </button>
            </div>
          )}
        </div>

        <aside className="admin-user-detail-panel">
          {!selectedUserId && <div className="admin-user-detail-empty">사용자를 선택하면 상세 정보가 표시됩니다.</div>}
          {detailState.isLoading && <div className="admin-user-detail-empty">상세 정보를 불러오는 중이에요.</div>}
          {detailState.error && !detailState.isLoading && <div className="feedback-card is-error">{detailState.error}</div>}

          {detail && selectedUserId && !detailState.isLoading && (
            <>
              <div className="admin-user-detail-profile">
                <img
                  src={getProfileImageSrc(detail.profileImageUrl)}
                  alt=""
                  onError={handleProfileImageError}
                />
                <div>
                  <span className={`admin-user-role is-${detail.role.toLowerCase()}`}>{detail.role}</span>
                  <h3>{detail.username}</h3>
                  <p>{detail.email}</p>
                </div>
              </div>

              {detail.bio && <p className="admin-user-bio">{detail.bio}</p>}

              <dl className="admin-user-account-grid">
                <div><dt>사용자 ID</dt><dd>#{detail.id}</dd></div>
                <div><dt>이메일 인증</dt><dd>{detail.emailVerified ? '인증됨' : '미인증'}</dd></div>
                <div><dt>인증 시각</dt><dd>{formatDate(detail.emailVerifiedAt)}</dd></div>
                <div><dt>로그인 방식</dt><dd>{detail.supabaseLinked ? 'Supabase 연동' : '일반 계정'}</dd></div>
                <div><dt>활성 세션</dt><dd>{detail.activeSessionCount.toLocaleString('ko-KR')}개</dd></div>
                <div><dt>가입일</dt><dd>{formatDate(detail.createdAt)}</dd></div>
                <div><dt>최근 수정</dt><dd>{formatDate(detail.updatedAt)}</dd></div>
              </dl>

              <div className="admin-user-detail-section">
                <h4>컬렉션 현황</h4>
                <div className="admin-user-status-grid">
                  <div><span>전체</span><strong>{detail.collection.totalCount.toLocaleString('ko-KR')}</strong></div>
                  <div><span>볼 예정</span><strong>{detail.collection.plannedCount.toLocaleString('ko-KR')}</strong></div>
                  <div><span>보는 중</span><strong>{detail.collection.watchingCount.toLocaleString('ko-KR')}</strong></div>
                  <div><span>완주</span><strong>{detail.collection.completedCount.toLocaleString('ko-KR')}</strong></div>
                  <div><span>멈춤</span><strong>{detail.collection.pausedCount.toLocaleString('ko-KR')}</strong></div>
                  <div><span>중단</span><strong>{detail.collection.droppedCount.toLocaleString('ko-KR')}</strong></div>
                </div>
              </div>

              <div className="admin-user-detail-section">
                <h4>감상 통계</h4>
                <dl className="admin-user-stats-list">
                  <div><dt>시청 시간</dt><dd>{formatWatchTime(detail.collection.totalWatchMinutes)}</dd></div>
                  <div><dt>시청 에피소드</dt><dd>{detail.collection.totalWatchedEpisodes.toLocaleString('ko-KR')}화</dd></div>
                  <div><dt>평균 점수</dt><dd>{detail.collection.averageScore?.toFixed(2) ?? '-'}점</dd></div>
                  <div><dt>선호 장르</dt><dd>{detail.collection.favoriteGenre ?? '-'}</dd></div>
                  <div><dt>선호 방영 시기</dt><dd>{detail.collection.favoriteReleasePeriod ?? '-'}</dd></div>
                  <div><dt>통계 갱신</dt><dd>{formatDate(detail.collection.statsUpdatedAt)}</dd></div>
                </dl>
              </div>
            </>
          )}
        </aside>
      </div>
    </section>
  )
}
