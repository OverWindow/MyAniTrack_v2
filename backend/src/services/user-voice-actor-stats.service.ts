import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/db';
import { AnimeTitleLanguage } from './anime.service';

export type VoiceActorRankingSort = 'count' | 'score' | 'watchTime';

interface VoiceActorStatsRow extends RowDataPacket {
  voiceActorId: number;
  anilistId: number;
  nameFull: string | null;
  nameNative: string | null;
  nameUserPreferred: string | null;
  imageLarge: string | null;
  imageMedium: string | null;
  languageV2: string | null;
  animeCount: number;
  characterCount: number;
  ratedAnimeCount: number;
  scoreSum: string | number | null;
  averageScore: string | number | null;
  totalWatchMinutes: string | number | null;
  statsVersion: number;
  lastCalculatedAt: string | null;
}

interface AnalysisStateRow extends RowDataPacket {
  userId: number;
  voiceActorStatsDirty: number | boolean;
  voiceActorStatsVersion: number;
  voiceActorStatsCalculatedAt: string | null;
}

interface VoiceActorRow extends RowDataPacket {
  id: number;
  anilistId: number;
  nameFull: string | null;
  nameNative: string | null;
  nameUserPreferred: string | null;
  languageV2: string | null;
  imageLarge: string | null;
  imageMedium: string | null;
  description: string | null;
  siteUrl: string | null;
}

interface VoiceActorAnimeRow extends RowDataPacket {
  animeId: number;
  animeAnilistId: number;
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
  averageScore: number | null;
  episodes: number | null;
  duration: number | null;
  userStatus: string;
  userScore: number | null;
  userProgress: number;
  listUpdatedAt: string;
}

interface VoiceActorCharacterRow extends RowDataPacket {
  animeId: number;
  characterId: number;
  characterAnilistId: number;
  role: string | null;
  nameFull: string | null;
  nameNative: string | null;
  nameUserPreferred: string | null;
  imageLarge: string | null;
  imageMedium: string | null;
  sortOrder: number | null;
}

interface IdRow extends RowDataPacket {
  id: number;
}

interface LockRow extends RowDataPacket {
  acquired: number;
}

interface RecalculatedVoiceActorStatsRow extends RowDataPacket {
  voiceActorId: number;
  animeCount: number;
  characterCount: number;
  ratedAnimeCount: number;
  scoreSum: string | number | null;
  averageScore: string | number | null;
}

interface RankingCursorPayload {
  sort: VoiceActorRankingSort;
  minAnimeCount: number;
  minRatedAnimeCount: number;
  animeCount?: number;
  ratedAnimeCount?: number;
  averageScore?: number | null;
  totalWatchMinutes?: number;
  voiceActorId: number;
}

interface AnimeCursorPayload {
  voiceActorId: number;
  animeId: number;
  status?: 'all' | 'completed';
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

  return Number(value);
}

function isRetryableDbLockError(error: unknown) {
  const dbError = error as { code?: string; errno?: number };

  return dbError.code === 'ER_LOCK_DEADLOCK'
    || dbError.code === 'ER_LOCK_WAIT_TIMEOUT'
    || dbError.errno === 1213
    || dbError.errno === 1205;
}

async function retryOnDbLock<T>(operation: () => Promise<T>, maxAttempts = 3) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isRetryableDbLockError(error) || attempt === maxAttempts) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
    }
  }

  throw lastError;
}

function normalizeLimit(value: unknown) {
  const limit = Number(value ?? 20);

  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new Error('limit must be an integer between 1 and 50');
  }

  return limit;
}

export function validateVoiceActorRankingSort(value: unknown): VoiceActorRankingSort {
  const sort = typeof value === 'string' ? value : 'count';

  if (sort !== 'count' && sort !== 'score' && sort !== 'watchTime') {
    throw new Error('sort must be one of count, score, watchTime');
  }

  return sort;
}

export function validateVoiceActorStatsLimit(value: unknown) {
  return normalizeLimit(value);
}

export function validateMinimumCount(value: unknown, fieldName: string) {
  const count = Number(value ?? 1);

  if (!Number.isInteger(count) || count < 1 || count > 100) {
    throw new Error(`${fieldName} must be an integer between 1 and 100`);
  }

  return count;
}

