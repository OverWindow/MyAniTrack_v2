export type AnimeSort = 'latest' | 'score' | 'season' | 'popularity'

export type AnimeGenre =
  | 'Action'
  | 'Adventure'
  | 'Drama'
  | 'Sci-Fi'
  | 'Mystery'
  | 'Comedy'
  | 'Supernatural'
  | 'Fantasy'
  | 'Sports'
  | 'Romance'
  | 'Slice of Life'
  | 'Horror'
  | 'Psychological'
  | 'Thriller'
  | 'Ecchi'
  | 'Mecha'
  | 'Music'
  | 'Mahou Shoujo'
  | 'Hentai'

export type AnimeListItem = {
  id: number
  anilistId: number
  title: string
  titles?: {
    korean?: string | null
    english?: string | null
    native?: string | null
    romaji?: string | null
    userPreferred?: string | null
  }
  episodes?: number | null
  duration?: number | null
  season?: string | null
  seasonYear?: number | null
  format?: string | null
  status?: string | null
  averageScore?: number | null
  meanScore?: number | null
  popularity?: number | null
  favourites?: number | null
  coverImageLarge: string
  coverImageExtraLarge?: string | null
  bannerImage?: string | null
  siteUrl?: string | null
  isAdult?: boolean
  createdAt?: string
  myCollection?: {
    exists: boolean
    status: string | null
    score: number | null
    progress: number | null
  }
}

export type PopularAnimeItem = {
  id: number
  anilistId: number
  title: string
  titles?: {
    korean?: string | null
    english?: string | null
    native?: string | null
    romaji?: string | null
    userPreferred?: string | null
  }
  coverImageLarge: string
  coverImageExtraLarge?: string | null
  popularity?: number | null
}

export type AnimeListResponse = {
  success: boolean
  items: AnimeListItem[]
  pageInfo: {
    hasNext: boolean
    nextCursor: string | null
    limit: number
    sort: AnimeSort
    titleLanguage: 'ko' | 'en' | 'ja'
  }
}

export type PopularAnimeResponse = {
  success: boolean
  items: PopularAnimeItem[]
}

export type KoreanTitleCandidate = {
  title: string
  subtitle: string | null
  fullTitle: string
  isPrimary: boolean
}

export type AnimeDetailItem = {
  id: number
  anilistId: number
  title: string
  titles: {
    korean?: KoreanTitleCandidate[]
    english?: string | null
    native?: string | null
    romaji?: string | null
    userPreferred?: string | null
  }
  description?: string | null
  episodes?: number | null
  duration?: number | null
  season?: string | null
  seasonYear?: number | null
  format?: string | null
  status?: string | null
  source?: string | null
  countryOfOrigin?: string | null
  isAdult?: boolean
  averageScore?: number | null
  meanScore?: number | null
  popularity?: number | null
  favourites?: number | null
  coverImageLarge: string
  coverImageExtraLarge?: string | null
  bannerImage?: string | null
  siteUrl?: string | null
  sourceUpdatedAt?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  genres?: string[]
  tags?: Array<{
    name: string
    rank: number
    isSpoiler: boolean
  }>
  synonyms?: string[]
}

export type AnimeDetailResponse = {
  success: boolean
  item: AnimeDetailItem
}
