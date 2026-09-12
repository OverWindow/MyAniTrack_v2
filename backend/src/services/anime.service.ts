import { pool } from '../../config/db';
import { RowDataPacket } from 'mysql2/promise';

export type AnimeSortOption = 'latest' | 'score' | 'season' | 'popularity';
export type AnimeTitleLanguage = 'ko' | 'en' | 'ja';
export type AnimeCharacterRole = 'MAIN' | 'SUPPORT' | 'BACKGROUND';
export type AnimeRelationType =
  | 'ADAPTATION'
  | 'PREQUEL'
  | 'SEQUEL'
  | 'PARENT'
  | 'SIDE_STORY'
  | 'CHARACTER'
  | 'SUMMARY'
  | 'ALTERNATIVE'
  | 'SPIN_OFF'
  | 'OTHER'
  | 'SOURCE'
  | 'COMPILATION'
  | 'CONTAINS';
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
  | 'Hentai';

const SCORE_SORT_SQL = 'COALESCE(acm.community_average_score, -1)';
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
  genre?: AnimeGenre | null;
  createdAt?: string;
  score?: number | null;
  ratingCount?: number | null;
  seasonYear?: number | null;
  seasonRank?: number | null;
  popularity?: number | null;
  id: number;
}

export interface AnimeListParams {
  sort: AnimeSortOption;
  titleLanguage: AnimeTitleLanguage;
  query?: string;
  genre?: AnimeGenre;
  cursor?: string;
  limit: number;
}

interface AnimeListRow extends RowDataPacket {
  id: number;
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
  communityAverageScore: number | null;
  ratingCount: number;
  collectionCount: number;
  coverImageLarge: string | null;
  coverImageExtraLarge: string | null;
  bannerImage: string | null;
  officialSiteUrl: string | null;
  isAdult: number | boolean;
  createdAt: string;
  scoreSortValue: number | null;
  seasonRankValue: number | null;
}

