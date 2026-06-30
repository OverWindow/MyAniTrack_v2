import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../config/db';
import {
  AniListCharacter,
  AniListCharacterEdge,
  AniListVoiceActor,
  fetchAnimeCastPage,
} from './anilist.client';

const ANILIST_CAST_REQUEST_DELAY_MS = 2500;

type CastLanguage = 'JAPANESE' | 'ENGLISH' | 'KOREAN';

interface AnimeRow extends RowDataPacket {
  id: number;
  anilistId: number;
}

interface IdRow extends RowDataPacket {
  id: number;
}

interface PreparedCharacterLink {
  characterId: number;
  role: string | null;
  edgeName: string | null;
  sortOrder: number;
}

interface PreparedVoiceActorLink {
  characterId: number;
  voiceActorId: number;
  languageV2: string | null;
  sortOrder: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toMySQLDateTime(unixTs?: number | null): string | null {
  if (!unixTs) {
    return null;
  }

  return new Date(unixTs * 1000).toISOString().slice(0, 19).replace('T', ' ');
}

function truncate(value: string | null | undefined, maxLength: number) {
  if (!value) {
    return null;
  }

  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function normalizeCastLanguage(value: unknown): CastLanguage {
  if (value === undefined || value === null || value === '') {
    return 'JAPANESE';
  }

  if (value === 'JAPANESE' || value === 'ENGLISH' || value === 'KOREAN') {
    return value;
  }

  throw new Error('language must be one of JAPANESE, ENGLISH, KOREAN');
}

function normalizePerPage(value: unknown) {
  const perPage = Number(value ?? 25);

  if (!Number.isInteger(perPage) || perPage < 1 || perPage > 50) {
    throw new Error('perPage must be an integer between 1 and 50');
  }

  return perPage;
}

function isLockWaitError(error: unknown) {
  const dbError = error as { code?: string; errno?: number };

  return dbError.code === 'ER_LOCK_WAIT_TIMEOUT'
    || dbError.code === 'ER_LOCK_DEADLOCK'
    || dbError.errno === 1205
    || dbError.errno === 1213;
}

async function withLockRetry<T>(operation: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isLockWaitError(error) || attempt === maxAttempts) {
        break;
      }

      await sleep(500 * attempt);
    }
  }

  throw lastError;
}

async function findAnimeById(animeId: number) {
  const [rows] = await pool.query<AnimeRow[]>(
    `
    SELECT
      id,
      anilist_id AS anilistId
    FROM anime
    WHERE id = ?
    LIMIT 1
    `,
    [animeId]
  );

  return rows[0] ?? null;
}

async function markSyncState(
  animeId: number,
  status: 'pending' | 'syncing' | 'success' | 'failed',
  sourceUpdatedAt?: string | null,
  errorMessage?: string | null
) {
  await pool.execute(
    `
    INSERT INTO anime_cast_sync_state (
      anime_id,
      last_synced_at,
      source_updated_at,
      status,
      error_message
    )
    VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      last_synced_at = VALUES(last_synced_at),
      source_updated_at = VALUES(source_updated_at),
      status = VALUES(status),
      error_message = VALUES(error_message)
    `,
    [
      animeId,
      status === 'syncing' ? null : new Date().toISOString().slice(0, 19).replace('T', ' '),
      sourceUpdatedAt ?? null,
      status,
      errorMessage ?? null,
    ]
  );
}

async function upsertCharacter(character: AniListCharacter) {
  const [existingRows] = await pool.query<IdRow[]>(
    'SELECT id FROM characters WHERE anilist_id = ? LIMIT 1',
    [character.id]
  );

  if (existingRows[0]) {
    return existingRows[0].id;
  }

  return withLockRetry(async () => {
    const [result] = await pool.execute<ResultSetHeader>(
      `
      INSERT INTO characters (
        anilist_id,
        name_full,
        name_native,
        name_user_preferred,
        image_large,
        image_medium,
        gender,
        age,
        description,
        site_url,
        source_updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        id = LAST_INSERT_ID(id),
        name_full = VALUES(name_full),
        name_native = VALUES(name_native),
        name_user_preferred = VALUES(name_user_preferred),
        image_large = VALUES(image_large),
        image_medium = VALUES(image_medium),
        gender = VALUES(gender),
        age = VALUES(age),
        description = VALUES(description),
        site_url = VALUES(site_url),
        source_updated_at = VALUES(source_updated_at)
      `,
      [
        character.id,
        truncate(character.name?.full, 255),
        truncate(character.name?.native, 255),
        truncate(character.name?.userPreferred, 255),
        truncate(character.image?.large, 500),
        truncate(character.image?.medium, 500),
        truncate(character.gender, 50),
        truncate(character.age, 50),
        character.description ?? null,
        truncate(character.siteUrl, 500),
        toMySQLDateTime(character.updatedAt),
      ]
    );

    return result.insertId;
  });
}

