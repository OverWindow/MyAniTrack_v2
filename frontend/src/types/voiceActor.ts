export type VoiceActorTitleLanguage = 'ko' | 'en' | 'ja'

export type VoiceActorPersonName = {
  full?: string | null
  native?: string | null
  userPreferred?: string | null
}

export type VoiceActorImage = {
  large?: string | null
  medium?: string | null
}

export type VoiceActorDetail = {
  id: number
  anilistId: number
  name: VoiceActorPersonName
  image: VoiceActorImage
  languageV2?: string | null
  description?: string | null
  siteUrl?: string | null
}

export type VoiceActorDetailSummary = {
  animeCount: number
  characterCount: number
  creditCount: number
}

export type VoiceActorDetailCharacter = {
  id: number
  role?: string | null
  name: VoiceActorPersonName
  image: VoiceActorImage
  description?: string | null
}

export type VoiceActorDetailAnime = {
  id: number
  title: string
  coverImageLarge?: string | null
  coverImageExtraLarge?: string | null
  seasonYear?: number | null
  format?: string | null
  averageScore?: number | null
}

export type VoiceActorDetailItem = {
  character: VoiceActorDetailCharacter
  anime: VoiceActorDetailAnime
  voiceActing: {
    languageV2?: string | null
    sortOrder?: number | null
  }
}

export type VoiceActorDetailPayload = {
  voiceActor: VoiceActorDetail
  summary: VoiceActorDetailSummary
  items: VoiceActorDetailItem[]
  pageInfo: {
    limit: number
    titleLanguage: VoiceActorTitleLanguage
    hasNext: boolean
    nextCursor: string | null
  }
}

export type VoiceActorDetailResponse = {
  success: boolean
  item: VoiceActorDetailPayload
}
