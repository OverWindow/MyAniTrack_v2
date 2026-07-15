import { RowDataPacket } from 'mysql2/promise';
import { pool } from '../config/db';
import {
  AniListAnime,
  fetchAnimePage,
  fetchAnimeRelationsByAnilistIds,
  fetchAnimeStudiosByAnilistIds,
  fetchSeasonAnimePage,
} from './anilist.client';
import { syncAnimeCastByAnimeId } from './anime-cast.sync.service';
import {
  markAnimeRelationSyncFailedByAnilistId,
  markAnimeStudioSyncFailedByAnilistId,
  upsertAnimeFull,
  upsertAnimeRelationsOnly,
  upsertAnimeStudiosOnly,
} from './anime.repository';

const ANILIST_REQUEST_DELAY_MS = 2500;
const ANILIST_CHUNK_DELAY_MS = 10000;

interface StudioBackfillAnimeRow extends RowDataPacket {
  id: number;
  anilistId: number;
}

type RelationSyncMode = 'missing' | 'all';

type CastLanguage = 'JAPANESE' | 'ENGLISH' | 'KOREAN';

interface IntegratedSyncOptions {
  castPerPage: number;
  language: CastLanguage;
  animeDelayMs: number;
}

interface IntegratedSyncFailure {
  anilistId: number;
  animeId: number | null;
  stage: 'anime' | 'cast';
  message: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getCurrentSeason(date = new Date()): {
  season: 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL';
  seasonYear: number;
} {
  const month = date.getMonth() + 1;
  const seasonYear = date.getFullYear();

  if (month >= 1 && month <= 3) {
    return { season: 'WINTER', seasonYear };
  }

  if (month >= 4 && month <= 6) {
    return { season: 'SPRING', seasonYear };
  }

  if (month >= 7 && month <= 9) {
    return { season: 'SUMMER', seasonYear };
  }

  return { season: 'FALL', seasonYear };
}

function normalizePositiveInteger(value: unknown, defaultValue: number, fieldName: string, max: number) {
  const parsedValue = Number(value ?? defaultValue);

  if (!Number.isInteger(parsedValue) || parsedValue < 1 || parsedValue > max) {
    throw new Error(`${fieldName} must be an integer between 1 and ${max}`);
  }

  return parsedValue;
}

function normalizeOptionalPositiveInteger(value: unknown, fieldName: string, max: number) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return normalizePositiveInteger(value, 1, fieldName, max);
}

function normalizeCastLanguage(value: unknown): CastLanguage {
  const language = value ?? 'JAPANESE';

  if (language !== 'JAPANESE' && language !== 'ENGLISH' && language !== 'KOREAN') {
    throw new Error('language must be one of JAPANESE, ENGLISH, KOREAN');
  }

  return language;
}

function normalizeDelay(value: unknown, defaultValue: number, fieldName: string) {
  const delay = Number(value ?? defaultValue);

  if (!Number.isInteger(delay) || delay < 0 || delay > 60000) {
    throw new Error(`${fieldName} must be an integer between 0 and 60000`);
  }

  return delay;
}

function normalizeBoolean(value: unknown, defaultValue: boolean, fieldName: string) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  if (value === true || value === 'true' || value === '1' || value === 1) {
    return true;
  }

  if (value === false || value === 'false' || value === '0' || value === 0) {
    return false;
  }

  throw new Error(`${fieldName} must be a boolean`);
}

function normalizeIntegratedSyncOptions(params: {
  castPerPage?: unknown;
  language?: unknown;
  animeDelayMs?: unknown;
}): IntegratedSyncOptions {
  return {
    castPerPage: normalizePositiveInteger(params.castPerPage, 25, 'castPerPage', 50),
    language: normalizeCastLanguage(params.language),
    animeDelayMs: normalizeDelay(params.animeDelayMs, ANILIST_REQUEST_DELAY_MS, 'animeDelayMs'),
  };
}