async function upsertVoiceActor(voiceActor: AniListVoiceActor) {
  const [existingRows] = await pool.query<IdRow[]>(
    'SELECT id FROM voice_actors WHERE anilist_id = ? LIMIT 1',
    [voiceActor.id]
  );

  if (existingRows[0]) {
    return existingRows[0].id;
  }

  return withLockRetry(async () => {
    const [result] = await pool.execute<ResultSetHeader>(
      `
      INSERT INTO voice_actors (
        anilist_id,
        name_full,
        name_native,
        name_user_preferred,
        language_v2,
        image_large,
        image_medium,
        description,
        site_url,
        source_updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        id = LAST_INSERT_ID(id),
        name_full = VALUES(name_full),
        name_native = VALUES(name_native),
        name_user_preferred = VALUES(name_user_preferred),
        language_v2 = VALUES(language_v2),
        image_large = VALUES(image_large),
        image_medium = VALUES(image_medium),
        description = VALUES(description),
        site_url = VALUES(site_url),
        source_updated_at = VALUES(source_updated_at)
      `,
      [
        voiceActor.id,
        truncate(voiceActor.name?.full, 255),
        truncate(voiceActor.name?.native, 255),
        truncate(voiceActor.name?.userPreferred, 255),
        truncate(voiceActor.languageV2, 100),
        truncate(voiceActor.image?.large, 500),
        truncate(voiceActor.image?.medium, 500),
        voiceActor.description ?? null,
        truncate(voiceActor.siteUrl, 500),
        toMySQLDateTime(voiceActor.updatedAt),
      ]
    );

    return result.insertId;
  });
}