interface AnimeDetailRow extends RowDataPacket {
  id: number;
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
  communityAverageScore: number | null;
  ratingCount: number;
  collectionCount: number;
  coverImageLarge: string | null;
  coverImageExtraLarge: string | null;
  bannerImage: string | null;
  officialSiteUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AnimeRelationRow extends RowDataPacket {
  sourceAnimeId: number;
  relationType: AnimeRelationType;
  targetAnimeId: number;
  titleRomaji: string | null;
  titleEnglish: string | null;
  titleNative: string | null;
  titleUserPreferred: string | null;
  titleKorean: string | null;
  format: string | null;
  status: string | null;
  season: string | null;
  seasonYear: number | null;
  coverImageLarge: string | null;
  coverImageExtraLarge: string | null;
  isAdult: number | boolean | null;
}

interface UserAnimeRelationRow extends RowDataPacket {
  animeId: number;
  status: string;
  score: number | null;
  progress: number;
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

interface AnimeStudioRow extends RowDataPacket {
  id: number;
  name: string;
  isMain: number | boolean;
  officialSiteUrl: string | null;
}

interface IdRow extends RowDataPacket {
  id: number;
}

interface AnimeCastRow extends RowDataPacket {
  characterId: number;
  characterNameFull: string | null;
  characterNameNative: string | null;
  characterNameUserPreferred: string | null;
  characterImageLarge: string | null;
  characterImageMedium: string | null;
  characterGender: string | null;
  characterAge: string | null;
  characterDescription: string | null;
  characterOfficialSiteUrl: string | null;
  role: string | null;
  edgeName: string | null;
  characterSortOrder: number | null;
  voiceActorId: number;
  voiceActorNameFull: string | null;
  voiceActorNameNative: string | null;
  voiceActorNameUserPreferred: string | null;
  voiceActorLanguageV2: string | null;
  voiceActorImageLarge: string | null;
  voiceActorImageMedium: string | null;
  voiceActorDescription: string | null;
  voiceActorOfficialSiteUrl: string | null;
  voiceActorSortOrder: number | null;
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

function toStoredCharacterRole(role: AnimeCharacterRole) {
  if (role === 'SUPPORT') {
    return 'SUPPORTING';
  }

  return role;
}

function buildListOrderClause(sort: AnimeSortOption): string {
  if (sort === 'score') {
    return `${SCORE_SORT_SQL} DESC, COALESCE(acm.rating_count, 0) DESC, a.id DESC`;
  }

  if (sort === 'popularity') {
    return 'COALESCE(acm.collection_count, -1) DESC, a.id DESC';
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
    params.push(cursor.score ?? -1, cursor.score ?? -1, cursor.ratingCount ?? 0,
      cursor.score ?? -1, cursor.ratingCount ?? 0, cursor.id);
    return `
      AND (
        ${SCORE_SORT_SQL} < ?
        OR (${SCORE_SORT_SQL} = ? AND COALESCE(acm.rating_count, 0) < ?)
        OR (${SCORE_SORT_SQL} = ? AND COALESCE(acm.rating_count, 0) = ? AND a.id < ?)
      )
    `;
  }

  if (sort === 'popularity') {
    params.push(cursor.popularity ?? -1, cursor.popularity ?? -1, cursor.id);
    return `
      AND (
        COALESCE(acm.collection_count, -1) < ?
        OR (COALESCE(acm.collection_count, -1) = ? AND a.id < ?)
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

function buildGenreWhereClause(
  genre: AnimeGenre | undefined,
  cursor: AnimeListCursorPayload | null,
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
  const genreWhereClause = buildGenreWhereClause(params.genre, decodedCursor, queryParams);
  const searchWhereClause = buildSearchWhereClause(params.titleLanguage, params.query, decodedCursor, queryParams);
  const cursorWhereClause = buildCursorWhereClause(params.sort, decodedCursor, queryParams);
  const orderByClause = buildListOrderClause(params.sort);

  queryParams.push(params.limit + 1);

  const [rows] = await pool.query<AnimeListRow[]>(
    `
    SELECT
      a.id,
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
      acm.community_average_score AS communityAverageScore,
      COALESCE(acm.rating_count, 0) AS ratingCount,
      COALESCE(acm.collection_count, 0) AS collectionCount,
      a.cover_image_large AS coverImageLarge,
      a.cover_image_extra_large AS coverImageExtraLarge,
      a.banner_image AS bannerImage,
      a.official_site_url AS officialSiteUrl,
      a.is_adult AS isAdult,
      a.created_at AS createdAt,
      ${SCORE_SORT_SQL} AS scoreSortValue,
      ${SEASON_RANK_SQL} AS seasonRankValue
    FROM anime a
    LEFT JOIN anime_community_metrics acm ON acm.anime_id = a.id
    LEFT JOIN anime_korean_titles akt
      ON akt.anime_id = a.id
      AND akt.is_primary = TRUE
    WHERE 1 = 1
      AND a.is_adult = FALSE
      AND a.app_visible = TRUE
      ${genreWhereClause}
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
        genre: params.genre ?? null,
        createdAt: lastItem.createdAt,
        score: lastItem.scoreSortValue,
        ratingCount: lastItem.ratingCount,
        seasonYear: lastItem.seasonYear,
        seasonRank: lastItem.seasonRankValue,
        popularity: lastItem.collectionCount,
        id: lastItem.id,
      })
    : null;