async function syncAnimeAndCast(
  anime: AniListAnime,
  options: IntegratedSyncOptions,
  failures: IntegratedSyncFailure[]
) {
  let animeId: number;

  try {
    animeId = await upsertAnimeFull(anime);
  } catch (error) {
    failures.push({
      anilistId: anime.id,
      animeId: null,
      stage: 'anime',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    return { animeSynced: false, castSynced: false };
  }

  try {
    await syncAnimeCastByAnimeId(animeId, {
      perPage: options.castPerPage,
      language: options.language,
    });
    return { animeSynced: true, castSynced: true };
  } catch (error) {
    failures.push({
      anilistId: anime.id,
      animeId,
      stage: 'cast',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    return { animeSynced: true, castSynced: false };
  }
}

export async function syncAllAnimeIntegrated(params: {
  startPage?: unknown;
  perPage?: unknown;
  maxPages?: unknown;
  castPerPage?: unknown;
  language?: unknown;
  animeDelayMs?: unknown;
} = {}) {
  const startPage = normalizePositiveInteger(params.startPage, 1, 'startPage', 100000);
  const perPage = normalizePositiveInteger(params.perPage, 50, 'perPage', 50);
  const maxPages = normalizeOptionalPositiveInteger(params.maxPages, 'maxPages', 100000);
  const options = normalizeIntegratedSyncOptions(params);
  const failures: IntegratedSyncFailure[] = [];
  let page = startPage;
  let processedPages = 0;
  let selectedAnimeCount = 0;
  let animeSyncedCount = 0;
  let castSyncedCount = 0;
  let hasNextPage = true;

  while (hasNextPage) {
    const result = await fetchAnimePage(page, perPage);
    selectedAnimeCount += result.media.length;

    for (let index = 0; index < result.media.length; index += 1) {
      const syncResult = await syncAnimeAndCast(result.media[index], options, failures);

      if (syncResult.animeSynced) animeSyncedCount += 1;
      if (syncResult.castSynced) castSyncedCount += 1;

      if (index < result.media.length - 1 && options.animeDelayMs > 0) {
        await sleep(options.animeDelayMs);
      }
    }

    processedPages += 1;
    hasNextPage = result.hasNextPage;
    page += 1;

    if (maxPages !== undefined && processedPages >= maxPages) {
      break;
    }

    if (hasNextPage && options.animeDelayMs > 0) {
      await sleep(options.animeDelayMs);
    }
  }

  return {
    startPage,
    perPage,
    maxPages: maxPages ?? null,
    processedPages,
    selectedAnimeCount,
    animeSyncedCount,
    castSyncedCount,
    failedAnimeCount: failures.length,
    nextPage: hasNextPage ? page : null,
    finished: !hasNextPage,
    language: options.language,
    castPerPage: options.castPerPage,
    animeDelayMs: options.animeDelayMs,
    failures,
  };
}

export async function syncAnimePage(page: number, perPage = 50) {
  const result = await fetchAnimePage(page, perPage);

  for (const anime of result.media) {
    await upsertAnimeFull(anime);
  }

  return {
    page: result.currentPage,
    lastPage: result.lastPage,
    count: result.media.length,
    hasNextPage: result.hasNextPage,
  };
}

export async function syncAllAnime(startPage = 1, perPage = 50, maxPages?: number) {
  let page = startPage;
  let processedPages = 0;
  let totalAnime = 0;
  let hasNextPage = true;

  while (hasNextPage) {
    const result = await fetchAnimePage(page, perPage);

    for (const anime of result.media) {
      await upsertAnimeFull(anime);
    }

    totalAnime += result.media.length;
    processedPages += 1;
    hasNextPage = result.hasNextPage;
    page += 1;

    if (maxPages && processedPages >= maxPages) {
      break;
    }

    await sleep(ANILIST_REQUEST_DELAY_MS);
  }

  return {
    processedPages,
    totalAnime,
    nextPage: hasNextPage ? page : null,
    finished: !hasNextPage,
  };
}

export async function syncAnimeInChunks(
  startPage = 1,
  perPage = 50,
  pagesPerChunk = 10,
  chunkDelayMs = ANILIST_CHUNK_DELAY_MS,
  maxChunks?: number
) {
  let nextStartPage = startPage;
  let processedChunks = 0;
  let totalProcessedPages = 0;
  let totalAnime = 0;
  let finished = false;

  while (!finished) {
    const result = await syncAllAnime(nextStartPage, perPage, pagesPerChunk);

    processedChunks += 1;
    totalProcessedPages += result.processedPages;
    totalAnime += result.totalAnime;
    finished = result.finished;

    if (finished || !result.nextPage) {
      break;
    }

    nextStartPage = result.nextPage;

    if (maxChunks && processedChunks >= maxChunks) {
      break;
    }

    await sleep(chunkDelayMs);
  }

  return {
    startPage,
    perPage,
    pagesPerChunk,
    chunkDelayMs,
    processedChunks,
    processedPages: totalProcessedPages,
    totalAnime,
    nextPage: finished ? null : nextStartPage,
    finished,
  };
}

export async function syncSeasonAnime(
  season?: 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL',
  seasonYear?: number,
  startPage = 1,
  perPage = 50,
  maxPages?: number,
  integratedOptions: {
    syncCast?: unknown;
    castPerPage?: unknown;
    language?: unknown;
    animeDelayMs?: unknown;
  } = {}
) {
  const currentSeason = getCurrentSeason();
  const targetSeason = season ?? currentSeason.season;
  const targetSeasonYear = seasonYear ?? currentSeason.seasonYear;
  const syncCast = normalizeBoolean(integratedOptions.syncCast, true, 'syncCast');
  const options = normalizeIntegratedSyncOptions(integratedOptions);
  const failures: IntegratedSyncFailure[] = [];

  let page = startPage;
  let processedPages = 0;
  let totalAnime = 0;
  let animeSyncedCount = 0;
  let castSyncedCount = 0;
  let hasNextPage = true;

  while (hasNextPage) {
    const result = await fetchSeasonAnimePage(targetSeason, targetSeasonYear, page, perPage);

    for (let index = 0; index < result.media.length; index += 1) {
      const anime = result.media[index];

      if (syncCast) {
        const syncResult = await syncAnimeAndCast(anime, options, failures);
        if (syncResult.animeSynced) animeSyncedCount += 1;
        if (syncResult.castSynced) castSyncedCount += 1;
      } else {
        try {
          await upsertAnimeFull(anime);
          animeSyncedCount += 1;
        } catch (error) {
          failures.push({
            anilistId: anime.id,
            animeId: null,
            stage: 'anime',
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      if (syncCast && index < result.media.length - 1 && options.animeDelayMs > 0) {
        await sleep(options.animeDelayMs);
      }
    }

    totalAnime += result.media.length;
    processedPages += 1;
    hasNextPage = result.hasNextPage;
    page += 1;

    if (maxPages && processedPages >= maxPages) {
      break;
    }

    if (hasNextPage) {
      await sleep(syncCast ? options.animeDelayMs : ANILIST_REQUEST_DELAY_MS);
    }
  }

  return {
    season: targetSeason,
    seasonYear: targetSeasonYear,
    processedPages,
    totalAnime,
    animeSyncedCount,
    castSyncedCount,
    failedAnimeCount: failures.length,
    nextPage: hasNextPage ? page : null,
    finished: !hasNextPage,
    syncCast,
    language: options.language,
    castPerPage: options.castPerPage,
    animeDelayMs: options.animeDelayMs,
    failures,
  };
}

function normalizeBackfillLimit(value: unknown, defaultValue = 50) {
  const limit = Number(value ?? defaultValue);

  if (!Number.isInteger(limit) || limit <= 0 || limit > 5000) {
    throw new Error('limit must be an integer between 1 and 5000');
  }

  return limit;
}

function normalizeBackfillBatchSize(value: unknown, defaultValue = 50) {
  const batchSize = Number(value ?? defaultValue);

  if (!Number.isInteger(batchSize) || batchSize <= 0 || batchSize > 50) {
    throw new Error('batchSize must be an integer between 1 and 50');
  }

  return batchSize;
}

function normalizeRelationSyncMode(value: unknown): RelationSyncMode {
  const mode = value ?? 'missing';

  if (mode !== 'missing' && mode !== 'all') {
    throw new Error('mode must be one of missing, all');
  }

  return mode;
}

function normalizeAfterAnimeId(value: unknown) {
  const afterAnimeId = Number(value ?? 0);

  if (!Number.isInteger(afterAnimeId) || afterAnimeId < 0) {
    throw new Error('afterAnimeId must be a non-negative integer');
  }

  return afterAnimeId;
}

async function getRelationSyncCandidates(params: {
  mode: RelationSyncMode;
  limit: number;
  retryFailed: boolean;
  afterAnimeId: number;
}) {
  const missingWhere = params.mode === 'missing'
    ? `AND (
        arss.anime_id IS NULL
        OR arss.status = 'pending'
        OR (? = TRUE AND arss.status = 'failed')
      )`
    : '';
  const queryParams: Array<number | boolean> = [params.afterAnimeId];

  if (params.mode === 'missing') {
    queryParams.push(params.retryFailed);
  }

  queryParams.push(params.limit);

  const [rows] = await pool.query<StudioBackfillAnimeRow[]>(
    `
    SELECT
      a.id,
      a.anilist_id AS anilistId
    FROM anime a
    LEFT JOIN anime_relation_sync_state arss
      ON arss.anime_id = a.id
    WHERE a.id > ?
      ${missingWhere}
    ORDER BY a.id ASC
    LIMIT ?
    `,
    queryParams
  );

  return rows;
}

export async function syncAnimeRelations(params: {
  mode?: unknown;
  limit?: unknown;
  batchSize?: unknown;
  retryFailed?: unknown;
  afterAnimeId?: unknown;
  delayMs?: unknown;
} = {}) {
  const mode = normalizeRelationSyncMode(params.mode);
  const limit = normalizeBackfillLimit(params.limit, 500);
  const batchSize = normalizeBackfillBatchSize(params.batchSize);
  const retryFailed = normalizeBoolean(params.retryFailed, true, 'retryFailed');
  const afterAnimeId = normalizeAfterAnimeId(params.afterAnimeId);
  const delayMs = normalizeDelay(params.delayMs, ANILIST_REQUEST_DELAY_MS, 'delayMs');
  const candidates = await getRelationSyncCandidates({
    mode,
    limit,
    retryFailed,
    afterAnimeId,
  });
  let processedAnimeCount = 0;
  let syncedAnimeCount = 0;
  let failedAnimeCount = 0;
  const failures: Array<{ animeId: number; anilistId: number; message: string }> = [];

  for (let index = 0; index < candidates.length; index += batchSize) {
    const batch = candidates.slice(index, index + batchSize);
    const anilistIds = batch.map((anime) => anime.anilistId);

    try {
      const animeList = await fetchAnimeRelationsByAnilistIds(anilistIds);
      const fetchedByAnilistId = new Map(animeList.map((anime) => [anime.id, anime]));

      for (const candidate of batch) {
        try {
          const anime = fetchedByAnilistId.get(candidate.anilistId);

          if (!anime) {
            throw new Error('Anime not found in AniList response');
          }

          await upsertAnimeRelationsOnly(anime);
          syncedAnimeCount += 1;
        } catch (error) {
          failedAnimeCount += 1;
          const message = error instanceof Error ? error.message : 'Unknown error';
          failures.push({
            animeId: candidate.id,
            anilistId: candidate.anilistId,
            message,
          });
          await markAnimeRelationSyncFailedByAnilistId(candidate.anilistId, error);
        } finally {
          processedAnimeCount += 1;
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      for (const candidate of batch) {
        failedAnimeCount += 1;
        processedAnimeCount += 1;
        failures.push({
          animeId: candidate.id,
          anilistId: candidate.anilistId,
          message,
        });
        await markAnimeRelationSyncFailedByAnilistId(candidate.anilistId, error);
      }
    }

    if (index + batchSize < candidates.length && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  const hasMore = candidates.length === limit;
  const lastCandidate = candidates[candidates.length - 1];

  return {
    mode,
    retryFailed,
    afterAnimeId,
    nextAfterAnimeId: hasMore && lastCandidate ? lastCandidate.id : null,
    limit,
    batchSize,
    delayMs,
    selectedAnimeCount: candidates.length,
    processedAnimeCount,
    syncedAnimeCount,
    failedAnimeCount,
    hasMore,
    failures,
  };
}

async function getStudioBackfillCandidates(limit: number, retryFailed: boolean) {
  const failedWhere = retryFailed
    ? "OR ass.status = 'failed'"
    : '';

  const [rows] = await pool.query<StudioBackfillAnimeRow[]>(
    `
    SELECT
      a.id,
      a.anilist_id AS anilistId
    FROM anime a
    LEFT JOIN anime_studio_sync_state ass
      ON ass.anime_id = a.id
    WHERE ass.anime_id IS NULL
      OR ass.status = 'pending'
      ${failedWhere}
    ORDER BY a.id ASC
    LIMIT ?
    `,
    [limit]
  );

  return rows;
}

export async function syncMissingAnimeStudios(params: {
  limit?: unknown;
  batchSize?: unknown;
  retryFailed?: unknown;
  delayMs?: unknown;
}) {
  const limit = normalizeBackfillLimit(params.limit);
  const batchSize = normalizeBackfillBatchSize(params.batchSize);
  const retryFailed = params.retryFailed === true || params.retryFailed === 'true' || params.retryFailed === '1';
  const delayMs = Number(params.delayMs ?? ANILIST_REQUEST_DELAY_MS);

  if (!Number.isInteger(delayMs) || delayMs < 0 || delayMs > 60000) {
    throw new Error('delayMs must be an integer between 0 and 60000');
  }

  const candidates = await getStudioBackfillCandidates(limit, retryFailed);
  let processedAnimeCount = 0;
  let syncedAnimeCount = 0;
  let failedAnimeCount = 0;
  const failed: Array<{ anilistId: number; message: string }> = [];

  for (let index = 0; index < candidates.length; index += batchSize) {
    const batch = candidates.slice(index, index + batchSize);
    const anilistIds = batch.map((anime) => anime.anilistId);

    try {
      const animeList = await fetchAnimeStudiosByAnilistIds(anilistIds);
      const fetchedByAnilistId = new Map(animeList.map((anime) => [anime.id, anime]));

      for (const anilistId of anilistIds) {
        const anime = fetchedByAnilistId.get(anilistId);

        try {
          if (!anime) {
            throw new Error('Anime not found in AniList response');
          }

          await upsertAnimeStudiosOnly(anime);
          syncedAnimeCount += 1;
        } catch (error) {
          failedAnimeCount += 1;
          const message = error instanceof Error ? error.message : 'Unknown error';
          failed.push({ anilistId, message });
          await markAnimeStudioSyncFailedByAnilistId(anilistId, error);
        } finally {
          processedAnimeCount += 1;
        }
      }
    } catch (error) {
      for (const anilistId of anilistIds) {
        failedAnimeCount += 1;
        processedAnimeCount += 1;
        const message = error instanceof Error ? error.message : 'Unknown error';
        failed.push({ anilistId, message });
        await markAnimeStudioSyncFailedByAnilistId(anilistId, error);
      }
    }

    if (index + batchSize < candidates.length && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  return {
    selectedAnimeCount: candidates.length,
    processedAnimeCount,
    syncedAnimeCount,
    failedAnimeCount,
    failed,
    retryFailed,
    limit,
    batchSize,
    delayMs,
    hasMore: candidates.length === limit,
  };
}
