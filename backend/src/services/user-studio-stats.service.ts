import { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/db';
import { AnimeTitleLanguage } from './anime.service';

export type StudioStatsSort = 'count' | 'score' | 'watchTime';
export type StudioStatsStatus = 'all' | 'completed';

interface StudioStatsRow extends RowDataPacket {
  studioId: number;
  anilistId: number;
  name: string;
  isAnimationStudio: number | boolean;
  siteUrl: string | null;
  animeCount: number;
  completedAnimeCount: number;
  ratedAnimeCount: number;
  scoreSum: string | number | null;
  averageScore: string | number | null;
  communityAverageScore: string | number | null;
  totalWatchedEpisodes: string | number | null;
  totalWatchMinutes: string | number | null;
  firstReleaseYear: number | null;
  latestReleaseYear: number | null;
}

interface StudioAnimeRow extends RowDataPacket {
  animeId: number;
  anilistId: number;
  titleRomaji: string | null;
  titleEnglish: string | null;
  titleNative: string | null;
  titleUserPreferred: string | null;
  titleKorean: string | null;
  coverImageLarge: string | null;
  coverImageExtraLarge: string | null;
  bannerImage: string | null;
  seasonYear: number | null;
  format: string | null;
  status: string | null;
  episodes: number | null;
  duration: number | null;
  averageScore: number | null;
  userStatus: string;
  userScore: string | number | null;
  userProgress: number;
  listUpdatedAt: string;
  isMainStudio: number | boolean;
}

interface StudioRow extends RowDataPacket {
  id: number;
  anilistId: number;
  name: string;
  isAnimationStudio: number | boolean;
  siteUrl: string | null;
}

interface RankingCursorPayload {
  sort: StudioStatsSort;
  status: StudioStatsStatus;
  mainOnly: boolean;
  minAnimeCount: number;
  minRatedAnimeCount: number;
  animeCount?: number;
  ratedAnimeCount?: number;
  averageScore?: number | null;
  totalWatchMinutes?: number;
  studioId: number;
}

interface AnimeCursorPayload {
  studioId: number;
  status: StudioStatsStatus;
  mainOnly: boolean;
  animeId: number;
}

export interface StudioRankingParams {
  userId: number;
  sort: StudioStatsSort;
  status: StudioStatsStatus;
  mainOnly: boolean;
  minAnimeCount: number;
  minRatedAnimeCount: number;
  limit: number;
  cursor?: string;
}

export interface StudioAnimeParams {
  userId: number;
  studioId: number;
  titleLanguage: AnimeTitleLanguage;
  status: StudioStatsStatus;
  mainOnly: boolean;
  limit: number;
  cursor?: string;
}

function encodeCursor(payload: RankingCursorPayload | AnimeCursorPayload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodeCursor<T>(cursor?: string): T | null {
  if (!cursor) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as T;
  } catch {
    throw new Error('Invalid cursor');
  }
}

function toNumber(value: string | number | null) {
  if (value === null) {
    return null;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function roundMetric(value: number | null, fractionDigits = 2) {
  if (value === null) {
    return null;
  }

  return Number(value.toFixed(fractionDigits));
}

function pickTitle(row: StudioAnimeRow, titleLanguage: AnimeTitleLanguage) {
  if (titleLanguage === 'ko') {
    return row.titleKorean
      ?? row.titleEnglish
      ?? row.titleRomaji
      ?? row.titleUserPreferred
      ?? row.titleNative;
  }

  if (titleLanguage === 'en') {
    return row.titleEnglish
      ?? row.titleKorean
      ?? row.titleRomaji
      ?? row.titleUserPreferred
      ?? row.titleNative;
  }

  return row.titleNative
    ?? row.titleRomaji
    ?? row.titleUserPreferred
    ?? row.titleEnglish
    ?? row.titleKorean;
}

function getStatusWhereClause(status: StudioStatsStatus) {
  return status === 'completed'
    ? "AND ual.status = 'completed'"
    : '';
}

function getMainStudioWhereClause(mainOnly: boolean) {
  return mainOnly
    ? 'AND ans.is_main = TRUE'
    : '';
}

function getRankingCursorWhereClause(
  params: StudioRankingParams,
  cursor: RankingCursorPayload | null,
  queryParams: Array<string | number | boolean | null>
) {
  if (!cursor) {
    return '';
  }

  if (
    cursor.sort !== params.sort
    || cursor.status !== params.status
    || cursor.mainOnly !== params.mainOnly
    || cursor.minAnimeCount !== params.minAnimeCount
    || cursor.minRatedAnimeCount !== params.minRatedAnimeCount
  ) {
    throw new Error('Cursor does not match studio ranking query');
  }

  if (params.sort === 'score') {
    queryParams.push(
      cursor.averageScore ?? -1,
      cursor.averageScore ?? -1,
      cursor.ratedAnimeCount ?? 0,
      cursor.averageScore ?? -1,
      cursor.ratedAnimeCount ?? 0,
      cursor.animeCount ?? 0,
      cursor.averageScore ?? -1,
      cursor.ratedAnimeCount ?? 0,
      cursor.animeCount ?? 0,
      cursor.studioId
    );

    return `
      AND (
        stats.average_score < ?
        OR (stats.average_score = ? AND stats.rated_anime_count < ?)
        OR (stats.average_score = ? AND stats.rated_anime_count = ? AND stats.anime_count < ?)
        OR (stats.average_score = ? AND stats.rated_anime_count = ? AND stats.anime_count = ? AND stats.studio_id < ?)
      )
    `;
  }

  if (params.sort === 'watchTime') {
    queryParams.push(
      cursor.totalWatchMinutes ?? 0,
      cursor.totalWatchMinutes ?? 0,
      cursor.animeCount ?? 0,
      cursor.totalWatchMinutes ?? 0,
      cursor.animeCount ?? 0,
      cursor.studioId
    );

    return `
      AND (
        stats.total_watch_minutes < ?
        OR (stats.total_watch_minutes = ? AND stats.anime_count < ?)
        OR (stats.total_watch_minutes = ? AND stats.anime_count = ? AND stats.studio_id < ?)
      )
    `;
  }

  queryParams.push(cursor.animeCount ?? 0, cursor.animeCount ?? 0, cursor.studioId);

  return `
    AND (
      stats.anime_count < ?
      OR (stats.anime_count = ? AND stats.studio_id < ?)
    )
  `;
}

function getRankingOrderClause(sort: StudioStatsSort) {
  if (sort === 'score') {
    return 'stats.average_score DESC, stats.rated_anime_count DESC, stats.anime_count DESC, stats.studio_id DESC';
  }

  if (sort === 'watchTime') {
    return 'stats.total_watch_minutes DESC, stats.anime_count DESC, stats.studio_id DESC';
  }

  return 'stats.anime_count DESC, stats.studio_id DESC';
}

function mapStudioStatsRow(row: StudioStatsRow) {
  const averageScore = toNumber(row.averageScore);
  const communityAverageScore = toNumber(row.communityAverageScore);
  const totalWatchMinutes = Math.round(toNumber(row.totalWatchMinutes) ?? 0);

  return {
    studio: {
      id: row.studioId,
      anilistId: row.anilistId,
      name: row.name,
      isAnimationStudio: Boolean(row.isAnimationStudio),
      siteUrl: row.siteUrl,
    },
    animeCount: row.animeCount,
    completedAnimeCount: row.completedAnimeCount,
    ratedAnimeCount: row.ratedAnimeCount,
    scoreSum: roundMetric(toNumber(row.scoreSum)),
    averageScore: roundMetric(averageScore),
    communityAverageScore: roundMetric(communityAverageScore === null ? null : communityAverageScore / 10),
    totalWatchedEpisodes: Math.round(toNumber(row.totalWatchedEpisodes) ?? 0),
    totalWatchMinutes,
    totalWatchHours: roundMetric(totalWatchMinutes / 60),
    firstReleaseYear: row.firstReleaseYear,
    latestReleaseYear: row.latestReleaseYear,
  };
}

export function validateStudioStatsSort(value: unknown): StudioStatsSort {
  const sort = typeof value === 'string' ? value : 'count';

  if (sort !== 'count' && sort !== 'score' && sort !== 'watchTime') {
    throw new Error('sort must be one of count, score, watchTime');
  }

  return sort;
}

export function validateStudioStatsStatus(value: unknown): StudioStatsStatus {
  const status = typeof value === 'string' ? value : 'completed';

  if (status !== 'all' && status !== 'completed') {
    throw new Error('status must be one of all, completed');
  }

  return status;
}

export function validateStudioStatsBoolean(value: unknown, defaultValue: boolean) {
  if (value === undefined) {
    return defaultValue;
  }

  if (value === true || value === 'true' || value === '1') {
    return true;
  }

  if (value === false || value === 'false' || value === '0') {
    return false;
  }

  throw new Error('mainOnly must be a boolean');
}

export function validateStudioStatsLimit(value: unknown) {
  const limit = Number(value ?? 20);

  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new Error('limit must be an integer between 1 and 50');
  }

  return limit;
}

export function validateStudioStatsMinimumCount(value: unknown, fieldName: string, defaultValue: number) {
  const count = Number(value ?? defaultValue);

  if (!Number.isInteger(count) || count < 1 || count > 100) {
    throw new Error(`${fieldName} must be an integer between 1 and 100`);
  }

  return count;
}

export function validateStudioId(value: unknown) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('studioId must be a positive integer');
  }

  return id;
}

