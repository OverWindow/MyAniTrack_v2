import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/db';
import { AnimeGenre } from './anime.service';
import { recalculateUserAnimeStats } from './recommendation.service';

const LIST_STATUS_OPTIONS = ['planned', 'watching', 'completed', 'paused', 'dropped'] as const;
const USER_ANIME_LIST_SORT_OPTIONS = ['latest', 'added', 'score', 'scoreAsc'] as const;

type ListStatus = typeof LIST_STATUS_OPTIONS[number];
export type UserAnimeListSortOption = typeof USER_ANIME_LIST_SORT_OPTIONS[number];
export type UserAnimeListTitleLanguage = 'ko' | 'en' | 'ja';

interface UserAnimeListRow extends RowDataPacket {
  id: number;
  userId: number;
  animeId: number;
  status: string;
  score: number | null;
  progress: number;
  startedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface UserAnimeListListRow extends RowDataPacket {
  id: number;
  userId: number;
  animeId: number;
  status: string;
  score: number | null;
  progress: number;
  startedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  animeAnilistId: number;
  animeTitleRomaji: string | null;
  animeTitleEnglish: string | null;
  animeTitleNative: string | null;
  animeTitleUserPreferred: string | null;
  animeTitleKorean: string | null;
  animeEpisodes: number | null;
  animeDuration: number | null;
  animeSeason: string | null;
  animeSeasonYear: number | null;
  animeFormat: string | null;
  animeStatus: string | null;
  animeAverageScore: number | null;
  animeMeanScore: number | null;
  animePopularity: number | null;
  animeFavourites: number | null;
  animeCoverImageLarge: string | null;
  animeCoverImageExtraLarge: string | null;
  animeBannerImage: string | null;
  animeSiteUrl: string | null;
  animeIsAdult: number | boolean;
  sortScoreValue: number | null;
}

interface UserAnimeListCursorPayload {
  sort: UserAnimeListSortOption;
  genre?: AnimeGenre | null;
  score?: number | null;
  createdAt?: string;
  updatedAt?: string;
  animeId: number;
}

export interface GetUserAnimeListParams {
  userId: number;
  sort: UserAnimeListSortOption;
  titleLanguage: UserAnimeListTitleLanguage;
  genre?: AnimeGenre;
  limit: number;
  cursor?: string;
}

interface UserAnimeListInput {
  status: unknown;
  score?: unknown;
  progress?: unknown;
  startedAt?: unknown;
  completedAt?: unknown;
  notes?: unknown;
}

interface UserAnimeListChanges {
  status?: ListStatus;
  score?: number | null;
  progress?: number;
  startedAt?: string | null;
  completedAt?: string | null;
  notes?: string | null;
}

function validateAnimeId(animeId: number) {
  if (!Number.isInteger(animeId) || animeId <= 0) {
    throw new Error('animeId must be a positive integer');
  }

  return animeId;
}

export function validateUserAnimeListSort(sort: unknown): UserAnimeListSortOption {
  if (typeof sort !== 'string' || !USER_ANIME_LIST_SORT_OPTIONS.includes(sort as UserAnimeListSortOption)) {
    throw new Error('sort must be one of latest, added, score, scoreAsc');
  }

  return sort as UserAnimeListSortOption;
}

export function validateUserAnimeListTitleLanguage(value: unknown): UserAnimeListTitleLanguage {
  if (value !== 'ko' && value !== 'en' && value !== 'ja') {
    throw new Error('titleLanguage must be one of ko, en, ja');
  }

  return value;
}

export function validateUserAnimeListLimit(value: unknown): number {
  const limit = Number(value ?? 20);

  if (!Number.isInteger(limit) || limit <= 0 || limit > 50) {
    throw new Error('limit must be an integer between 1 and 50');
  }

  return limit;
}

export function validateUserAnimeListGenre(value: unknown): AnimeGenre | undefined {
  if (value === undefined) {
    return undefined;
  }

  const genres: AnimeGenre[] = [
    'Action',
    'Adventure',
    'Drama',
    'Sci-Fi',
    'Mystery',
    'Comedy',
    'Supernatural',
    'Fantasy',
    'Sports',
    'Romance',
    'Slice of Life',
    'Horror',
    'Psychological',
    'Thriller',
    'Ecchi',
    'Mecha',
    'Music',
    'Mahou Shoujo',
    'Hentai',
  ];

  if (typeof value !== 'string' || !genres.includes(value as AnimeGenre)) {
    throw new Error(`genre must be one of ${genres.join(', ')}`);
  }

  return value as AnimeGenre;
}

function validateStatus(status: unknown): ListStatus {
  if (typeof status !== 'string' || !LIST_STATUS_OPTIONS.includes(status as ListStatus)) {
    throw new Error('status must be one of planned, watching, completed, paused, dropped');
  }

  return status as ListStatus;
}

function validateOptionalScore(score: unknown): number | null {
  if (score === null || score === undefined || score === '') {
    return null;
  }

  const parsedScore = Number(score);

  if (!Number.isFinite(parsedScore) || parsedScore < 0 || parsedScore > 10) {
    throw new Error('score must be between 0 and 10');
  }

  return Number(parsedScore.toFixed(2));
}

function validateOptionalProgress(progress: unknown): number {
  if (progress === undefined) {
    return 0;
  }

  const parsedProgress = Number(progress);

  if (!Number.isInteger(parsedProgress) || parsedProgress < 0) {
    throw new Error('progress must be a non-negative integer');
  }

  return parsedProgress;
}

function validateOptionalDate(value: unknown, fieldName: string): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${fieldName} must be in YYYY-MM-DD format`);
  }

  return value;
}

function validateOptionalNotes(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new Error('notes must be a string');
  }

  const normalizedNotes = value.trim();
  return normalizedNotes ? normalizedNotes : null;
}

function buildFullInput(input: UserAnimeListInput): Required<UserAnimeListChanges> {
  return {
    status: validateStatus(input.status),
    score: validateOptionalScore(input.score),
    progress: validateOptionalProgress(input.progress),
    startedAt: validateOptionalDate(input.startedAt, 'startedAt'),
    completedAt: validateOptionalDate(input.completedAt, 'completedAt'),
    notes: validateOptionalNotes(input.notes),
  };
}

function buildPartialInput(input: UserAnimeListInput): UserAnimeListChanges {
  const changes: UserAnimeListChanges = {};

  if ('status' in input) {
    changes.status = validateStatus(input.status);
  }

  if ('score' in input) {
    changes.score = validateOptionalScore(input.score);
  }

  if ('progress' in input) {
    changes.progress = validateOptionalProgress(input.progress);
  }

  if ('startedAt' in input) {
    changes.startedAt = validateOptionalDate(input.startedAt, 'startedAt');
  }

  if ('completedAt' in input) {
    changes.completedAt = validateOptionalDate(input.completedAt, 'completedAt');
  }

  if ('notes' in input) {
    changes.notes = validateOptionalNotes(input.notes);
  }

  if (Object.keys(changes).length === 0) {
    throw new Error('At least one field is required to update');
  }

  return changes;
}

async function ensureAnimeExists(animeId: number) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `
    SELECT id
    FROM anime
    WHERE id = ?
    LIMIT 1
    `,
    [animeId]
  );

  if (!rows[0]) {
    throw new Error('Anime not found');
  }
}

async function findUserAnimeListItem(userId: number, animeId: number) {
  const [rows] = await pool.query<UserAnimeListRow[]>(
    `
    SELECT
      id,
      user_id AS userId,
      anime_id AS animeId,
      status,
      score,
      progress,
      started_at AS startedAt,
      completed_at AS completedAt,
      notes,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM user_anime_lists
    WHERE user_id = ?
      AND anime_id = ?
    LIMIT 1
    `,
    [userId, animeId]
  );

  return rows[0] ?? null;
}

function mapUserAnimeListItem(row: UserAnimeListRow) {
  return {
    id: row.id,
    userId: row.userId,
    animeId: row.animeId,
    status: row.status,
    score: row.score,
    progress: row.progress,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function decodeCursor(cursor?: string): UserAnimeListCursorPayload | null {
  if (!cursor) {
    return null;
  }

  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    return JSON.parse(decoded) as UserAnimeListCursorPayload;
  } catch {
    throw new Error('Invalid cursor');
  }
}

function encodeCursor(payload: UserAnimeListCursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function pickDisplayTitle(row: UserAnimeListListRow, titleLanguage: UserAnimeListTitleLanguage) {
  if (titleLanguage === 'ko') {
    return row.animeTitleKorean
      ?? row.animeTitleEnglish
      ?? row.animeTitleRomaji
      ?? row.animeTitleUserPreferred
      ?? row.animeTitleNative;
  }

  if (titleLanguage === 'en') {
    return row.animeTitleEnglish
      ?? row.animeTitleKorean
      ?? row.animeTitleRomaji
      ?? row.animeTitleUserPreferred
      ?? row.animeTitleNative;
  }

  return row.animeTitleNative
    ?? row.animeTitleRomaji
    ?? row.animeTitleUserPreferred
    ?? row.animeTitleEnglish
    ?? row.animeTitleKorean;
}

function buildOrderClause(sort: UserAnimeListSortOption) {
  if (sort === 'score') {
    return 'COALESCE(ual.score, -1) DESC, ual.anime_id DESC';
  }

  if (sort === 'scoreAsc') {
    return 'COALESCE(ual.score, 11) ASC, ual.anime_id DESC';
  }

  if (sort === 'added') {
    return 'ual.created_at DESC, ual.anime_id DESC';
  }

  return 'ual.updated_at DESC, ual.anime_id DESC';
}

function buildCursorWhereClause(
  sort: UserAnimeListSortOption,
  cursor: UserAnimeListCursorPayload | null,
  params: Array<string | number | null>
) {
  if (!cursor) {
    return '';
  }

  if (cursor.sort !== sort) {
    throw new Error('Cursor sort does not match requested sort');
  }

  if (sort === 'score') {
    params.push(cursor.score ?? -1, cursor.score ?? -1, cursor.animeId);
    return `
      AND (
        COALESCE(ual.score, -1) < ?
        OR (COALESCE(ual.score, -1) = ? AND ual.anime_id < ?)
      )
    `;
  }

  if (sort === 'added') {
    if (!cursor.createdAt) {
      throw new Error('Invalid cursor');
    }

    params.push(cursor.createdAt, cursor.createdAt, cursor.animeId);
    return `
      AND (
        ual.created_at < ?
        OR (ual.created_at = ? AND ual.anime_id < ?)
      )
    `;
  }

  if (!cursor.updatedAt) {
    throw new Error('Invalid cursor');
  }

  params.push(cursor.updatedAt, cursor.updatedAt, cursor.animeId);
  return `
    AND (
      ual.updated_at < ?
      OR (ual.updated_at = ? AND ual.anime_id < ?)
    )
  `;
}

function buildGenreWhereClause(
  genre: AnimeGenre | undefined,
  cursor: UserAnimeListCursorPayload | null,
  params: Array<string | number | null>
) {
  if (cursor && (cursor.genre ?? null) !== (genre ?? null)) {
    throw new Error('Cursor genre does not match requested genre');
  }

  if (!genre) {
    return '';
  }

  params.push(genre);
  return `
    AND EXISTS (
      SELECT 1
      FROM anime_genres ag
      WHERE ag.anime_id = a.id
        AND ag.genre = ?
    )
  `;
}

export async function getUserAnimeList(params: GetUserAnimeListParams) {
  const decodedCursor = decodeCursor(params.cursor);
  const queryParams: Array<string | number | null> = [params.userId];
  const genreWhereClause = buildGenreWhereClause(params.genre, decodedCursor, queryParams);
  const cursorWhereClause = buildCursorWhereClause(params.sort, decodedCursor, queryParams);
  const orderByClause = buildOrderClause(params.sort);

  queryParams.push(params.limit + 1);

  const [rows] = await pool.query<UserAnimeListListRow[]>(
    `
    SELECT
      ual.id,
      ual.user_id AS userId,
      ual.anime_id AS animeId,
      ual.status,
      ual.score,
      ual.progress,
      ual.started_at AS startedAt,
      ual.completed_at AS completedAt,
      ual.notes,
      ual.created_at AS createdAt,
      ual.updated_at AS updatedAt,
      a.anilist_id AS animeAnilistId,
      a.title_romaji AS animeTitleRomaji,
      a.title_english AS animeTitleEnglish,
      a.title_native AS animeTitleNative,
      a.title_user_preferred AS animeTitleUserPreferred,
      akt.full_title AS animeTitleKorean,
      a.episodes AS animeEpisodes,
      a.duration AS animeDuration,
      a.season AS animeSeason,
      a.season_year AS animeSeasonYear,
      a.format AS animeFormat,
      a.status AS animeStatus,
      a.average_score AS animeAverageScore,
      a.mean_score AS animeMeanScore,
      a.popularity AS animePopularity,
      a.favourites AS animeFavourites,
      a.cover_image_large AS animeCoverImageLarge,
      a.cover_image_extra_large AS animeCoverImageExtraLarge,
      a.banner_image AS animeBannerImage,
      a.site_url AS animeSiteUrl,
      a.is_adult AS animeIsAdult,
      COALESCE(ual.score, -1) AS sortScoreValue
    FROM user_anime_lists ual
    INNER JOIN anime a
      ON a.id = ual.anime_id
    LEFT JOIN anime_korean_titles akt
      ON akt.anime_id = a.id
      AND akt.is_primary = TRUE
    WHERE ual.user_id = ?
      ${genreWhereClause}
      ${cursorWhereClause}
    ORDER BY ${orderByClause}
    LIMIT ?
    `,
    queryParams
  );

  const hasNext = rows.length > params.limit;
  const items = hasNext ? rows.slice(0, params.limit) : rows;
  const lastItem = items.length > 0 ? items[items.length - 1] : null;

  const nextCursor = lastItem
    ? encodeCursor({
        sort: params.sort,
        genre: params.genre ?? null,
        score: lastItem.sortScoreValue,
        createdAt: lastItem.createdAt,
        updatedAt: lastItem.updatedAt,
        animeId: lastItem.animeId,
      })
    : null;

  return {
    items: items.map((row) => ({
      id: row.id,
      userId: row.userId,
      animeId: row.animeId,
      status: row.status,
      score: row.score,
      progress: row.progress,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      notes: row.notes,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      anime: {
        id: row.animeId,
        anilistId: row.animeAnilistId,
        title: pickDisplayTitle(row, params.titleLanguage),
        titles: {
          korean: row.animeTitleKorean,
          english: row.animeTitleEnglish,
          native: row.animeTitleNative,
          romaji: row.animeTitleRomaji,
          userPreferred: row.animeTitleUserPreferred,
        },
        episodes: row.animeEpisodes,
        duration: row.animeDuration,
        season: row.animeSeason,
        seasonYear: row.animeSeasonYear,
        format: row.animeFormat,
        status: row.animeStatus,
        averageScore: row.animeAverageScore,
        meanScore: row.animeMeanScore,
        popularity: row.animePopularity,
        favourites: row.animeFavourites,
        coverImageLarge: row.animeCoverImageLarge,
        coverImageExtraLarge: row.animeCoverImageExtraLarge,
        bannerImage: row.animeBannerImage,
        siteUrl: row.animeSiteUrl,
        isAdult: Boolean(row.animeIsAdult),
      },
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

export async function getMyAnimeRelation(
  userId: number,
  animeId: number,
  titleLanguage: UserAnimeListTitleLanguage
) {
  const validatedAnimeId = validateAnimeId(animeId);
  const [rows] = await pool.query<UserAnimeListListRow[]>(
    `
    SELECT
      ual.id,
      ual.user_id AS userId,
      ual.anime_id AS animeId,
      ual.status,
      ual.score,
      ual.progress,
      ual.started_at AS startedAt,
      ual.completed_at AS completedAt,
      ual.notes,
      ual.created_at AS createdAt,
      ual.updated_at AS updatedAt,
      a.anilist_id AS animeAnilistId,
      a.title_romaji AS animeTitleRomaji,
      a.title_english AS animeTitleEnglish,
      a.title_native AS animeTitleNative,
      a.title_user_preferred AS animeTitleUserPreferred,
      akt.full_title AS animeTitleKorean,
      a.episodes AS animeEpisodes,
      a.duration AS animeDuration,
      a.season AS animeSeason,
      a.season_year AS animeSeasonYear,
      a.format AS animeFormat,
      a.status AS animeStatus,
      a.average_score AS animeAverageScore,
      a.mean_score AS animeMeanScore,
      a.popularity AS animePopularity,
      a.favourites AS animeFavourites,
      a.cover_image_large AS animeCoverImageLarge,
      a.cover_image_extra_large AS animeCoverImageExtraLarge,
      a.banner_image AS animeBannerImage,
      a.site_url AS animeSiteUrl,
      a.is_adult AS animeIsAdult,
      COALESCE(ual.score, -1) AS sortScoreValue
    FROM user_anime_lists ual
    INNER JOIN anime a
      ON a.id = ual.anime_id
    LEFT JOIN anime_korean_titles akt
      ON akt.anime_id = a.id
      AND akt.is_primary = TRUE
    WHERE ual.user_id = ?
      AND ual.anime_id = ?
    LIMIT 1
    `,
    [userId, validatedAnimeId]
  );

  const row = rows[0];

  if (!row) {
    throw new Error('User anime list item not found');
  }

  return {
    id: row.id,
    userId: row.userId,
    animeId: row.animeId,
    status: row.status,
    score: row.score,
    progress: row.progress,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    anime: {
      id: row.animeId,
      anilistId: row.animeAnilistId,
      title: pickDisplayTitle(row, titleLanguage),
      titles: {
        korean: row.animeTitleKorean,
        english: row.animeTitleEnglish,
        native: row.animeTitleNative,
        romaji: row.animeTitleRomaji,
        userPreferred: row.animeTitleUserPreferred,
      },
      episodes: row.animeEpisodes,
      duration: row.animeDuration,
      season: row.animeSeason,
      seasonYear: row.animeSeasonYear,
      format: row.animeFormat,
      status: row.animeStatus,
      averageScore: row.animeAverageScore,
      meanScore: row.animeMeanScore,
      popularity: row.animePopularity,
      favourites: row.animeFavourites,
      coverImageLarge: row.animeCoverImageLarge,
      coverImageExtraLarge: row.animeCoverImageExtraLarge,
      bannerImage: row.animeBannerImage,
      siteUrl: row.animeSiteUrl,
      isAdult: Boolean(row.animeIsAdult),
    },
  };
}
export async function addAnimeToUserList(userId: number, animeId: number, input: UserAnimeListInput) {
  const validatedAnimeId = validateAnimeId(animeId);
  const values = buildFullInput(input);

  await ensureAnimeExists(validatedAnimeId);

  try {
    await pool.execute<ResultSetHeader>(
      `
      INSERT INTO user_anime_lists (
        user_id,
        anime_id,
        status,
        score,
        progress,
        started_at,
        completed_at,
        notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        userId,
        validatedAnimeId,
        values.status,
        values.score,
        values.progress,
        values.startedAt,
        values.completedAt,
        values.notes,
      ]
    );
  } catch (error) {
    if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
      throw new Error('Anime is already in the user list');
    }

    throw error;
  }

  const item = await findUserAnimeListItem(userId, validatedAnimeId);

  if (!item) {
    throw new Error('Failed to create user anime list item');
  }

  await recalculateUserAnimeStats(userId);

  return mapUserAnimeListItem(item);
}

