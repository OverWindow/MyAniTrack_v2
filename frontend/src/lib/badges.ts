import { authFetch } from './auth'
import type { MyBadgesResponse, PublicUserBadgesResponse, UserBadge } from '../types/badges'

function getApiBaseUrl() {
  const baseUrl = import.meta.env.VITE_API_BASE_URL

  if (!baseUrl) {
    throw new Error('VITE_API_BASE_URL이 설정되지 않았습니다.')
  }

  return baseUrl
}

function getErrorMessage(status: number, fallback: string) {
  if (status === 401) {
    return '로그인이 필요하거나 세션이 만료되었어요.'
  }

  if (status === 404) {
    return '배지 정보를 찾을 수 없어요.'
  }

  if (status >= 500) {
    return '서버 오류가 발생했어요. 잠시 후 다시 시도해주세요.'
  }

  return fallback
}

function toFiniteNumber(value: unknown, fallback = 0) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  return fallback
}

function normalizeBadge(value: unknown): UserBadge | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const source = value as Record<string, unknown>
  const id = toFiniteNumber(source.id)
  const code = typeof source.code === 'string' ? source.code : ''
  const name = typeof source.name === 'string' ? source.name : ''

  if (!id || !code || !name) {
    return null
  }

  const progress =
    source.progress && typeof source.progress === 'object'
      ? source.progress as Record<string, unknown>
      : null

  return {
    id,
    code,
    name,
    description: typeof source.description === 'string' ? source.description : '',
    imageUrl: typeof source.imageUrl === 'string' || source.imageUrl === null ? source.imageUrl : null,
    category: typeof source.category === 'string' ? source.category : '',
    conditionType: typeof source.conditionType === 'string' ? source.conditionType : '',
    conditionValue: typeof source.conditionValue === 'string' ? source.conditionValue : String(source.conditionValue ?? ''),
    rarity: typeof source.rarity === 'string' ? source.rarity : 'COMMON',
    hidden: Boolean(source.hidden),
    earned: Boolean(source.earned),
    earnedAt: typeof source.earnedAt === 'string' || source.earnedAt === null ? source.earnedAt : null,
    progress: progress
      ? {
          current: toFiniteNumber(progress.current),
          target: toFiniteNumber(progress.target),
          percent: Math.max(0, Math.min(100, toFiniteNumber(progress.percent))),
          isComplete: Boolean(progress.isComplete),
        }
      : null,
  } satisfies UserBadge
}

function normalizeBadges(items: unknown): UserBadge[] {
  if (!Array.isArray(items)) {
    return []
  }

  return items.map(normalizeBadge).filter((badge): badge is UserBadge => Boolean(badge))
}

export async function fetchMyBadges(signal?: AbortSignal) {
  const response = await authFetch(new URL('/api/me/badges', getApiBaseUrl()).toString(), { signal })

  if (!response.ok) {
    throw new Error(getErrorMessage(response.status, '내 배지를 불러오지 못했어요.'))
  }

  const data = (await response.json()) as MyBadgesResponse
  const items = normalizeBadges(data.items)
  const newlyEarned = normalizeBadges(data.newlyEarned)

  return {
    items,
    newlyEarned,
    earnedCount: toFiniteNumber(data.earnedCount, items.filter((badge) => badge.earned).length),
    totalCount: toFiniteNumber(data.totalCount, items.length),
  }
}

export async function fetchPublicUserBadges(userId: string, signal?: AbortSignal) {
  const response = await authFetch(new URL(`/api/users/${userId}/badges`, getApiBaseUrl()).toString(), { signal })

  if (!response.ok) {
    throw new Error(getErrorMessage(response.status, '사용자 배지를 불러오지 못했어요.'))
  }

  const data = (await response.json()) as PublicUserBadgesResponse
  const items = normalizeBadges(data.items)

  return {
    items,
    earnedCount: toFiniteNumber(data.earnedCount, items.length),
    totalCount: toFiniteNumber(data.totalCount, items.length),
  }
}