export function validateVoiceActorId(value: unknown) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('voiceActorId must be a positive integer');
  }

  return id;
}

function pickTitle(row: VoiceActorAnimeRow, titleLanguage: AnimeTitleLanguage) {
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

async function ensureAnalysisState(userId: number) {
  await pool.execute(
    `
    INSERT INTO user_analysis_state (user_id)
    VALUES (?)
    ON DUPLICATE KEY UPDATE user_id = user_id
    `,
    [userId]
  );
}

async function getAnalysisState(userId: number) {
  await ensureAnalysisState(userId);

  const [rows] = await pool.query<AnalysisStateRow[]>(
    `
    SELECT
      user_id AS userId,
      voice_actor_stats_dirty AS voiceActorStatsDirty,
      voice_actor_stats_version AS voiceActorStatsVersion,
      voice_actor_stats_calculated_at AS voiceActorStatsCalculatedAt
    FROM user_analysis_state
    WHERE user_id = ?
    LIMIT 1
    `,
    [userId]
  );

  return rows[0];
}

export async function markUserVoiceActorStatsDirty(userId: number) {
  await pool.execute(
    `
    INSERT INTO user_analysis_state (
      user_id,
      voice_actor_stats_dirty,
      voice_actor_stats_version
    )
    VALUES (?, TRUE, 1)
    ON DUPLICATE KEY UPDATE
      voice_actor_stats_dirty = TRUE,
      voice_actor_stats_version = voice_actor_stats_version + 1,
      updated_at = CURRENT_TIMESTAMP
    `,
    [userId]
  );
}

export async function recalculateUserVoiceActorStats(userId: number) {
  await ensureAnalysisState(userId);

  const conn = await pool.getConnection();
  const lockName = `voice_actor_stats:${userId}`;
  let lockAcquired = false;

  try {
    const [lockRows] = await conn.query<LockRow[]>(
      'SELECT GET_LOCK(?, 10) AS acquired',
      [lockName]
    );

    if (lockRows[0]?.acquired !== 1) {
      throw new Error('Voice actor stats recalculation is already running');
    }

    lockAcquired = true;

    const state = await getAnalysisState(userId);

    if (state && !Boolean(state.voiceActorStatsDirty)) {
      const [countRows] = await conn.query<Array<RowDataPacket & { count: number }>>(
        'SELECT COUNT(*) AS count FROM user_voice_actor_stats WHERE user_id = ?',
        [userId]
      );

      return {
        userId,
        savedStatsCount: countRows[0]?.count ?? 0,
        skipped: true,
      };
    }

    const [statsRows] = await conn.query<RecalculatedVoiceActorStatsRow[]>(
      `
      SELECT
        voice_actor_anime.voice_actor_id AS voiceActorId,
        COUNT(*) AS animeCount,
        COALESCE(character_counts.characterCount, 0) AS characterCount,
        COUNT(CASE WHEN voice_actor_anime.score IS NOT NULL THEN 1 END) AS ratedAnimeCount,
        SUM(voice_actor_anime.score) AS scoreSum,
        AVG(voice_actor_anime.score) AS averageScore
      FROM (
        SELECT DISTINCT
          acva.voice_actor_id,
          ual.anime_id,
          ual.score
        FROM user_anime_lists ual
        INNER JOIN anime a
          ON a.id = ual.anime_id
          AND a.is_adult = FALSE
          AND a.app_visible = TRUE
        INNER JOIN anime_character_voice_actors acva
          ON acva.anime_id = ual.anime_id
        WHERE ual.user_id = ?
      ) voice_actor_anime
      INNER JOIN voice_actors va
        ON va.id = voice_actor_anime.voice_actor_id
      LEFT JOIN (
        SELECT
          acva.voice_actor_id,
          COUNT(DISTINCT acva.character_id) AS characterCount
        FROM user_anime_lists ual
        INNER JOIN anime a
          ON a.id = ual.anime_id
          AND a.is_adult = FALSE
          AND a.app_visible = TRUE
        INNER JOIN anime_character_voice_actors acva
          ON acva.anime_id = ual.anime_id
        WHERE ual.user_id = ?
        GROUP BY acva.voice_actor_id
      ) character_counts
        ON character_counts.voice_actor_id = voice_actor_anime.voice_actor_id
      WHERE TRUE
        AND COALESCE(va.image_large, va.image_medium) IS NOT NULL
      GROUP BY
        voice_actor_anime.voice_actor_id,
        character_counts.characterCount
      `,
      [userId, userId]
    );

    await retryOnDbLock(async () => {
      await conn.beginTransaction();

      try {
        await conn.execute('DELETE FROM user_voice_actor_stats WHERE user_id = ?', [userId]);

        if (statsRows.length > 0) {
          const values = statsRows.map((row) => [
            userId,
            row.voiceActorId,
            row.animeCount,
            row.characterCount,
            row.ratedAnimeCount,
            toNumber(row.scoreSum),
            toNumber(row.averageScore),
          ]);

          await conn.query(
            `
            INSERT INTO user_voice_actor_stats (
              user_id,
              voice_actor_id,
              anime_count,
              character_count,
              rated_anime_count,
              score_sum,
              average_score
            )
            VALUES ?
            `,
            [values]
          );
        }

        await conn.execute(
          `
          UPDATE user_analysis_state
          SET
            voice_actor_stats_dirty = FALSE,
            voice_actor_stats_calculated_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ?
          `,
          [userId]
        );

        await conn.commit();
      } catch (error) {
        await conn.rollback();
        throw error;
      }
    });

    return {
      userId,
      savedStatsCount: statsRows.length,
      skipped: false,
    };
  } catch (error) {
    throw error;
  } finally {
    if (lockAcquired) {
      try {
        await conn.query('SELECT RELEASE_LOCK(?)', [lockName]);
      } catch (releaseError) {
        console.error(releaseError);
      }
    }

    conn.release();
  }
}

async function ensureFreshVoiceActorStats(userId: number) {
  const state = await getAnalysisState(userId);

  if (!state || Boolean(state.voiceActorStatsDirty)) {
    await recalculateUserVoiceActorStats(userId);
  }

  return getAnalysisState(userId);
}

function mapStatsRow(row: VoiceActorStatsRow) {
  return {
    voiceActor: {
      id: row.voiceActorId,
      anilistId: row.anilistId,
      name: {
        full: row.nameFull,
        native: row.nameNative,
        userPreferred: row.nameUserPreferred,
      },
      image: {
        large: row.imageLarge,
        medium: row.imageMedium,
      },
      languageV2: row.languageV2,
    },
    animeCount: row.animeCount,
    characterCount: row.characterCount,
    ratedAnimeCount: row.ratedAnimeCount,
    scoreSum: toNumber(row.scoreSum),
    averageScore: toNumber(row.averageScore),
    totalWatchMinutes: Number(row.totalWatchMinutes ?? 0),
    statsVersion: row.statsVersion,
    lastCalculatedAt: row.lastCalculatedAt,
  };
}

export async function getUserVoiceActorRanking(params: {
  userId: number;
  sort: VoiceActorRankingSort;
  limit: number;
  minAnimeCount: number;
  minRatedAnimeCount: number;
  cursor?: string;
}) {
  const state = await ensureFreshVoiceActorStats(params.userId);
  const cursor = decodeCursor<RankingCursorPayload>(params.cursor);
  const queryParams: Array<string | number> = [
    params.userId,
    params.minAnimeCount,
  ];

  let cursorWhere = '';

  if (params.sort === 'score') {
    queryParams.push(params.minRatedAnimeCount);

    if (cursor) {
      if (cursor.sort !== params.sort || cursor.minAnimeCount !== params.minAnimeCount || cursor.minRatedAnimeCount !== params.minRatedAnimeCount) {
        throw new Error('Cursor does not match ranking query');
      }

      cursorWhere = `
        AND (
          uvas.average_score < ?
          OR (uvas.average_score = ? AND uvas.rated_anime_count < ?)
          OR (uvas.average_score = ? AND uvas.rated_anime_count = ? AND uvas.anime_count < ?)
          OR (uvas.average_score = ? AND uvas.rated_anime_count = ? AND uvas.anime_count = ? AND uvas.voice_actor_id < ?)
        )
      `;
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
        cursor.voiceActorId
      );
    }
  } else if (params.sort === 'watchTime') {
    if (cursor) {
      if (cursor.sort !== params.sort || cursor.minAnimeCount !== params.minAnimeCount || cursor.minRatedAnimeCount !== params.minRatedAnimeCount) {
        throw new Error('Cursor does not match ranking query');
      }
      cursorWhere = `
        AND (
          COALESCE(wt.totalWatchMinutes, 0) < ?
          OR (COALESCE(wt.totalWatchMinutes, 0) = ? AND uvas.anime_count < ?)
          OR (COALESCE(wt.totalWatchMinutes, 0) = ? AND uvas.anime_count = ? AND uvas.voice_actor_id < ?)
        )
      `;
      queryParams.push(
        cursor.totalWatchMinutes ?? 0,
        cursor.totalWatchMinutes ?? 0,
        cursor.animeCount ?? 0,
        cursor.totalWatchMinutes ?? 0,
        cursor.animeCount ?? 0,
        cursor.voiceActorId
      );
    }
  } else if (cursor) {
    if (cursor.sort !== params.sort || cursor.minAnimeCount !== params.minAnimeCount || cursor.minRatedAnimeCount !== params.minRatedAnimeCount) {
      throw new Error('Cursor does not match ranking query');
    }

    cursorWhere = `
      AND (
        uvas.anime_count < ?
        OR (uvas.anime_count = ? AND uvas.voice_actor_id < ?)
      )
    `;
    queryParams.push(cursor.animeCount ?? 0, cursor.animeCount ?? 0, cursor.voiceActorId);
  }

  queryParams.push(params.limit + 1);

  const scoreFilter = params.sort === 'score'
    ? 'AND uvas.rated_anime_count >= ? AND uvas.average_score IS NOT NULL'
    : '';
  const orderClause = params.sort === 'score'
    ? 'uvas.average_score DESC, uvas.rated_anime_count DESC, uvas.anime_count DESC, uvas.voice_actor_id DESC'
    : params.sort === 'watchTime'
      ? 'COALESCE(wt.totalWatchMinutes, 0) DESC, uvas.anime_count DESC, uvas.voice_actor_id DESC'
      : 'uvas.anime_count DESC, uvas.voice_actor_id DESC';

  const [rows] = await pool.query<VoiceActorStatsRow[]>(
    `
    SELECT
      uvas.voice_actor_id AS voiceActorId,
      va.anilist_id AS anilistId,
      va.name_full AS nameFull,
      va.name_native AS nameNative,
      va.name_user_preferred AS nameUserPreferred,
      va.image_large AS imageLarge,
      va.image_medium AS imageMedium,
      va.language_v2 AS languageV2,
      uvas.anime_count AS animeCount,
      uvas.character_count AS characterCount,
      uvas.rated_anime_count AS ratedAnimeCount,
      uvas.score_sum AS scoreSum,
      uvas.average_score AS averageScore,
      COALESCE(wt.totalWatchMinutes, 0) AS totalWatchMinutes,
      uas.voice_actor_stats_version AS statsVersion,
      uvas.last_calculated_at AS lastCalculatedAt
    FROM user_voice_actor_stats uvas
    INNER JOIN voice_actors va
      ON va.id = uvas.voice_actor_id
    INNER JOIN user_analysis_state uas
      ON uas.user_id = uvas.user_id
    LEFT JOIN (
      SELECT
        ual.user_id AS userId,
        relation.voice_actor_id AS voiceActorId,
        SUM(
          CASE
            WHEN a.duration IS NULL THEN 0
            WHEN ual.status = 'completed' AND a.episodes IS NOT NULL
              THEN a.episodes * a.duration
            ELSE LEAST(ual.progress, COALESCE(a.episodes, ual.progress)) * a.duration
          END
        ) AS totalWatchMinutes
      FROM user_anime_lists ual
      INNER JOIN anime a
        ON a.id = ual.anime_id
        AND a.is_adult = FALSE
        AND a.app_visible = TRUE
      INNER JOIN (
        SELECT DISTINCT anime_id, voice_actor_id
        FROM anime_character_voice_actors
      ) relation ON relation.anime_id = ual.anime_id
      GROUP BY ual.user_id, relation.voice_actor_id
    ) wt
      ON wt.userId = uvas.user_id
      AND wt.voiceActorId = uvas.voice_actor_id
    WHERE uvas.user_id = ?
      AND uvas.anime_count >= ?
      ${scoreFilter}
      ${cursorWhere}
    ORDER BY ${orderClause}
    LIMIT ?
    `,
    queryParams
  );

  const hasNext = rows.length > params.limit;
  const pageRows = hasNext ? rows.slice(0, params.limit) : rows;
  const lastRow = pageRows[pageRows.length - 1];

  return {
    items: pageRows.map(mapStatsRow),
    pageInfo: {
      limit: params.limit,
      sort: params.sort,
      minAnimeCount: params.minAnimeCount,
      minRatedAnimeCount: params.minRatedAnimeCount,
      hasNext,
      nextCursor: hasNext && lastRow
        ? encodeCursor({
          sort: params.sort,
          minAnimeCount: params.minAnimeCount,
          minRatedAnimeCount: params.minRatedAnimeCount,
          animeCount: lastRow.animeCount,
          ratedAnimeCount: lastRow.ratedAnimeCount,
          averageScore: toNumber(lastRow.averageScore),
          totalWatchMinutes: Number(lastRow.totalWatchMinutes ?? 0),
          voiceActorId: lastRow.voiceActorId,
        })
        : null,
    },
    analysis: {
      dirty: Boolean(state?.voiceActorStatsDirty),
      version: state?.voiceActorStatsVersion ?? 1,
      calculatedAt: state?.voiceActorStatsCalculatedAt ?? null,
    },
  };
}

