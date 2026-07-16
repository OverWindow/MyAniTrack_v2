import { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/db';

export type AnimeSeriesScope = 'mainline' | 'franchise';
export type UserSeriesCollectionStatus = 'all' | 'started' | 'watched' | 'completed';
export type UserSeriesTitleLanguage = 'ko' | 'en' | 'ja';

export interface UserSeriesStats {
  scope: 'mainline';
  startedSeriesCount: number;
  watchedSeriesCount: number;
  completedSeriesCount: number;
  seriesCompletionRate: number;
}

interface UserSeriesStatsRow extends RowDataPacket {
  startedSeriesCount: number | string;
  watchedSeriesCount: number | string;
  completedSeriesCount: number | string;
  seriesCompletionRate: number | string;
}

interface SeriesSummaryRow extends RowDataPacket {
  seriesId: number;
  scope: AnimeSeriesScope;
  seriesTitle: string | null;
  canonicalAnimeId: number | null;
  memberCount: number | string;
  collectedMemberCount: number | string;
  startedMemberCount: number | string;
  completedMemberCount: number | string;
  lastActivityAt: string;
  canonicalAnilistId: number | null;
  canonicalTitleRomaji: string | null;
  canonicalTitleEnglish: string | null;
  canonicalTitleNative: string | null;
  canonicalTitleUserPreferred: string | null;
  canonicalTitleKorean: string | null;
  coverImageLarge: string | null;
  coverImageExtraLarge: string | null;
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
  season: string | null;
  seasonYear: number | null;
  format: string | null;
  animeStatus: string | null;
  coverImageLarge: string | null;
  coverImageExtraLarge: string | null;
  userListId: number | null;
  userStatus: string | null;
  userScore: number | string | null;
  userProgress: number | null;
  userUpdatedAt: string | null;
}

interface SeriesCursorPayload {
  scope: AnimeSeriesScope;
  status: UserSeriesCollectionStatus;
  query: string | null;
  lastActivityAt: string;
  seriesId: number;
}

export interface GetUserSeriesCollectionParams {
  userId: number;
  scope: AnimeSeriesScope;
  status: UserSeriesCollectionStatus;
  titleLanguage: UserSeriesTitleLanguage;
  query?: string;
  limit: number;
  cursor?: string;
}

function toNumber(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function normalizeQuery(value?: string) {
  const query = value?.trim();
  return query || undefined;
}

function encodeCursor(payload: SeriesCursorPayload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodeCursor(value?: string): SeriesCursorPayload | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as SeriesCursorPayload;
  } catch {
    throw new Error('Invalid cursor');
  }
}

function pickTitle(
  row: {
    titleRomaji: string | null;
    titleEnglish: string | null;
    titleNative: string | null;
    titleUserPreferred: string | null;
    titleKorean: string | null;
  },
  titleLanguage: UserSeriesTitleLanguage
) {
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

export function validateAnimeSeriesScope(value: unknown): AnimeSeriesScope {
  const scope = typeof value === 'string' ? value : 'mainline';

  if (scope !== 'mainline' && scope !== 'franchise') {
    throw new Error('scope must be one of mainline, franchise');
  }

  return scope;
}

export function validateUserSeriesCollectionStatus(value: unknown): UserSeriesCollectionStatus {
  const status = typeof value === 'string' ? value : 'all';

  if (status !== 'all' && status !== 'started' && status !== 'watched' && status !== 'completed') {
    throw new Error('status must be one of all, started, watched, completed');
  }

  return status;
}

export function validateUserSeriesQuery(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new Error('query must be a string');
  }

  const query = value.trim();

  if (query.length > 100) {
    throw new Error('query must be at most 100 characters');
  }

  return query || undefined;
}

export async function getUserSeriesStats(userId: number): Promise<UserSeriesStats> {
  const [rows] = await pool.query<UserSeriesStatsRow[]>(
    `
    SELECT
      COALESCE(SUM(progress.startedMemberCount > 0), 0) AS startedSeriesCount,
      COALESCE(SUM(progress.completedMemberCount > 0), 0) AS watchedSeriesCount,
      COALESCE(SUM(progress.completedMemberCount = progress.memberCount), 0) AS completedSeriesCount,
      COALESCE(
        ROUND(
          SUM(progress.completedMemberCount = progress.memberCount) * 100.0
          / NULLIF(SUM(progress.completedMemberCount > 0), 0),
          2
        ),
        0
      ) AS seriesCompletionRate
    FROM (
      SELECT
        seriesRow.id AS seriesId,
        COUNT(memberRow.anime_id) AS memberCount,
        COALESCE(SUM(ual.status IS NOT NULL AND ual.status <> 'planned'), 0) AS startedMemberCount,
        COALESCE(SUM(ual.status = 'completed'), 0) AS completedMemberCount
      FROM anime_series seriesRow
      INNER JOIN anime_series_members memberRow
        ON memberRow.series_id = seriesRow.id
      LEFT JOIN user_anime_lists ual
        ON ual.anime_id = memberRow.anime_id
        AND ual.user_id = ?
      WHERE seriesRow.scope = 'mainline'
      GROUP BY seriesRow.id
    ) progress
    `,
    [userId]
  );
  const row = rows[0];

  return {
    scope: 'mainline',
    startedSeriesCount: toNumber(row?.startedSeriesCount),
    watchedSeriesCount: toNumber(row?.watchedSeriesCount),
    completedSeriesCount: toNumber(row?.completedSeriesCount),
    seriesCompletionRate: toNumber(row?.seriesCompletionRate),
  };
}

export async function getUserSeriesCollection(params: GetUserSeriesCollectionParams) {
  const normalizedQuery = normalizeQuery(params.query);
  const cursor = decodeCursor(params.cursor);

  if (cursor && cursor.scope !== params.scope) {
    throw new Error('Cursor scope does not match requested scope');
  }

  if (cursor && cursor.status !== params.status) {
    throw new Error('Cursor status does not match requested status');
  }

  if (cursor && cursor.query !== (normalizedQuery ?? null)) {
    throw new Error('Cursor query does not match requested query');
  }

  const queryParams: Array<string | number | Date> = [params.userId, params.scope, params.userId];
  let searchWhere = '';

  if (normalizedQuery) {
    const keyword = `%${normalizedQuery}%`;
    searchWhere = `
      AND (
        seriesRow.title LIKE ?
        OR EXISTS (
          SELECT 1
          FROM anime_series_members searchMember
          INNER JOIN anime searchAnime
            ON searchAnime.id = searchMember.anime_id
          LEFT JOIN anime_korean_titles searchKoreanTitle
            ON searchKoreanTitle.anime_id = searchAnime.id
          WHERE searchMember.series_id = seriesRow.id
            AND (
              searchAnime.title_romaji LIKE ?
              OR searchAnime.title_english LIKE ?
              OR searchAnime.title_native LIKE ?
              OR searchAnime.title_user_preferred LIKE ?
              OR searchKoreanTitle.full_title LIKE ?
            )
        )
      )
    `;
    queryParams.push(keyword, keyword, keyword, keyword, keyword, keyword);
  }

  let statusHaving = '';

  if (params.status === 'started') {
    statusHaving = 'AND startedMemberCount > 0';
  } else if (params.status === 'watched') {
    statusHaving = 'AND completedMemberCount > 0';
  } else if (params.status === 'completed') {
    statusHaving = 'AND completedMemberCount = memberCount';
  }

  let cursorHaving = '';

  if (cursor) {
    const cursorDate = new Date(cursor.lastActivityAt);

    if (Number.isNaN(cursorDate.getTime())) {
      throw new Error('Invalid cursor');
    }

    cursorHaving = `
      AND (
        lastActivityAt < ?
        OR (lastActivityAt = ? AND seriesRow.id < ?)
      )
    `;
    queryParams.push(cursorDate, cursorDate, cursor.seriesId);
  }

  queryParams.push(params.limit + 1);

  const [summaryRows] = await pool.query<SeriesSummaryRow[]>(
    `
    SELECT
      seriesRow.id AS seriesId,
      seriesRow.scope,
      seriesRow.title AS seriesTitle,
      seriesRow.canonical_anime_id AS canonicalAnimeId,
      COUNT(memberRow.anime_id) AS memberCount,
      COALESCE(SUM(ual.id IS NOT NULL), 0) AS collectedMemberCount,
      COALESCE(SUM(ual.status IS NOT NULL AND ual.status <> 'planned'), 0) AS startedMemberCount,
      COALESCE(SUM(ual.status = 'completed'), 0) AS completedMemberCount,
      MAX(ual.updated_at) AS lastActivityAt,
      canonicalAnime.anilist_id AS canonicalAnilistId,
      canonicalAnime.title_romaji AS canonicalTitleRomaji,
      canonicalAnime.title_english AS canonicalTitleEnglish,
      canonicalAnime.title_native AS canonicalTitleNative,
      canonicalAnime.title_user_preferred AS canonicalTitleUserPreferred,
      canonicalKoreanTitle.full_title AS canonicalTitleKorean,
      canonicalAnime.cover_image_large AS coverImageLarge,
      canonicalAnime.cover_image_extra_large AS coverImageExtraLarge
    FROM anime_series seriesRow
    INNER JOIN anime_series_members memberRow
      ON memberRow.series_id = seriesRow.id
    LEFT JOIN user_anime_lists ual
      ON ual.anime_id = memberRow.anime_id
      AND ual.user_id = ?
    LEFT JOIN anime canonicalAnime
      ON canonicalAnime.id = seriesRow.canonical_anime_id
    LEFT JOIN anime_korean_titles canonicalKoreanTitle
      ON canonicalKoreanTitle.anime_id = canonicalAnime.id
      AND canonicalKoreanTitle.is_primary = TRUE
    WHERE seriesRow.scope = ?
      AND EXISTS (
        SELECT 1
        FROM anime_series_members ownedMember
        INNER JOIN user_anime_lists ownedList
          ON ownedList.anime_id = ownedMember.anime_id
          AND ownedList.user_id = ?
        WHERE ownedMember.series_id = seriesRow.id
      )
      ${searchWhere}
    GROUP BY
      seriesRow.id,
      seriesRow.scope,
      seriesRow.title,
      seriesRow.canonical_anime_id,
      canonicalAnime.anilist_id,
      canonicalAnime.title_romaji,
      canonicalAnime.title_english,
      canonicalAnime.title_native,
      canonicalAnime.title_user_preferred,
      canonicalKoreanTitle.full_title,
      canonicalAnime.cover_image_large,
      canonicalAnime.cover_image_extra_large
    HAVING 1 = 1
      ${statusHaving}
      ${cursorHaving}
    ORDER BY lastActivityAt DESC, seriesRow.id DESC
    LIMIT ?
    `,
    queryParams
  );

  const hasNext = summaryRows.length > params.limit;
  const pageRows = hasNext ? summaryRows.slice(0, params.limit) : summaryRows;
  const seriesIds = pageRows.map((row) => row.seriesId);
  let memberRows: SeriesMemberRow[] = [];

  if (seriesIds.length > 0) {
    const [rows] = await pool.query<SeriesMemberRow[]>(
      `
      SELECT
        memberRow.series_id AS seriesId,
        animeRow.id AS animeId,
        animeRow.anilist_id AS anilistId,
        animeRow.title_romaji AS titleRomaji,
        animeRow.title_english AS titleEnglish,
        animeRow.title_native AS titleNative,
        animeRow.title_user_preferred AS titleUserPreferred,
        koreanTitle.full_title AS titleKorean,
        animeRow.season,
        animeRow.season_year AS seasonYear,
        animeRow.format,
        animeRow.status AS animeStatus,
        animeRow.cover_image_large AS coverImageLarge,
        animeRow.cover_image_extra_large AS coverImageExtraLarge,
        ual.id AS userListId,
        ual.status AS userStatus,
        ual.score AS userScore,
        ual.progress AS userProgress,
        ual.updated_at AS userUpdatedAt
      FROM anime_series_members memberRow
      INNER JOIN anime animeRow
        ON animeRow.id = memberRow.anime_id
      LEFT JOIN anime_korean_titles koreanTitle
        ON koreanTitle.anime_id = animeRow.id
        AND koreanTitle.is_primary = TRUE
      LEFT JOIN user_anime_lists ual
        ON ual.anime_id = animeRow.id
        AND ual.user_id = ?
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
        animeRow.id ASC
      `,
      [params.userId, seriesIds]
    );
    memberRows = rows;
  }

  const membersBySeriesId = new Map<number, SeriesMemberRow[]>();

  for (const row of memberRows) {
    const members = membersBySeriesId.get(row.seriesId) ?? [];
    members.push(row);
    membersBySeriesId.set(row.seriesId, members);
  }

  const items = pageRows.map((row) => {
    const memberCount = toNumber(row.memberCount);
    const completedMemberCount = toNumber(row.completedMemberCount);
    const canonicalTitle = pickTitle({
      titleRomaji: row.canonicalTitleRomaji,
      titleEnglish: row.canonicalTitleEnglish,
      titleNative: row.canonicalTitleNative,
      titleUserPreferred: row.canonicalTitleUserPreferred,
      titleKorean: row.canonicalTitleKorean,
    }, params.titleLanguage);

    return {
      seriesId: row.seriesId,
      scope: row.scope,
      title: row.seriesTitle ?? canonicalTitle,
      customTitle: row.seriesTitle,
      canonicalAnimeId: row.canonicalAnimeId,
      memberCount,
      collectedMemberCount: toNumber(row.collectedMemberCount),
      startedMemberCount: toNumber(row.startedMemberCount),
      completedMemberCount,
      completionRate: memberCount > 0
        ? Number(((completedMemberCount / memberCount) * 100).toFixed(2))
        : 0,
      completed: memberCount > 0 && completedMemberCount === memberCount,
      lastActivityAt: row.lastActivityAt,
      coverImageLarge: row.coverImageLarge,
      coverImageExtraLarge: row.coverImageExtraLarge,
      items: (membersBySeriesId.get(row.seriesId) ?? []).map((member) => ({
        anime: {
          id: member.animeId,
          anilistId: member.anilistId,
          title: pickTitle(member, params.titleLanguage),
          titles: {
            korean: member.titleKorean,
            english: member.titleEnglish,
            native: member.titleNative,
            romaji: member.titleRomaji,
            userPreferred: member.titleUserPreferred,
          },
          season: member.season,
          seasonYear: member.seasonYear,
          format: member.format,
          status: member.animeStatus,
          coverImageLarge: member.coverImageLarge,
          coverImageExtraLarge: member.coverImageExtraLarge,
        },
        userList: member.userListId === null
          ? null
          : {
            id: member.userListId,
            status: member.userStatus,
            score: member.userScore === null ? null : Number(member.userScore),
            progress: member.userProgress,
            updatedAt: member.userUpdatedAt,
          },
      })),
    };
  });
  const lastRow = pageRows[pageRows.length - 1];

  return {
    items,
    pageInfo: {
      hasNext,
      nextCursor: hasNext && lastRow
        ? encodeCursor({
          scope: params.scope,
          status: params.status,
          query: normalizedQuery ?? null,
          lastActivityAt: lastRow.lastActivityAt,
          seriesId: lastRow.seriesId,
        })
        : null,
      limit: params.limit,
      scope: params.scope,
      status: params.status,
      titleLanguage: params.titleLanguage,
      query: normalizedQuery ?? null,
    },
  };
}