export async function getUserStudioRanking(params: StudioRankingParams) {
  const statusWhere = getStatusWhereClause(params.status);
  const mainStudioWhere = getMainStudioWhereClause(params.mainOnly);
  const cursor = decodeCursor<RankingCursorPayload>(params.cursor);
  const queryParams: Array<string | number | boolean | null> = [
    params.userId,
    params.minAnimeCount,
  ];
  const scoreHaving = params.sort === 'score'
    ? 'AND stats.rated_anime_count >= ? AND stats.average_score IS NOT NULL'
    : '';

  if (params.sort === 'score') {
    queryParams.push(params.minRatedAnimeCount);
  }

  const cursorWhere = getRankingCursorWhereClause(params, cursor, queryParams);
  queryParams.push(params.limit + 1);

  const [rows] = await pool.query<StudioStatsRow[]>(
    `
    SELECT
      stats.studio_id AS studioId,
      s.anilist_id AS anilistId,
      s.name,
      s.is_animation_studio AS isAnimationStudio,
      s.site_url AS siteUrl,
      stats.anime_count AS animeCount,
      stats.completed_anime_count AS completedAnimeCount,
      stats.rated_anime_count AS ratedAnimeCount,
      stats.score_sum AS scoreSum,
      stats.average_score AS averageScore,
      stats.community_average_score AS communityAverageScore,
      stats.total_watched_episodes AS totalWatchedEpisodes,
      stats.total_watch_minutes AS totalWatchMinutes,
      stats.first_release_year AS firstReleaseYear,
      stats.latest_release_year AS latestReleaseYear
    FROM (
      SELECT
        ans.studio_id,
        COUNT(DISTINCT ual.anime_id) AS anime_count,
        COUNT(DISTINCT CASE WHEN ual.status = 'completed' THEN ual.anime_id END) AS completed_anime_count,
        COUNT(DISTINCT CASE WHEN ual.score IS NOT NULL THEN ual.anime_id END) AS rated_anime_count,
        SUM(ual.score) AS score_sum,
        AVG(ual.score) AS average_score,
        AVG(a.average_score) AS community_average_score,
        SUM(
          CASE
            WHEN a.episodes IS NOT NULL AND a.episodes > 0 AND ual.status = 'completed' THEN a.episodes
            WHEN a.episodes IS NOT NULL AND a.episodes > 0 THEN LEAST(ual.progress, a.episodes)
            ELSE ual.progress
          END
        ) AS total_watched_episodes,
        SUM(
          (
            CASE
              WHEN a.episodes IS NOT NULL AND a.episodes > 0 AND ual.status = 'completed' THEN a.episodes
              WHEN a.episodes IS NOT NULL AND a.episodes > 0 THEN LEAST(ual.progress, a.episodes)
              ELSE ual.progress
            END
          ) * COALESCE(a.duration, 0)
        ) AS total_watch_minutes,
        MIN(a.season_year) AS first_release_year,
        MAX(a.season_year) AS latest_release_year
      FROM user_anime_lists ual
      INNER JOIN anime a
        ON a.id = ual.anime_id
        AND a.is_adult = FALSE
        AND a.app_visible = TRUE
      INNER JOIN anime_studios ans
        ON ans.anime_id = a.id
      WHERE ual.user_id = ?
        ${statusWhere}
        ${mainStudioWhere}
      GROUP BY ans.studio_id
    ) stats
    INNER JOIN studios s
      ON s.id = stats.studio_id
    WHERE stats.anime_count >= ?
      ${scoreHaving}
      ${cursorWhere}
    ORDER BY ${getRankingOrderClause(params.sort)}
    LIMIT ?
    `,
    queryParams
  );

  const hasNext = rows.length > params.limit;
  const pageRows = hasNext ? rows.slice(0, params.limit) : rows;
  const lastRow = pageRows[pageRows.length - 1];

  return {
    items: pageRows.map(mapStudioStatsRow),
    pageInfo: {
      limit: params.limit,
      sort: params.sort,
      status: params.status,
      mainOnly: params.mainOnly,
      minAnimeCount: params.minAnimeCount,
      minRatedAnimeCount: params.minRatedAnimeCount,
      hasNext,
      nextCursor: hasNext && lastRow
        ? encodeCursor({
          sort: params.sort,
          status: params.status,
          mainOnly: params.mainOnly,
          minAnimeCount: params.minAnimeCount,
          minRatedAnimeCount: params.minRatedAnimeCount,
          animeCount: lastRow.animeCount,
          ratedAnimeCount: lastRow.ratedAnimeCount,
          averageScore: toNumber(lastRow.averageScore),
          totalWatchMinutes: Math.round(toNumber(lastRow.totalWatchMinutes) ?? 0),
          studioId: lastRow.studioId,
        })
        : null,
    },
    summary: {
      studioCount: pageRows.length,
      source: {
        status: params.status,
        mainOnly: params.mainOnly,
      },
    },
  };
}