export async function getUserVoiceActorAnime(params: {
  userId: number;
  voiceActorId: number;
  titleLanguage: AnimeTitleLanguage;
  status: 'all' | 'completed';
  limit: number;
  cursor?: string;
}) {
  const [voiceActorRows] = await pool.query<VoiceActorRow[]>(
    `
    SELECT
      id,
      anilist_id AS anilistId,
      name_full AS nameFull,
      name_native AS nameNative,
      name_user_preferred AS nameUserPreferred,
      language_v2 AS languageV2,
      image_large AS imageLarge,
      image_medium AS imageMedium,
      description,
      site_url AS siteUrl
    FROM voice_actors
    WHERE id = ?
    LIMIT 1
    `,
    [params.voiceActorId]
  );

  if (!voiceActorRows[0]) {
    throw new Error('Voice actor not found');
  }

  const cursor = decodeCursor<AnimeCursorPayload>(params.cursor);
  const queryParams: Array<string | number> = [params.userId, params.voiceActorId];
  let cursorWhere = '';

  if (cursor) {
    const cursorStatus = cursor.status ?? 'all';

    if (cursor.voiceActorId !== params.voiceActorId || cursorStatus !== params.status) {
      throw new Error('Cursor does not match request filters');
    }

    cursorWhere = 'AND a.id < ?';
    queryParams.push(cursor.animeId);
  }

  queryParams.push(params.limit + 1);
  const statusWhere = params.status === 'completed'
    ? "AND ual.status = 'completed'"
    : '';

  const [animeRows] = await pool.query<VoiceActorAnimeRow[]>(
    `
    SELECT
      a.id AS animeId,
      a.anilist_id AS animeAnilistId,
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
      a.average_score AS averageScore,
      a.episodes,
      a.duration,
      ual.status AS userStatus,
      ual.score AS userScore,
      ual.progress AS userProgress,
      ual.updated_at AS listUpdatedAt
    FROM user_anime_lists ual
    INNER JOIN anime a
      ON a.id = ual.anime_id
      AND a.is_adult = FALSE
      AND a.app_visible = TRUE
    LEFT JOIN anime_korean_titles akt
      ON akt.anime_id = a.id
      AND akt.is_primary = TRUE
    WHERE ual.user_id = ?
      AND EXISTS (
        SELECT 1
        FROM anime_character_voice_actors acva
        WHERE acva.anime_id = a.id
          AND acva.voice_actor_id = ?
      )
      ${statusWhere}
      ${cursorWhere}
    ORDER BY a.id DESC
    LIMIT ?
    `,
    queryParams
  );

  const hasNext = animeRows.length > params.limit;
  const pageAnimeRows = hasNext ? animeRows.slice(0, params.limit) : animeRows;
  const animeIds = pageAnimeRows.map((row) => row.animeId);
  const charactersByAnimeId = new Map<number, VoiceActorCharacterRow[]>();

  if (animeIds.length > 0) {
    const [characterRows] = await pool.query<VoiceActorCharacterRow[]>(
      `
      SELECT
        acva.anime_id AS animeId,
        c.id AS characterId,
        c.anilist_id AS characterAnilistId,
        ac.role,
        c.name_full AS nameFull,
        c.name_native AS nameNative,
        c.name_user_preferred AS nameUserPreferred,
        c.image_large AS imageLarge,
        c.image_medium AS imageMedium,
        acva.sort_order AS sortOrder
      FROM anime_character_voice_actors acva
      INNER JOIN characters c
        ON c.id = acva.character_id
      INNER JOIN anime_characters ac
        ON ac.anime_id = acva.anime_id
        AND ac.character_id = acva.character_id
      WHERE acva.voice_actor_id = ?
        AND acva.anime_id IN (?)
      ORDER BY acva.anime_id DESC, COALESCE(acva.sort_order, 999999) ASC, c.id ASC
      `,
      [params.voiceActorId, animeIds]
    );

    for (const characterRow of characterRows) {
      const existingRows = charactersByAnimeId.get(characterRow.animeId) ?? [];
      existingRows.push(characterRow);
      charactersByAnimeId.set(characterRow.animeId, existingRows);
    }
  }

  const lastRow = pageAnimeRows[pageAnimeRows.length - 1];
  const voiceActor = voiceActorRows[0];

  return {
    voiceActor: {
      id: voiceActor.id,
      anilistId: voiceActor.anilistId,
      name: {
        full: voiceActor.nameFull,
        native: voiceActor.nameNative,
        userPreferred: voiceActor.nameUserPreferred,
      },
      image: {
        large: voiceActor.imageLarge,
        medium: voiceActor.imageMedium,
      },
      languageV2: voiceActor.languageV2,
      description: voiceActor.description,
      siteUrl: voiceActor.siteUrl,
    },
    items: pageAnimeRows.map((row) => ({
      anime: {
        id: row.animeId,
        anilistId: row.animeAnilistId,
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
        averageScore: row.averageScore,
        episodes: row.episodes,
        duration: row.duration,
      },
      userList: {
        status: row.userStatus,
        score: row.userScore,
        progress: row.userProgress,
        updatedAt: row.listUpdatedAt,
      },
      characters: (charactersByAnimeId.get(row.animeId) ?? []).map((characterRow) => ({
        id: characterRow.characterId,
        anilistId: characterRow.characterAnilistId,
        role: characterRow.role,
        sortOrder: characterRow.sortOrder,
        name: {
          full: characterRow.nameFull,
          native: characterRow.nameNative,
          userPreferred: characterRow.nameUserPreferred,
        },
        image: {
          large: characterRow.imageLarge,
          medium: characterRow.imageMedium,
        },
      })),
    })),
    pageInfo: {
      limit: params.limit,
      titleLanguage: params.titleLanguage,
      status: params.status,
      hasNext,
      nextCursor: hasNext && lastRow
        ? encodeCursor({
          voiceActorId: params.voiceActorId,
          animeId: lastRow.animeId,
          status: params.status,
        })
        : null,
    },
  };
}

export async function ensureUserExists(userId: number) {
  const [rows] = await pool.query<IdRow[]>(
    'SELECT id FROM users WHERE id = ? LIMIT 1',
    [userId]
  );

  if (!rows[0]) {
    throw new Error('User not found');
  }
}
