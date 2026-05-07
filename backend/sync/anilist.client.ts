import { ANILIST_ANIME_PAGE_QUERY, ANILIST_SEASON_ANIME_PAGE_QUERY } from './anilist.queries';

const ANILIST_URL = 'https://graphql.anilist.co';

export interface AniListTag {
  name?: string | null;
  rank?: number | null;
  isMediaSpoiler?: boolean | null;
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
