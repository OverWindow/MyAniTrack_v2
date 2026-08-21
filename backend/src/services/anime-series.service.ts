import { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/db';
import { AnimeGenre, AnimeSortOption, AnimeTitleLanguage } from './anime.service';

export type AnimeSeriesScope = 'mainline' | 'franchise';

type SeriesCursorPayload = {
  scope: AnimeSeriesScope;
  sort: AnimeSortOption;
  query: string | null;
  genre: AnimeGenre | null;
  seriesId: number;
  createdAt?: string;
  score?: number;
  popularity?: number;
  seasonYear?: number;
  seasonRank?: number;
};

export type AnimeSeriesListParams = {
  scope: AnimeSeriesScope;
  sort: AnimeSortOption;
  titleLanguage: AnimeTitleLanguage;
  query?: string;
  genre?: AnimeGenre;
  limit: number;
  cursor?: string;
};

interface SeriesSummaryRow extends RowDataPacket {
  seriesId: number;
  scope: AnimeSeriesScope;
  seriesTitle: string | null;
  canonicalAnimeId: number;
  memberCount: number | string;
  titleRomaji: string | null;
  titleEnglish: string | null;
  titleNative: string | null;
  titleUserPreferred: string | null;
  titleKorean: string | null;
  coverImageLarge: string | null;
  coverImageExtraLarge: string | null;
  averageScore: number | null;
  popularity: number | null;
  season: string | null;
  seasonYear: number | null;
  createdAt: string;
  seasonRankValue: number;
}

interface SeriesMemberRow extends RowDataPacket {
  seriesId: number;
  animeId: number;
  anilistId: number;
  titleRomaji: string | null;
  titleEnglish: string | null;
  titleNative: string | null;
  titleUserPreferred: string | null;
  titleKorean: string | null;
  coverImageLarge: string | null;
  coverImageExtraLarge: string | null;
  season: string | null;
  seasonYear: number | null;
  format: string | null;
  status: string | null;
}

const SCORE_SQL = 'COALESCE(canonicalAnime.average_score, -1)';
const POPULARITY_SQL = 'COALESCE(canonicalAnime.popularity, -1)';
const SEASON_YEAR_SQL = 'COALESCE(canonicalAnime.season_year, 0)';
const SEASON_RANK_SQL = `CASE canonicalAnime.season
  WHEN 'WINTER' THEN 1
  WHEN 'SPRING' THEN 2
  WHEN 'SUMMER' THEN 3
  WHEN 'FALL' THEN 4
  ELSE 0
END`;

function toNumber(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function normalizeQuery(query?: string) {
  const normalized = query?.trim();
  return normalized || undefined;
}

function pickTitle(row: {
  titleRomaji: string | null;
  titleEnglish: string | null;
  titleNative: string | null;
  titleUserPreferred: string | null;
  titleKorean: string | null;
}, language: AnimeTitleLanguage) {
  if (language === 'ko') {
    return row.titleKorean ?? row.titleEnglish ?? row.titleRomaji ?? row.titleUserPreferred ?? row.titleNative;
  }

  if (language === 'en') {
    return row.titleEnglish ?? row.titleRomaji ?? row.titleUserPreferred ?? row.titleKorean ?? row.titleNative;
  }

  return row.titleNative ?? row.titleRomaji ?? row.titleUserPreferred ?? row.titleEnglish ?? row.titleKorean;
}

function encodeCursor(payload: SeriesCursorPayload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodeCursor(value?: string): SeriesCursorPayload | null {
  if (!value) return null;

  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as SeriesCursorPayload;
  } catch {
    throw new Error('Invalid cursor');
  }
}

function validateCursor(cursor: SeriesCursorPayload | null, params: AnimeSeriesListParams, query?: string) {
  if (!cursor) return;
  if (cursor.scope !== params.scope) throw new Error('Cursor scope does not match requested scope');
  if (cursor.sort !== params.sort) throw new Error('Cursor sort does not match requested sort');
  if (cursor.query !== (query ?? null)) throw new Error('Cursor query does not match requested query');
  if (cursor.genre !== (params.genre ?? null)) throw new Error('Cursor genre does not match requested genre');
}

function getOrderBy(sort: AnimeSortOption) {
  if (sort === 'score') return `${SCORE_SQL} DESC, seriesRow.id DESC`;
  if (sort === 'popularity') return `${POPULARITY_SQL} DESC, seriesRow.id DESC`;
  if (sort === 'season') return `${SEASON_YEAR_SQL} DESC, ${SEASON_RANK_SQL} DESC, seriesRow.id DESC`;
  return 'canonicalAnime.created_at DESC, seriesRow.id DESC';
}

function getCursorClause(
  cursor: SeriesCursorPayload | null,
  sort: AnimeSortOption,
  queryParams: Array<string | number | null>
) {
  if (!cursor) return '';

  if (sort === 'score') {
    queryParams.push(cursor.score ?? -1, cursor.score ?? -1, cursor.seriesId);
    return `AND (${SCORE_SQL} < ? OR (${SCORE_SQL} = ? AND seriesRow.id < ?))`;
  }

  if (sort === 'popularity') {
    queryParams.push(cursor.popularity ?? -1, cursor.popularity ?? -1, cursor.seriesId);
    return `AND (${POPULARITY_SQL} < ? OR (${POPULARITY_SQL} = ? AND seriesRow.id < ?))`;
  }

  if (sort === 'season') {
    queryParams.push(
      cursor.seasonYear ?? 0,
      cursor.seasonYear ?? 0,
      cursor.seasonRank ?? 0,
      cursor.seasonYear ?? 0,
      cursor.seasonRank ?? 0,
      cursor.seriesId
    );
    return `AND (
      ${SEASON_YEAR_SQL} < ?
      OR (${SEASON_YEAR_SQL} = ? AND ${SEASON_RANK_SQL} < ?)
      OR (${SEASON_YEAR_SQL} = ? AND ${SEASON_RANK_SQL} = ? AND seriesRow.id < ?)
    )`;
  }

  if (!cursor.createdAt) throw new Error('Invalid cursor');
  queryParams.push(cursor.createdAt, cursor.createdAt, cursor.seriesId);
  return `AND (
    canonicalAnime.created_at < ?
    OR (canonicalAnime.created_at = ? AND seriesRow.id < ?)
  )`;
}

export async function getAnimeSeriesList(params: AnimeSeriesListParams) {
  const normalizedQuery = normalizeQuery(params.query);
  const cursor = decodeCursor(params.cursor);
  validateCursor(cursor, params, normalizedQuery);

  const queryParams: Array<string | number | null> = [params.scope];
  let genreClause = '';
  let searchClause = '';

  if (params.genre) {
    queryParams.push(params.genre);
    genreClause = `AND EXISTS (
      SELECT 1
      FROM anime_series_members genreMember
      INNER JOIN anime_genres genreRow ON genreRow.anime_id = genreMember.anime_id
      WHERE genreMember.series_id = seriesRow.id AND genreRow.genre = ?
    )`;
  }

  if (normalizedQuery) {
    const keyword = `%${normalizedQuery}%`;
    queryParams.push(keyword, keyword, keyword, keyword, keyword, keyword);
    searchClause = `AND (
      seriesRow.title LIKE ?
      OR EXISTS (
        SELECT 1
        FROM anime_series_members searchMember
        INNER JOIN anime searchAnime
          ON searchAnime.id = searchMember.anime_id
          AND searchAnime.is_adult = FALSE
          AND searchAnime.app_visible = TRUE
        LEFT JOIN anime_korean_titles searchKorean
          ON searchKorean.anime_id = searchAnime.id AND searchKorean.is_primary = TRUE
        WHERE searchMember.series_id = seriesRow.id
          AND (
            searchAnime.title_romaji LIKE ?
            OR searchAnime.title_english LIKE ?
            OR searchAnime.title_native LIKE ?
            OR searchAnime.title_user_preferred LIKE ?
            OR searchKorean.full_title LIKE ?
          )
      )
    )`;
  }

  const cursorClause = getCursorClause(cursor, params.sort, queryParams);
  queryParams.push(params.limit + 1);

  const [summaryRows] = await pool.query<SeriesSummaryRow[]>(
    `SELECT
      seriesRow.id AS seriesId,
      seriesRow.scope,
      seriesRow.title AS seriesTitle,
      seriesRow.canonical_anime_id AS canonicalAnimeId,
      COUNT(memberRow.anime_id) AS memberCount,
      canonicalAnime.title_romaji AS titleRomaji,
      canonicalAnime.title_english AS titleEnglish,
      canonicalAnime.title_native AS titleNative,
      canonicalAnime.title_user_preferred AS titleUserPreferred,
      canonicalKorean.full_title AS titleKorean,
      canonicalAnime.cover_image_large AS coverImageLarge,
      canonicalAnime.cover_image_extra_large AS coverImageExtraLarge,
      canonicalAnime.average_score AS averageScore,
      canonicalAnime.popularity,
      canonicalAnime.season,
      canonicalAnime.season_year AS seasonYear,
      canonicalAnime.created_at AS createdAt,
      ${SEASON_RANK_SQL} AS seasonRankValue
    FROM anime_series seriesRow
    INNER JOIN anime_series_members memberRow ON memberRow.series_id = seriesRow.id
    INNER JOIN anime memberAnime ON memberAnime.id = memberRow.anime_id AND memberAnime.is_adult = FALSE AND memberAnime.app_visible = TRUE
    INNER JOIN anime canonicalAnime ON canonicalAnime.id = seriesRow.canonical_anime_id AND canonicalAnime.is_adult = FALSE AND canonicalAnime.app_visible = TRUE
    LEFT JOIN anime_korean_titles canonicalKorean
      ON canonicalKorean.anime_id = canonicalAnime.id AND canonicalKorean.is_primary = TRUE
    WHERE seriesRow.scope = ?
      ${genreClause}
      ${searchClause}
      ${cursorClause}
    GROUP BY
      seriesRow.id,
      seriesRow.scope,
      seriesRow.title,
      seriesRow.canonical_anime_id,
      canonicalAnime.title_romaji,
      canonicalAnime.title_english,
      canonicalAnime.title_native,
      canonicalAnime.title_user_preferred,
      canonicalKorean.full_title,
      canonicalAnime.cover_image_large,
      canonicalAnime.cover_image_extra_large,
      canonicalAnime.average_score,
      canonicalAnime.popularity,
      canonicalAnime.season,
      canonicalAnime.season_year,
      canonicalAnime.created_at
    ORDER BY ${getOrderBy(params.sort)}
    LIMIT ?`,
    queryParams
  );

  const hasNext = summaryRows.length > params.limit;
  const pageRows = hasNext ? summaryRows.slice(0, params.limit) : summaryRows;
  const seriesIds = pageRows.map((row) => row.seriesId);
  let memberRows: SeriesMemberRow[] = [];

  if (seriesIds.length > 0) {
    const [rows] = await pool.query<SeriesMemberRow[]>(
      `SELECT
        memberRow.series_id AS seriesId,
        animeRow.id AS animeId,
        animeRow.anilist_id AS anilistId,
        animeRow.title_romaji AS titleRomaji,
        animeRow.title_english AS titleEnglish,
        animeRow.title_native AS titleNative,
        animeRow.title_user_preferred AS titleUserPreferred,
        koreanTitle.full_title AS titleKorean,
        animeRow.cover_image_large AS coverImageLarge,
        animeRow.cover_image_extra_large AS coverImageExtraLarge,
        animeRow.season,
        animeRow.season_year AS seasonYear,
        animeRow.format,
        animeRow.status
      FROM anime_series_members memberRow
      INNER JOIN anime animeRow ON animeRow.id = memberRow.anime_id AND animeRow.is_adult = FALSE AND animeRow.app_visible = TRUE
      LEFT JOIN anime_korean_titles koreanTitle
        ON koreanTitle.anime_id = animeRow.id AND koreanTitle.is_primary = TRUE
      WHERE memberRow.series_id IN (?)
      ORDER BY
        memberRow.series_id,
        animeRow.season_year IS NULL,
        animeRow.season_year ASC,
        CASE animeRow.season
          WHEN 'WINTER' THEN 1
          WHEN 'SPRING' THEN 2
          WHEN 'SUMMER' THEN 3
          WHEN 'FALL' THEN 4
          ELSE 5
        END,
        animeRow.id ASC`,
      [seriesIds]
    );
    memberRows = rows;
  }

  const membersBySeriesId = new Map<number, SeriesMemberRow[]>();
  for (const row of memberRows) {
    const members = membersBySeriesId.get(row.seriesId) ?? [];
    members.push(row);
    membersBySeriesId.set(row.seriesId, members);
  }

  const items = pageRows.map((row) => ({
    seriesId: row.seriesId,
    scope: row.scope,
    title: row.seriesTitle ?? pickTitle(row, params.titleLanguage) ?? '이름 없는 시리즈',
    customTitle: row.seriesTitle,
    canonicalAnimeId: row.canonicalAnimeId,
    memberCount: toNumber(row.memberCount),
    averageScore: row.averageScore,
    popularity: row.popularity,
    season: row.season,
    seasonYear: row.seasonYear,
    coverImageLarge: row.coverImageLarge,
    coverImageExtraLarge: row.coverImageExtraLarge,
    items: (membersBySeriesId.get(row.seriesId) ?? []).map((member) => ({
      id: member.animeId,
      anilistId: member.anilistId,
      title: pickTitle(member, params.titleLanguage) ?? '제목 없음',
      titles: {
        korean: member.titleKorean,
        english: member.titleEnglish,
        native: member.titleNative,
        romaji: member.titleRomaji,
        userPreferred: member.titleUserPreferred,
      },
      coverImageLarge: member.coverImageLarge,
      coverImageExtraLarge: member.coverImageExtraLarge,
      season: member.season,
      seasonYear: member.seasonYear,
      format: member.format,
      status: member.status,
    })),
  }));

  const lastRow = pageRows[pageRows.length - 1];
  const nextCursor = hasNext && lastRow
    ? encodeCursor({
        scope: params.scope,
        sort: params.sort,
        query: normalizedQuery ?? null,
        genre: params.genre ?? null,
        seriesId: lastRow.seriesId,
        createdAt: lastRow.createdAt,
        score: lastRow.averageScore ?? -1,
        popularity: lastRow.popularity ?? -1,
        seasonYear: lastRow.seasonYear ?? 0,
        seasonRank: lastRow.seasonRankValue ?? 0,
      })
    : null;

  return {
    items,
    pageInfo: {
      hasNext,
      nextCursor,
      limit: params.limit,
      scope: params.scope,
      sort: params.sort,
      titleLanguage: params.titleLanguage,
      query: normalizedQuery ?? null,
      genre: params.genre ?? null,
    },
  };
}