  return {
    items: items.map((row) => ({
      id: row.id,
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
      communityAverageScore: row.communityAverageScore === null ? null : Number(row.communityAverageScore),
      ratingCount: Number(row.ratingCount),
      collectionCount: Number(row.collectionCount),
      coverImageLarge: row.coverImageLarge,
      coverImageExtraLarge: row.coverImageExtraLarge,
      bannerImage: row.bannerImage,
      officialSiteUrl: row.officialSiteUrl,
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

export async function getAnimeListWithUserCollection(userId: number, params: AnimeListParams) {
  const result = await getAnimeList(params);
  const animeIds = result.items.map((item) => item.id);

  if (animeIds.length === 0) {
    return {
      ...result,
      items: result.items.map((item) => ({
        ...item,
        myCollection: {
          exists: false,
          status: null,
          score: null,
          progress: null,
        },
      })),
    };
  }

  const [rows] = await pool.query<UserAnimeRelationRow[]>(
    `
    SELECT
      anime_id AS animeId,
      status,
      score,
      progress
    FROM user_anime_lists
    WHERE user_id = ?
      AND anime_id IN (?)
    `,
    [userId, animeIds]
  );
  const relationMap = new Map(rows.map((row) => [row.animeId, row]));

  return {
    ...result,
    items: result.items.map((item) => {
      const relation = relationMap.get(item.id);

      return {
        ...item,
        myCollection: {
          exists: Boolean(relation),
          status: relation?.status ?? null,
          score: relation?.score ?? null,
          progress: relation?.progress ?? null,
        },
      };
    }),
  };
}

export async function getAnimeDetailById(id: number, titleLanguage: AnimeTitleLanguage) {
  const [animeRows] = await pool.query<AnimeDetailRow[]>(
    `
    SELECT
      a.id,
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
      acm.community_average_score AS communityAverageScore,
      COALESCE(acm.rating_count, 0) AS ratingCount,
      COALESCE(acm.collection_count, 0) AS collectionCount,
      a.cover_image_large AS coverImageLarge,
      a.cover_image_extra_large AS coverImageExtraLarge,
      a.banner_image AS bannerImage,
      a.official_site_url AS officialSiteUrl,
      a.created_at AS createdAt,
      a.updated_at AS updatedAt
    FROM anime a
    LEFT JOIN anime_community_metrics acm ON acm.anime_id = a.id
    WHERE a.id = ?
      AND a.is_adult = FALSE
      AND a.app_visible = TRUE
    LIMIT 1
    `,
    [id]
  );

  const anime = animeRows[0];

  if (!anime) {
    return null;
  }

  const [koreanTitleRows, genreRows, tagRows, synonymRows, studioRows] = await Promise.all([
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
    pool.query<AnimeStudioRow[]>(
      `
      SELECT s.id, s.name, ans.is_main AS isMain, s.official_site_url AS officialSiteUrl
      FROM anime_studios ans
      JOIN studios s ON s.id = ans.studio_id
      WHERE ans.anime_id = ?
      ORDER BY ans.is_main DESC, s.name ASC, s.id ASC
      `,
      [id]
    ),
  ]);

  const koreanTitles = koreanTitleRows[0];
  const primaryKoreanTitle = koreanTitles.find((row) => normalizeBoolean(row.isPrimary))?.fullTitle ?? null;

  return {
    id: anime.id,
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
    communityAverageScore: anime.communityAverageScore === null ? null : Number(anime.communityAverageScore),
    ratingCount: Number(anime.ratingCount),
    collectionCount: Number(anime.collectionCount),
    coverImageLarge: anime.coverImageLarge,
    coverImageExtraLarge: anime.coverImageExtraLarge,
    bannerImage: anime.bannerImage,
    officialSiteUrl: anime.officialSiteUrl,
    createdAt: anime.createdAt,
    updatedAt: anime.updatedAt,
    genres: genreRows[0].map((row) => row.genre),
    tags: tagRows[0].map((row) => ({
      name: row.tagName,
      rank: row.rankValue,
      isSpoiler: normalizeBoolean(row.isSpoiler),
    })),
    synonyms: synonymRows[0].map((row) => row.synonym),
    studios: studioRows[0].map((row) => ({
      id: row.id,
      name: row.name,
      isMain: normalizeBoolean(row.isMain),
      officialSiteUrl: row.officialSiteUrl,
    })),
  };
}

function pickRelationTitle(row: AnimeRelationRow, titleLanguage: AnimeTitleLanguage) {
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

function mapAnimeRelation(row: AnimeRelationRow, titleLanguage: AnimeTitleLanguage) {
  return {
    relationType: row.relationType,
    targetAnimeId: row.targetAnimeId,
    anime: {
        id: row.targetAnimeId,
        title: pickRelationTitle(row, titleLanguage),
        titles: {
          korean: row.titleKorean,
          english: row.titleEnglish,
          native: row.titleNative,
          romaji: row.titleRomaji,
          userPreferred: row.titleUserPreferred,
        },
        format: row.format,
        status: row.status,
        season: row.season,
        seasonYear: row.seasonYear,
        coverImageLarge: row.coverImageLarge,
        coverImageExtraLarge: row.coverImageExtraLarge,
        isAdult: Boolean(row.isAdult),
      },
  };
}

async function findAnimeRelations(
  animeIds: number[],
  relationType?: AnimeRelationType
) {
  if (animeIds.length === 0) {
    return [];
  }

  const queryParams: Array<number[] | string> = [animeIds];
  const relationTypeWhere = relationType
    ? 'AND ar.relation_type = ?'
    : '';

  if (relationType) {
    queryParams.push(relationType);
  }

  const [rows] = await pool.query<AnimeRelationRow[]>(
    `
    SELECT
      ar.source_anime_id AS sourceAnimeId,
      ar.relation_type AS relationType,
      ar.target_anime_id AS targetAnimeId,
      target.title_romaji AS titleRomaji,
      target.title_english AS titleEnglish,
      target.title_native AS titleNative,
      target.title_user_preferred AS titleUserPreferred,
      akt.full_title AS titleKorean,
      target.format,
      target.status,
      target.season,
      target.season_year AS seasonYear,
      target.cover_image_large AS coverImageLarge,
      target.cover_image_extra_large AS coverImageExtraLarge,
      target.is_adult AS isAdult
    FROM anime_relations ar
    INNER JOIN anime target
      ON target.id = ar.target_anime_id
      AND target.is_adult = FALSE
      AND target.app_visible = TRUE
    LEFT JOIN anime_korean_titles akt
      ON akt.anime_id = target.id
      AND akt.is_primary = TRUE
    WHERE ar.source_anime_id IN (?)
      ${relationTypeWhere}
    ORDER BY
      ar.source_anime_id ASC,
      CASE ar.relation_type
        WHEN 'PREQUEL' THEN 1
        WHEN 'SEQUEL' THEN 2
        WHEN 'PARENT' THEN 3
        WHEN 'SIDE_STORY' THEN 4
        WHEN 'SPIN_OFF' THEN 5
        WHEN 'ALTERNATIVE' THEN 6
        WHEN 'SUMMARY' THEN 7
        ELSE 8
      END,
      target.season_year ASC,
      ar.target_anime_id ASC
    `,
    queryParams
  );

  return rows;
}

export async function getAnimeRelations(params: {
  animeId: number;
  titleLanguage: AnimeTitleLanguage;
  relationType?: AnimeRelationType;
}) {
  const [animeRows] = await pool.query<IdRow[]>(
    'SELECT id FROM anime WHERE id = ? AND is_adult = FALSE AND app_visible = TRUE LIMIT 1',
    [params.animeId]
  );

  if (!animeRows[0]) {
    throw new Error('Anime not found');
  }

  const relationRows = await findAnimeRelations([params.animeId], params.relationType);

  return {
    items: relationRows.map((row) => mapAnimeRelation(row, params.titleLanguage)),
    relationType: params.relationType ?? null,
  };
}

export async function searchAnimeWithRelations(
  params: AnimeListParams & { relationType?: AnimeRelationType }
) {
  const result = await getAnimeList(params);
  const animeIds = result.items.map((item) => item.id);
  const relationRows = await findAnimeRelations(animeIds, params.relationType);
  const relationsByAnimeId = new Map<number, ReturnType<typeof mapAnimeRelation>[]>();

  for (const row of relationRows) {
    const relations = relationsByAnimeId.get(row.sourceAnimeId) ?? [];
    relations.push(mapAnimeRelation(row, params.titleLanguage));
    relationsByAnimeId.set(row.sourceAnimeId, relations);
  }

  return {
    items: result.items.map((item) => ({
      ...item,
      relations: relationsByAnimeId.get(item.id) ?? [],
    })),
    pageInfo: result.pageInfo,
    relationType: params.relationType ?? null,
  };
}

export async function getAnimeCastByRole(params: {
  animeId: number;
  role: AnimeCharacterRole;
  limit: number;
  voiceLanguage?: string;
}) {
  const { animeId, role, limit, voiceLanguage } = params;

  if (!Number.isInteger(animeId) || animeId <= 0) {
    throw new Error('anime id must be a positive integer');
  }

  const [animeRows] = await pool.query<IdRow[]>(
    `
    SELECT id
    FROM anime
    WHERE id = ?
      AND is_adult = FALSE
      AND app_visible = TRUE
    LIMIT 1
    `,
    [animeId]
  );

  if (!animeRows[0]) {
    throw new Error('Anime not found');
  }

  const storedRole = toStoredCharacterRole(role);
  const queryParams: Array<string | number> = [];
  const voiceLanguageWhere = voiceLanguage
    ? 'AND acva.language_v2 = ?'
    : '';

  if (voiceLanguage) {
    queryParams.push(voiceLanguage);
  }

  queryParams.push(animeId, storedRole, limit);

  const [rows] = await pool.query<AnimeCastRow[]>(
    `
    SELECT
      c.id AS characterId,
      c.name_full AS characterNameFull,
      c.name_native AS characterNameNative,
      c.name_user_preferred AS characterNameUserPreferred,
      c.image_large AS characterImageLarge,
      c.image_medium AS characterImageMedium,
      c.gender AS characterGender,
      c.age AS characterAge,
      c.description AS characterDescription,
      c.official_site_url AS characterOfficialSiteUrl,
      ac.role,
      ac.edge_name AS edgeName,
      ac.sort_order AS characterSortOrder,
      va.id AS voiceActorId,
      va.name_full AS voiceActorNameFull,
      va.name_native AS voiceActorNameNative,
      va.name_user_preferred AS voiceActorNameUserPreferred,
      va.language_v2 AS voiceActorLanguageV2,
      va.image_large AS voiceActorImageLarge,
      va.image_medium AS voiceActorImageMedium,
      va.description AS voiceActorDescription,
      va.official_site_url AS voiceActorOfficialSiteUrl,
      acva.sort_order AS voiceActorSortOrder
    FROM anime_characters ac
    INNER JOIN characters c
      ON c.id = ac.character_id
    INNER JOIN anime_character_voice_actors acva
      ON acva.anime_id = ac.anime_id
      AND acva.character_id = ac.character_id
      ${voiceLanguageWhere}
    INNER JOIN voice_actors va
      ON va.id = acva.voice_actor_id
    WHERE ac.anime_id = ?
      AND ac.role = ?
    ORDER BY
      COALESCE(ac.sort_order, 999999) ASC,
      c.id ASC,
      COALESCE(acva.sort_order, 999999) ASC,
      va.id ASC
    LIMIT ?
    `,
    queryParams
  );

  const characterMap = new Map<number, {
    id: number;
    role: string | null;
    requestedRole: AnimeCharacterRole;
    edgeName: string | null;
    sortOrder: number | null;
    name: {
      full: string | null;
      native: string | null;
      userPreferred: string | null;
    };
    image: {
      large: string | null;
      medium: string | null;
    };
    gender: string | null;
    age: string | null;
    description: string | null;
    officialSiteUrl: string | null;
    voiceActors: Array<{
      id: number;
      languageV2: string | null;
      sortOrder: number | null;
      name: {
        full: string | null;
        native: string | null;
        userPreferred: string | null;
      };
      image: {
        large: string | null;
        medium: string | null;
      };
      description: string | null;
      officialSiteUrl: string | null;
    }>;
  }>();

  for (const row of rows) {
    const existingCharacter = characterMap.get(row.characterId);
    const character = existingCharacter ?? {
      id: row.characterId,
      role: row.role,
      requestedRole: role,
      edgeName: row.edgeName,
      sortOrder: row.characterSortOrder,
      name: {
        full: row.characterNameFull,
        native: row.characterNameNative,
        userPreferred: row.characterNameUserPreferred,
      },
      image: {
        large: row.characterImageLarge,
        medium: row.characterImageMedium,
      },
      gender: row.characterGender,
      age: row.characterAge,
      description: row.characterDescription,
      officialSiteUrl: row.characterOfficialSiteUrl,
      voiceActors: [],
    };

    character.voiceActors.push({
      id: row.voiceActorId,
      languageV2: row.voiceActorLanguageV2,
      sortOrder: row.voiceActorSortOrder,
      name: {
        full: row.voiceActorNameFull,
        native: row.voiceActorNameNative,
        userPreferred: row.voiceActorNameUserPreferred,
      },
      image: {
        large: row.voiceActorImageLarge,
        medium: row.voiceActorImageMedium,
      },
      description: row.voiceActorDescription,
      officialSiteUrl: row.voiceActorOfficialSiteUrl,
    });

    if (!existingCharacter) {
      characterMap.set(row.characterId, character);
    }
  }

  return {
    animeId,
    role,
    storedRole,
    voiceLanguage: voiceLanguage ?? null,
    requiresImages: false,
    items: Array.from(characterMap.values()),
  };
}
