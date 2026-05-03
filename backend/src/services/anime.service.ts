import { pool } from '../../config/db';
import { RowDataPacket } from 'mysql2/promise';

export type AnimeSortOption = 'latest' | 'score' | 'season';
export type AnimeTitleLanguage = 'ko' | 'en' | 'ja';

const SCORE_SORT_SQL = 'COALESCE(a.average_score, -1)';
const SEASON_YEAR_SORT_SQL = 'COALESCE(a.season_year, 0)';
const SEASON_RANK_SQL = `CASE a.season
  WHEN 'WINTER' THEN 1
  WHEN 'SPRING' THEN 2
  WHEN 'SUMMER' THEN 3
  WHEN 'FALL' THEN 4
  ELSE 0
END`;

interface AnimeListCursorPayload {
  sort: AnimeSortOption;
  query?: string | null;
  createdAt?: string;
  score?: number | null;
  seasonYear?: number | null;
  seasonRank?: number | null;
  id: number;
}

export interface AnimeListParams {
  sort: AnimeSortOption;
  titleLanguage: AnimeTitleLanguage;
  query?: string;
  cursor?: string;
  limit: number;
}

interface AnimeListRow extends RowDataPacket {
  id: number;
  anilistId: number;
  titleRomaji: string | null;
  titleEnglish: string | null;
  titleNative: string | null;
  titleUserPreferred: string | null;
  titleKorean: string | null;
  episodes: number | null;
  duration: number | null;
  season: string | null;
  seasonYear: number | null;
  format: string | null;
  status: string | null;
  averageScore: number | null;
  meanScore: number | null;
  popularity: number | null;
  favourites: number | null;
  coverImageLarge: string | null;
  coverImageExtraLarge: string | null;
  bannerImage: string | null;
  siteUrl: string | null;
  isAdult: number | boolean;
  createdAt: string;
  scoreSortValue: number | null;
  seasonRankValue: number | null;
}

interface AnimeDetailRow extends RowDataPacket {
  id: number;
  anilistId: number;
  titleRomaji: string | null;
  titleEnglish: string | null;
  titleNative: string | null;
  titleUserPreferred: string | null;
  description: string | null;
  episodes: number | null;
  duration: number | null;
  season: string | null;
  seasonYear: number | null;
  format: string | null;
  status: string | null;
  source: string | null;
  countryOfOrigin: string | null;
  isAdult: number | boolean;
  averageScore: number | null;
  meanScore: number | null;
  popularity: number | null;
  favourites: number | null;
  coverImageLarge: string | null;
  coverImageExtraLarge: string | null;
  bannerImage: string | null;
  siteUrl: string | null;
  sourceUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface KoreanTitleRow extends RowDataPacket {
  title: string;
  subtitle: string | null;
  fullTitle: string;
  isPrimary: number | boolean;
}

interface GenreRow extends RowDataPacket {
  genre: string;
}

interface TagRow extends RowDataPacket {
  tagName: string;
  rankValue: number | null;
  isSpoiler: number | boolean;
}

interface SynonymRow extends RowDataPacket {
  synonym: string;
}

function decodeCursor(cursor?: string): AnimeListCursorPayload | null {
  if (!cursor) {
    return null;
  }

  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    return JSON.parse(decoded) as AnimeListCursorPayload;
  } catch {
    throw new Error('Invalid cursor');
  }
}