export async function updateUserAnimeListItem(userId: number, animeId: number, input: UserAnimeListInput) {
  const validatedAnimeId = validateAnimeId(animeId);
  const changes = buildPartialInput(input);
  const fields: string[] = [];
  const values: Array<string | number | null> = [];

  if (changes.status !== undefined) {
    fields.push('status = ?');
    values.push(changes.status);
  }

  if (changes.score !== undefined) {
    fields.push('score = ?');
    values.push(changes.score);
  }

  if (changes.progress !== undefined) {
    fields.push('progress = ?');
    values.push(changes.progress);
  }

  if (changes.startedAt !== undefined) {
    fields.push('started_at = ?');
    values.push(changes.startedAt);
  }

  if (changes.completedAt !== undefined) {
    fields.push('completed_at = ?');
    values.push(changes.completedAt);
  }

  if (changes.notes !== undefined) {
    fields.push('notes = ?');
    values.push(changes.notes);
  }

  values.push(userId, validatedAnimeId);

  const [result] = await pool.execute<ResultSetHeader>(
    `
    UPDATE user_anime_lists
    SET
      ${fields.join(', ')},
      updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
      AND anime_id = ?
    `,
    values
  );

  if (result.affectedRows === 0) {
    throw new Error('User anime list item not found');
  }

  const item = await findUserAnimeListItem(userId, validatedAnimeId);

  if (!item) {
    throw new Error('User anime list item not found');
  }

  await recalculateUserAnimeStats(userId);

  return mapUserAnimeListItem(item);
}

export async function removeAnimeFromUserList(userId: number, animeId: number) {
  const validatedAnimeId = validateAnimeId(animeId);
  const [result] = await pool.execute<ResultSetHeader>(
    `
    DELETE FROM user_anime_lists
    WHERE user_id = ?
      AND anime_id = ?
    `,
    [userId, validatedAnimeId]
  );

  if (result.affectedRows === 0) {
    throw new Error('User anime list item not found');
  }

  await recalculateUserAnimeStats(userId);
}


