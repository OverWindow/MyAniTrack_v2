import { RowDataPacket } from 'mysql2/promise';
import { pool } from '../config/db';
import { fetchAnimePage, fetchAnimeStudiosByAnilistIds, fetchSeasonAnimePage } from './anilist.client';
import { markAnimeStudioSyncFailedByAnilistId, upsertAnimeFull, upsertAnimeStudiosOnly } from './anime.repository';

const ANILIST_REQUEST_DELAY_MS = 2500;
const ANILIST_CHUNK_DELAY_MS = 10000;

interface StudioBackfillAnimeRow extends RowDataPacket {
  id: number;
  anilistId: number;
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
  maxPages?: number
) {
  const currentSeason = getCurrentSeason();
  const targetSeason = season ?? currentSeason.season;
  const targetSeasonYear = seasonYear ?? currentSeason.seasonYear;

  let page = startPage;
  let processedPages = 0;
  let totalAnime = 0;
  let hasNextPage = true;

  while (hasNextPage) {
    const result = await fetchSeasonAnimePage(targetSeason, targetSeasonYear, page, perPage);

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
    season: targetSeason,
    seasonYear: targetSeasonYear,
    processedPages,
    totalAnime,
    nextPage: hasNextPage ? page : null,
    finished: !hasNextPage,
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