function encodeCursor(payload: AnimeListCursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function normalizeBoolean(value: number | boolean): boolean {
  return Boolean(value);
}

function pickDisplayTitle(row: AnimeListRow | AnimeDetailRow, titleLanguage: AnimeTitleLanguage, koreanTitle?: string | null) {
  if (titleLanguage === 'ko') {
    return koreanTitle
      ?? row.titleEnglish
      ?? row.titleRomaji
      ?? row.titleUserPreferred
      ?? row.titleNative;
  }

  if (titleLanguage === 'en') {
    return row.titleEnglish
      ?? koreanTitle
      ?? row.titleRomaji
      ?? row.titleUserPreferred
      ?? row.titleNative;
  }

  return row.titleNative
    ?? row.titleRomaji
    ?? row.titleUserPreferred
    ?? row.titleEnglish
    ?? koreanTitle;
}

function buildListOrderClause(sort: AnimeSortOption): string {
  if (sort === 'score') {
    return `${SCORE_SORT_SQL} DESC, a.id DESC`;
  }

  if (sort === 'season') {
    return `${SEASON_YEAR_SORT_SQL} DESC, ${SEASON_RANK_SQL} DESC, a.id DESC`;
  }

  return 'a.created_at DESC, a.id DESC';
}

function buildCursorWhereClause(sort: AnimeSortOption, cursor: AnimeListCursorPayload | null, params: Array<string | number | null>) {
  if (!cursor) {
    return '';
  }

  if (cursor.sort !== sort) {
    throw new Error('Cursor sort does not match requested sort');
  }

  if (sort === 'score') {
    params.push(cursor.score ?? -1, cursor.score ?? -1, cursor.id);
    return `
      AND (
        ${SCORE_SORT_SQL} < ?
        OR (${SCORE_SORT_SQL} = ? AND a.id < ?)
      )
    `;
  }

  if (sort === 'season') {
    params.push(cursor.seasonYear ?? 0, cursor.seasonYear ?? 0, cursor.seasonRank ?? 0, cursor.seasonYear ?? 0, cursor.seasonRank ?? 0, cursor.id);
    return `
      AND (
        ${SEASON_YEAR_SORT_SQL} < ?
        OR (
          ${SEASON_YEAR_SORT_SQL} = ?
          AND ${SEASON_RANK_SQL} < ?
        )
        OR (
          ${SEASON_YEAR_SORT_SQL} = ?
          AND ${SEASON_RANK_SQL} = ?
          AND a.id < ?
        )
      )
    `;
  }

  if (!cursor.createdAt) {
    throw new Error('Invalid cursor');
  }

  params.push(cursor.createdAt, cursor.createdAt, cursor.id);
  return `
    AND (
      a.created_at < ?
      OR (a.created_at = ? AND a.id < ?)
    )
  `;
}

function normalizeSearchQuery(query?: string) {
  const normalizedQuery = query?.trim();
  return normalizedQuery ? normalizedQuery : undefined;
}

function buildSearchWhereClause(
  titleLanguage: AnimeTitleLanguage,
  query: string | undefined,
  cursor: AnimeListCursorPayload | null,
  params: Array<string | number | null>
) {
  const normalizedQuery = normalizeSearchQuery(query);

  if (cursor && (cursor.query ?? null) !== (normalizedQuery ?? null)) {
    throw new Error('Cursor query does not match requested query');
  }

  if (!normalizedQuery) {
    return '';
  }

  const searchKeyword = `%${normalizedQuery}%`;

  if (titleLanguage === 'ko') {
    params.push(searchKeyword, searchKeyword, searchKeyword);
    return `
      AND EXISTS (
        SELECT 1
        FROM anime_korean_titles akt_search
        WHERE akt_search.anime_id = a.id
          AND (
            akt_search.title LIKE ?
            OR akt_search.subtitle LIKE ?
            OR akt_search.full_title LIKE ?
          )
      )
    `;
  }

  if (titleLanguage === 'en') {
    params.push(searchKeyword, searchKeyword);
    return `
      AND (
        a.title_english LIKE ?
        OR a.title_user_preferred LIKE ?
      )
    `;
  }

  params.push(searchKeyword, searchKeyword);
  return `
    AND (
      a.title_native LIKE ?
      OR a.title_romaji LIKE ?
    )
  `;
}

export async function getAnimeList(params: AnimeListParams) {
  const decodedCursor = decodeCursor(params.cursor);
  const queryParams: Array<string | number | null> = [];
  const searchWhereClause = buildSearchWhereClause(params.titleLanguage, params.query, decodedCursor, queryParams);
  const cursorWhereClause = buildCursorWhereClause(params.sort, decodedCursor, queryParams);
  const orderByClause = buildListOrderClause(params.sort);

  queryParams.push(params.limit + 1);

  const [rows] = await pool.query<AnimeListRow[]>(
    `
    SELECT
      a.id,
      a.anilist_id AS anilistId,
      a.title_romaji AS titleRomaji,
      a.title_english AS titleEnglish,
      a.title_native AS titleNative,
      a.title_user_preferred AS titleUserPreferred,
      akt.full_title AS titleKorean,
      a.episodes,
      a.duration,
      a.season,
      a.season_year AS seasonYear,
      a.format,
      a.status,
      a.average_score AS averageScore,
      a.mean_score AS meanScore,
      a.popularity,
      a.favourites,
      a.cover_image_large AS coverImageLarge,
      a.cover_image_extra_large AS coverImageExtraLarge,
      a.banner_image AS bannerImage,
      a.site_url AS siteUrl,
      a.is_adult AS isAdult,
      a.created_at AS createdAt,
      ${SCORE_SORT_SQL} AS scoreSortValue,
      ${SEASON_RANK_SQL} AS seasonRankValue
    FROM anime a
    LEFT JOIN anime_korean_titles akt
      ON akt.anime_id = a.id
      AND akt.is_primary = TRUE
    WHERE 1 = 1
      AND a.is_adult = FALSE
      ${searchWhereClause}
      ${cursorWhereClause}
    ORDER BY ${orderByClause}
    LIMIT ?
    `,
    queryParams
  );

  const hasNext = rows.length > params.limit;
  const items = hasNext ? rows.slice(0, params.limit) : rows;
  const lastItem = items.length > 0 ? items[items.length - 1] : undefined;

  const nextCursor = lastItem
    ? encodeCursor({
        sort: params.sort,
        query: normalizeSearchQuery(params.query) ?? null,
        createdAt: lastItem.createdAt,
        score: lastItem.scoreSortValue,
        seasonYear: lastItem.seasonYear,
        seasonRank: lastItem.seasonRankValue,
        id: lastItem.id,
      })
    : null;

  return {
    items: items.map((row) => ({
      id: row.id,
      anilistId: row.anilistId,
      title: pickDisplayTitle(row, params.titleLanguage, row.titleKorean),
      titles: {
        korean: row.titleKorean,
        english: row.titleEnglish,
        native: row.titleNative,
        romaji: row.titleRomaji,
        userPreferred: row.titleUserPreferred,
      },
      episodes: row.episodes,
      duration: row.duration,
      season: row.season,
      seasonYear: row.seasonYear,
      format: row.format,
      status: row.status,
      averageScore: row.averageScore,
      meanScore: row.meanScore,
      popularity: row.popularity,
      favourites: row.favourites,
      coverImageLarge: row.coverImageLarge,
      coverImageExtraLarge: row.coverImageExtraLarge,
      bannerImage: row.bannerImage,
      siteUrl: row.siteUrl,
      isAdult: normalizeBoolean(row.isAdult),
      createdAt: row.createdAt,
    })),
    pageInfo: {
      hasNext,
      nextCursor: hasNext ? nextCursor : null,
      limit: params.limit,
      sort: params.sort,
      titleLanguage: params.titleLanguage,
    },
  };
}

export async function getAnimeDetailById(id: number, titleLanguage: AnimeTitleLanguage) {
  const [animeRows] = await pool.query<AnimeDetailRow[]>(
    `
    SELECT
      a.id,
      a.anilist_id AS anilistId,
      a.title_romaji AS titleRomaji,
      a.title_english AS titleEnglish,
      a.title_native AS titleNative,
      a.title_user_preferred AS titleUserPreferred,
      a.description,
      a.episodes,
      a.duration,
      a.season,
      a.season_year AS seasonYear,
      a.format,
      a.status,
      a.source,
      a.country_of_origin AS countryOfOrigin,
      a.is_adult AS isAdult,
      a.average_score AS averageScore,
      a.mean_score AS meanScore,
      a.popularity,
      a.favourites,
      a.cover_image_large AS coverImageLarge,
      a.cover_image_extra_large AS coverImageExtraLarge,
      a.banner_image AS bannerImage,
      a.site_url AS siteUrl,
      a.source_updated_at AS sourceUpdatedAt,
      a.created_at AS createdAt,
      a.updated_at AS updatedAt
    FROM anime a
    WHERE a.id = ?
    LIMIT 1
    `,
    [id]
  );

  const anime = animeRows[0];

  if (!anime) {
    return null;
  }

  const [koreanTitleRows, genreRows, tagRows, synonymRows] = await Promise.all([
    pool.query<KoreanTitleRow[]>(
      `
      SELECT
        title,
        subtitle,
        full_title AS fullTitle,
        is_primary AS isPrimary
      FROM anime_korean_titles
      WHERE anime_id = ?
      ORDER BY is_primary DESC, id ASC
      `,
      [id]
    ),
    pool.query<GenreRow[]>(
      `
      SELECT genre
      FROM anime_genres
      WHERE anime_id = ?
      ORDER BY genre ASC
      `,
      [id]
    ),
    pool.query<TagRow[]>(
      `
      SELECT
        tag_name AS tagName,
        rank_value AS rankValue,
        is_spoiler AS isSpoiler
      FROM anime_tags
      WHERE anime_id = ?
      ORDER BY rank_value DESC, tag_name ASC
      `,
      [id]
    ),
    pool.query<SynonymRow[]>(
      `
      SELECT synonym
      FROM anime_synonyms
      WHERE anime_id = ?
      ORDER BY synonym ASC
      `,
      [id]
    ),
  ]);

  const koreanTitles = koreanTitleRows[0];
  const primaryKoreanTitle = koreanTitles.find((row) => normalizeBoolean(row.isPrimary))?.fullTitle ?? null;

  return {
    id: anime.id,
    anilistId: anime.anilistId,
    title: pickDisplayTitle(anime, titleLanguage, primaryKoreanTitle),
    titles: {
      korean: koreanTitles.map((row) => ({
        title: row.title,
        subtitle: row.subtitle,
        fullTitle: row.fullTitle,
        isPrimary: normalizeBoolean(row.isPrimary),
      })),
      english: anime.titleEnglish,
      native: anime.titleNative,
      romaji: anime.titleRomaji,
      userPreferred: anime.titleUserPreferred,
    },
    description: anime.description,
    episodes: anime.episodes,
    duration: anime.duration,
    season: anime.season,
    seasonYear: anime.seasonYear,
    format: anime.format,
    status: anime.status,
    source: anime.source,
    countryOfOrigin: anime.countryOfOrigin,
    isAdult: normalizeBoolean(anime.isAdult),
    averageScore: anime.averageScore,
    meanScore: anime.meanScore,
    popularity: anime.popularity,
    favourites: anime.favourites,
    coverImageLarge: anime.coverImageLarge,
    coverImageExtraLarge: anime.coverImageExtraLarge,
    bannerImage: anime.bannerImage,
    siteUrl: anime.siteUrl,
    sourceUpdatedAt: anime.sourceUpdatedAt,
    createdAt: anime.createdAt,
    updatedAt: anime.updatedAt,
    genres: genreRows[0].map((row) => row.genre),
    tags: tagRows[0].map((row) => ({
      name: row.tagName,
      rank: row.rankValue,
      isSpoiler: normalizeBoolean(row.isSpoiler),
    })),
    synonyms: synonymRows[0].map((row) => row.synonym),
  };
}