export async function getUserStudioAnime(params: StudioAnimeParams) {
  const [studioRows] = await pool.query<StudioRow[]>(
    `
    SELECT
      id,
      anilist_id AS anilistId,
      name,
      is_animation_studio AS isAnimationStudio,
      site_url AS siteUrl
    FROM studios
    WHERE id = ?
    LIMIT 1
    `,
    [params.studioId]
  );

  if (!studioRows[0]) {
    throw new Error('Studio not found');
  }

  const cursor = decodeCursor<AnimeCursorPayload>(params.cursor);
  const queryParams: Array<string | number> = [params.studioId, params.userId];
  let cursorWhere = '';

  if (cursor) {
    if (
      cursor.studioId !== params.studioId
      || cursor.status !== params.status
      || cursor.mainOnly !== params.mainOnly
    ) {
      throw new Error('Cursor does not match studio anime query');
    }

    cursorWhere = 'AND a.id < ?';
    queryParams.push(cursor.animeId);
  }

  queryParams.push(params.limit + 1);

  const [rows] = await pool.query<StudioAnimeRow[]>(
    `
    SELECT
      a.id AS animeId,
      a.anilist_id AS anilistId,
      a.title_romaji AS titleRomaji,
      a.title_english AS titleEnglish,
      a.title_native AS titleNative,
      a.title_user_preferred AS titleUserPreferred,
      akt.full_title AS titleKorean,
      a.cover_image_large AS coverImageLarge,
      a.cover_image_extra_large AS coverImageExtraLarge,
      a.banner_image AS bannerImage,
      a.season_year AS seasonYear,
      a.format,
      a.status,
      a.episodes,
      a.duration,
      a.average_score AS averageScore,
      ual.status AS userStatus,
      ual.score AS userScore,
      ual.progress AS userProgress,
      ual.updated_at AS listUpdatedAt,
      ans.is_main AS isMainStudio
    FROM user_anime_lists ual
    INNER JOIN anime a
      ON a.id = ual.anime_id
      AND a.is_adult = FALSE
      AND a.app_visible = TRUE
    INNER JOIN anime_studios ans
      ON ans.anime_id = a.id
      AND ans.studio_id = ?
    LEFT JOIN anime_korean_titles akt
      ON akt.anime_id = a.id
      AND akt.is_primary = TRUE
    WHERE ual.user_id = ?
      ${getStatusWhereClause(params.status)}
      ${getMainStudioWhereClause(params.mainOnly)}
      ${cursorWhere}
    ORDER BY a.id DESC
    LIMIT ?
    `,
    queryParams
  );

  const hasNext = rows.length > params.limit;
  const pageRows = hasNext ? rows.slice(0, params.limit) : rows;
  const lastRow = pageRows[pageRows.length - 1];
  const studio = studioRows[0];

  return {
    studio: {
      id: studio.id,
      anilistId: studio.anilistId,
      name: studio.name,
      isAnimationStudio: Boolean(studio.isAnimationStudio),
      siteUrl: studio.siteUrl,
    },
    items: pageRows.map((row) => ({
      anime: {
        id: row.animeId,
        anilistId: row.anilistId,
        title: pickTitle(row, params.titleLanguage),
        titles: {
          korean: row.titleKorean,
          english: row.titleEnglish,
          native: row.titleNative,
          romaji: row.titleRomaji,
          userPreferred: row.titleUserPreferred,
        },
        coverImageLarge: row.coverImageLarge,
        coverImageExtraLarge: row.coverImageExtraLarge,
        bannerImage: row.bannerImage,
        seasonYear: row.seasonYear,
        format: row.format,
        status: row.status,
        episodes: row.episodes,
        duration: row.duration,
        averageScore: row.averageScore,
      },
      userList: {
        status: row.userStatus,
        score: toNumber(row.userScore),
        progress: row.userProgress,
        updatedAt: row.listUpdatedAt,
      },
      studioRelation: {
        isMain: Boolean(row.isMainStudio),
      },
    })),
    pageInfo: {
      limit: params.limit,
      titleLanguage: params.titleLanguage,
      status: params.status,
      mainOnly: params.mainOnly,
      hasNext,
      nextCursor: hasNext && lastRow
        ? encodeCursor({
          studioId: params.studioId,
          status: params.status,
          mainOnly: params.mainOnly,
          animeId: lastRow.animeId,
        })
        : null,
    },
  };
}
