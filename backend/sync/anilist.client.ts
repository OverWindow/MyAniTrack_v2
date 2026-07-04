import {
  ANILIST_ANIME_CAST_QUERY,
  ANILIST_ANIME_PAGE_QUERY,
  ANILIST_ANIME_STUDIOS_BY_IDS_QUERY,
  ANILIST_SEASON_ANIME_PAGE_QUERY,
} from './anilist.queries';

const ANILIST_URL = 'https://graphql.anilist.co';

export interface AniListTag {
  name?: string | null;
  rank?: number | null;
  isMediaSpoiler?: boolean | null;
}

export interface AniListStudio {
  id: number;
  name?: string | null;
  isAnimationStudio?: boolean | null;
  siteUrl?: string | null;
}

export interface AniListStudioEdge {
  isMain?: boolean | null;
  node?: AniListStudio | null;
}

export interface AniListAnime {
  id: number;
  title: {
    romaji?: string | null;
    english?: string | null;
    native?: string | null;
    userPreferred?: string | null;
  };
  description?: string | null;
  episodes?: number | null;
  duration?: number | null;
  season?: string | null;
  seasonYear?: number | null;
  format?: string | null;
  status?: string | null;
  source?: string | null;
  countryOfOrigin?: string | null;
  isAdult?: boolean | null;
  genres?: string[] | null;
  studios?: {
    edges?: AniListStudioEdge[] | null;
  } | null;
  averageScore?: number | null;
  meanScore?: number | null;
  popularity?: number | null;
  favourites?: number | null;
  coverImage?: {
    large?: string | null;
    extraLarge?: string | null;
  } | null;
  tags?: AniListTag[] | null;
  synonyms?: string[] | null;
  bannerImage?: string | null;
  siteUrl?: string | null;
  updatedAt?: number | null;
}

interface AniListPageResponse {
  data?: {
    Page?: {
      pageInfo?: {
        currentPage: number;
        hasNextPage: boolean;
        lastPage: number;
        perPage: number;
      };
      media?: AniListAnime[];
    };
  };
  errors?: Array<{ message: string }>;
}

export interface AniListCharacter {
  id: number;
  name?: {
    full?: string | null;
    native?: string | null;
    userPreferred?: string | null;
  } | null;
  image?: {
    large?: string | null;
    medium?: string | null;
  } | null;
  gender?: string | null;
  age?: string | null;
  description?: string | null;
  siteUrl?: string | null;
  updatedAt?: number | null;
}

export interface AniListVoiceActor {
  id: number;
  name?: {
    full?: string | null;
    native?: string | null;
    userPreferred?: string | null;
  } | null;
  languageV2?: string | null;
  image?: {
    large?: string | null;
    medium?: string | null;
  } | null;
  description?: string | null;
  siteUrl?: string | null;
  updatedAt?: number | null;
}

export interface AniListCharacterEdge {
  role?: string | null;
  name?: string | null;
  node?: AniListCharacter | null;
  voiceActors?: AniListVoiceActor[] | null;
}

interface AniListAnimeCastResponse {
  data?: {
    Media?: {
      id: number;
      updatedAt?: number | null;
      characters?: {
        pageInfo?: {
          currentPage: number;
          hasNextPage: boolean;
          lastPage: number;
          perPage: number;
        };
        edges?: AniListCharacterEdge[];
      } | null;
    } | null;
  };
  errors?: Array<{ message: string }>;
}

export async function fetchAnimePage(page: number, perPage: number): Promise<{
  media: AniListAnime[];
  hasNextPage: boolean;
  currentPage: number;
  lastPage: number;
}> {
  const response = await fetch(ANILIST_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      query: ANILIST_ANIME_PAGE_QUERY,
      variables: { page, perPage },
    }),
  });

  if (!response.ok) {
    throw new Error(`AniList request failed: ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as AniListPageResponse;

  if (json.errors?.length) {
    throw new Error(`AniList GraphQL error: ${json.errors.map(e => e.message).join(', ')}`);
  }

  const pageData = json.data?.Page;
  if (!pageData?.pageInfo) {
    throw new Error('Invalid AniList response: missing pageInfo');
  }

  return {
    media: pageData.media ?? [],
    hasNextPage: pageData.pageInfo.hasNextPage,
    currentPage: pageData.pageInfo.currentPage,
    lastPage: pageData.pageInfo.lastPage,
  };
}

export async function fetchSeasonAnimePage(
  season: 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL',
  seasonYear: number,
  page: number,
  perPage: number
): Promise<{
  media: AniListAnime[];
  hasNextPage: boolean;
  currentPage: number;
  lastPage: number;
}> {
  const response = await fetch(ANILIST_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      query: ANILIST_SEASON_ANIME_PAGE_QUERY,
      variables: { page, perPage, season, seasonYear },
    }),
  });

  if (!response.ok) {
    throw new Error(`AniList seasonal request failed: ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as AniListPageResponse;

  if (json.errors?.length) {
    throw new Error(`AniList GraphQL error: ${json.errors.map(e => e.message).join(', ')}`);
  }

  const pageData = json.data?.Page;
  if (!pageData?.pageInfo) {
    throw new Error('Invalid AniList seasonal response: missing pageInfo');
  }

  return {
    media: pageData.media ?? [],
    hasNextPage: pageData.pageInfo.hasNextPage,
    currentPage: pageData.pageInfo.currentPage,
    lastPage: pageData.pageInfo.lastPage,
  };
}

export async function fetchAnimeStudiosByAnilistIds(anilistIds: number[]): Promise<AniListAnime[]> {
  if (anilistIds.length === 0) {
    return [];
  }

  const response = await fetch(ANILIST_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      query: ANILIST_ANIME_STUDIOS_BY_IDS_QUERY,
      variables: { ids: anilistIds },
    }),
  });

  if (!response.ok) {
    throw new Error(`AniList studios request failed: ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as AniListPageResponse;

  if (json.errors?.length) {
    throw new Error(`AniList GraphQL error: ${json.errors.map(e => e.message).join(', ')}`);
  }

  return json.data?.Page?.media ?? [];
}

export async function fetchAnimeCastPage(
  anilistId: number,
  page: number,
  perPage: number,
  language: 'JAPANESE' | 'ENGLISH' | 'KOREAN' = 'JAPANESE'
): Promise<{
  anilistId: number;
  sourceUpdatedAt: number | null;
  edges: AniListCharacterEdge[];
  hasNextPage: boolean;
  currentPage: number;
  lastPage: number;
}> {
  const response = await fetch(ANILIST_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      query: ANILIST_ANIME_CAST_QUERY,
      variables: { anilistId, page, perPage, language },
    }),
  });

  if (!response.ok) {
    throw new Error(`AniList cast request failed: ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as AniListAnimeCastResponse;

  if (json.errors?.length) {
    throw new Error(`AniList GraphQL error: ${json.errors.map(e => e.message).join(', ')}`);
  }

  const media = json.data?.Media;
  const characters = media?.characters;

  if (!media || !characters?.pageInfo) {
    throw new Error('Invalid AniList cast response: missing media characters');
  }

  return {
    anilistId: media.id,
    sourceUpdatedAt: media.updatedAt ?? null,
    edges: characters.edges ?? [],
    hasNextPage: characters.pageInfo.hasNextPage,
    currentPage: characters.pageInfo.currentPage,
    lastPage: characters.pageInfo.lastPage,
  };
}
