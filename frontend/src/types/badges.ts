export type BadgeProgress = {
  current: number
  target: number
  percent: number
  isComplete: boolean
}

export type UserBadge = {
  id: number
  code: string
  name: string
  description: string
  imageUrl?: string | null
  category: string
  conditionType: string
  conditionValue: string
  rarity: string
  hidden: boolean
  earned: boolean
  earnedAt?: string | null
  progress?: BadgeProgress | null
}

export type MyBadgesResponse = {
  success: boolean
  items: UserBadge[]
  newlyEarned?: UserBadge[]
  earnedCount: number
  totalCount: number
}

export type PublicUserBadgesResponse = {
  success: boolean
  items: UserBadge[]
  earnedCount?: number
  totalCount?: number
}
