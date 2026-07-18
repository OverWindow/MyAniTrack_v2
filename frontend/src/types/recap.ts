import type { AuthUser } from './auth'
import type { UserAnimeListItem } from './collection'
import type {
  AnimeStatsItem,
  FormatDistributionStats,
  GenreBubbleResponse,
  ViewingDnaItem,
} from './stats'

export type RecapTheme = 'peach' | 'lilac' | 'mint'
export type RecapPlaybackMode = 'story' | 'auto'
export type RecapFavoriteSelection = number[]
export type RecapSceneKey = 'cover' | 'totals' | 'favorites' | 'dna' | 'genre' | 'series' | 'closing'

export type RecapScene = {
  key: RecapSceneKey
  label: string
}

export type RecapData = {
  user: AuthUser
  stats: AnimeStatsItem
  favorites: UserAnimeListItem[]
  viewingDna: ViewingDnaItem | null
  genreBubble: GenreBubbleResponse['item'] | null
  formatDistribution: FormatDistributionStats | null
}

export type RecapAssetMap = Record<string, string | null>