async function replaceAnimeCastLinks(animeId: number, edges: AniListCharacterEdge[]) {
  const characterLinks: PreparedCharacterLink[] = [];
  const voiceActorLinks: PreparedVoiceActorLink[] = [];
  let characterCount = 0;
  let voiceActorCount = 0;

  for (let index = 0; index < edges.length; index += 1) {
    const edge = edges[index];
    const character = edge.node;

    if (!character?.id) {
      continue;
    }

    const characterId = await upsertCharacter(character);
    characterCount += 1;
    characterLinks.push({
      characterId,
      role: truncate(edge.role, 50),
      edgeName: truncate(edge.name, 255),
      sortOrder: index + 1,
    });

    const voiceActors = edge.voiceActors ?? [];

    for (let voiceActorIndex = 0; voiceActorIndex < voiceActors.length; voiceActorIndex += 1) {
      const voiceActor = voiceActors[voiceActorIndex];

      if (!voiceActor?.id) {
        continue;
      }

      const voiceActorId = await upsertVoiceActor(voiceActor);
      voiceActorCount += 1;
      voiceActorLinks.push({
        characterId,
        voiceActorId,
        languageV2: truncate(voiceActor.languageV2, 100),
        sortOrder: voiceActorIndex + 1,
      });
    }
  }

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    await conn.execute('DELETE FROM anime_character_voice_actors WHERE anime_id = ?', [animeId]);
    await conn.execute('DELETE FROM anime_characters WHERE anime_id = ?', [animeId]);

    for (const characterLink of characterLinks) {
      await conn.execute(
        `
        INSERT INTO anime_characters (
          anime_id,
          character_id,
          role,
          edge_name,
          sort_order
        )
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          role = VALUES(role),
          edge_name = VALUES(edge_name),
          sort_order = VALUES(sort_order)
        `,
        [
          animeId,
          characterLink.characterId,
          characterLink.role,
          characterLink.edgeName,
          characterLink.sortOrder,
        ]
      );
    }

    for (const voiceActorLink of voiceActorLinks) {
      await conn.execute(
        `
        INSERT INTO anime_character_voice_actors (
          anime_id,
          character_id,
          voice_actor_id,
          language_v2,
          sort_order
        )
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          language_v2 = VALUES(language_v2),
          sort_order = VALUES(sort_order)
        `,
        [
          animeId,
          voiceActorLink.characterId,
          voiceActorLink.voiceActorId,
          voiceActorLink.languageV2,
          voiceActorLink.sortOrder,
        ]
      );
    }

    await conn.commit();

    return {
      characterCount,
      voiceActorCount,
      characterVoiceActorLinkCount: voiceActorLinks.length,
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function syncAnimeCastByAnimeId(
  animeId: number,
  options: {
    perPage?: unknown;
    language?: unknown;
  } = {}
) {
  if (!Number.isInteger(animeId) || animeId <= 0) {
    throw new Error('animeId must be a positive integer');
  }

  const anime = await findAnimeById(animeId);

  if (!anime) {
    throw new Error('Anime not found');
  }

  const perPage = normalizePerPage(options.perPage);
  const language = normalizeCastLanguage(options.language);
  const allEdges: AniListCharacterEdge[] = [];
  let page = 1;
  let hasNextPage = true;
  let sourceUpdatedAt: string | null = null;
  let processedPages = 0;

  await markSyncState(animeId, 'syncing');

  try {
    while (hasNextPage) {
      const result = await fetchAnimeCastPage(anime.anilistId, page, perPage, language);

      allEdges.push(...result.edges);
      sourceUpdatedAt = toMySQLDateTime(result.sourceUpdatedAt);
      hasNextPage = result.hasNextPage;
      page += 1;
      processedPages += 1;

      if (hasNextPage) {
        await sleep(ANILIST_CAST_REQUEST_DELAY_MS);
      }
    }

    const linkResult = await replaceAnimeCastLinks(anime.id, allEdges);
    await markSyncState(anime.id, 'success', sourceUpdatedAt);

    return {
      animeId: anime.id,
      anilistId: anime.anilistId,
      language,
      perPage,
      processedPages,
      sourceUpdatedAt,
      characterEdgeCount: allEdges.length,
      ...linkResult,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    await markSyncState(anime.id, 'failed', sourceUpdatedAt, message);
    throw error;
  }
}

export async function syncAnimeCastBatch(options: {
  limit?: unknown;
  perPage?: unknown;
  language?: unknown;
  onlyMissing?: unknown;
  retryFailed?: unknown;
  delayMs?: unknown;
} = {}) {
  const limit = Number(options.limit ?? 10);
  const perPage = normalizePerPage(options.perPage);
  const language = normalizeCastLanguage(options.language);
  const onlyMissing = options.onlyMissing !== false;
  const retryFailed = options.retryFailed !== false;
  const delayMs = Number(options.delayMs ?? ANILIST_CAST_REQUEST_DELAY_MS);

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('limit must be an integer between 1 and 100');
  }

  if (!Number.isInteger(delayMs) || delayMs < 0) {
    throw new Error('delayMs must be a non-negative integer');
  }

  const whereClause = onlyMissing
    ? `
      WHERE acss.anime_id IS NULL
        OR acss.status = 'pending'
        OR (? = TRUE AND acss.status = 'failed')
      `
    : `
      WHERE (? = TRUE OR acss.status <> 'failed' OR acss.status IS NULL)
      `;

  const [rows] = await pool.query<AnimeRow[]>(
    `
    SELECT
      a.id,
      a.anilist_id AS anilistId
    FROM anime a
    LEFT JOIN anime_cast_sync_state acss
      ON acss.anime_id = a.id
    ${whereClause}
    ORDER BY
      acss.last_synced_at IS NULL DESC,
      acss.last_synced_at ASC,
      a.id ASC
    LIMIT ?
    `,
    [retryFailed, limit]
  );

  const results: Array<Awaited<ReturnType<typeof syncAnimeCastByAnimeId>>> = [];
  const failed: Array<{ animeId: number; anilistId: number; message: string }> = [];

  for (let index = 0; index < rows.length; index += 1) {
    const anime = rows[index];

    try {
      const result = await syncAnimeCastByAnimeId(anime.id, { perPage, language });
      results.push(result);
    } catch (error) {
      failed.push({
        animeId: anime.id,
        anilistId: anime.anilistId,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    if (index < rows.length - 1 && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  return {
    requestedLimit: limit,
    selectedAnimeCount: rows.length,
    processedAnimeCount: results.length,
    failedAnimeCount: failed.length,
    language,
    perPage,
    results,
    failed,
  };
}

export async function syncAnimeCastInChunks(options: {
  totalLimit?: unknown;
  chunkSize?: unknown;
  maxChunks?: unknown;
  chunkDelayMs?: unknown;
  perPage?: unknown;
  language?: unknown;
  onlyMissing?: unknown;
  retryFailed?: unknown;
  delayMs?: unknown;
} = {}) {
  const totalLimit = options.totalLimit === undefined ? undefined : Number(options.totalLimit);
  const chunkSize = Number(options.chunkSize ?? 100);
  const maxChunks = options.maxChunks === undefined ? undefined : Number(options.maxChunks);
  const chunkDelayMs = Number(options.chunkDelayMs ?? 10000);

  if (totalLimit !== undefined && (!Number.isInteger(totalLimit) || totalLimit < 1 || totalLimit > 5000)) {
    throw new Error('totalLimit must be an integer between 1 and 5000');
  }

  if (!Number.isInteger(chunkSize) || chunkSize < 1 || chunkSize > 100) {
    throw new Error('chunkSize must be an integer between 1 and 100');
  }

  if (maxChunks !== undefined && (!Number.isInteger(maxChunks) || maxChunks < 1 || maxChunks > 100)) {
    throw new Error('maxChunks must be an integer between 1 and 100');
  }

  if (!Number.isInteger(chunkDelayMs) || chunkDelayMs < 0) {
    throw new Error('chunkDelayMs must be a non-negative integer');
  }

  const chunkResults: Array<Awaited<ReturnType<typeof syncAnimeCastBatch>>> = [];
  const failed: Array<{ animeId: number; anilistId: number; message: string }> = [];
  let processedAnimeCount = 0;
  let selectedAnimeCount = 0;
  let failedAnimeCount = 0;
  let finished = false;

  while (!finished) {
    if (maxChunks !== undefined && chunkResults.length >= maxChunks) {
      break;
    }

    const remainingLimit = totalLimit === undefined
      ? chunkSize
      : totalLimit - selectedAnimeCount;

    if (remainingLimit <= 0) {
      break;
    }

    const currentChunkLimit = Math.min(chunkSize, remainingLimit);
    const chunkResult = await syncAnimeCastBatch({
      limit: currentChunkLimit,
      perPage: options.perPage,
      language: options.language,
      onlyMissing: options.onlyMissing,
      retryFailed: options.retryFailed,
      delayMs: options.delayMs,
    });

    chunkResults.push(chunkResult);
    selectedAnimeCount += chunkResult.selectedAnimeCount;
    processedAnimeCount += chunkResult.processedAnimeCount;
    failedAnimeCount += chunkResult.failedAnimeCount;
    failed.push(...chunkResult.failed);

    finished = chunkResult.selectedAnimeCount < currentChunkLimit
      || chunkResult.selectedAnimeCount === 0;

    if (!finished && chunkDelayMs > 0) {
      await sleep(chunkDelayMs);
    }
  }

  return {
    totalLimit: totalLimit ?? null,
    chunkSize,
    maxChunks: maxChunks ?? null,
    chunkDelayMs,
    processedChunks: chunkResults.length,
    selectedAnimeCount,
    processedAnimeCount,
    failedAnimeCount,
    finished,
    nextChunkAvailable: !finished && (totalLimit === undefined || selectedAnimeCount < totalLimit),
    language: chunkResults[0]?.language ?? normalizeCastLanguage(options.language),
    perPage: chunkResults[0]?.perPage ?? normalizePerPage(options.perPage),
    chunks: chunkResults,
    failed,
  };
}

export async function getAnimeCastSyncState(animeId: number) {
  if (!Number.isInteger(animeId) || animeId <= 0) {
    throw new Error('animeId must be a positive integer');
  }

  const [rows] = await pool.query<IdRow[]>(
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

  const [stateRows] = await pool.query<RowDataPacket[]>(
    `
    SELECT
      anime_id AS animeId,
      last_synced_at AS lastSyncedAt,
      source_updated_at AS sourceUpdatedAt,
      status,
      error_message AS errorMessage,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM anime_cast_sync_state
    WHERE anime_id = ?
    LIMIT 1
    `,
    [animeId]
  );

  return stateRows[0] ?? {
    animeId,
    lastSyncedAt: null,
    sourceUpdatedAt: null,
    status: 'pending',
    errorMessage: null,
    createdAt: null,
    updatedAt: null,
  };
}
