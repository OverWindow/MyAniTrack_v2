import { fetchAnimePage, fetchSeasonAnimePage } from './anilist.client';
import { upsertAnimeFull } from './anime.repository';

const ANILIST_REQUEST_DELAY_MS = 2500;
const ANILIST_CHUNK_DELAY_MS = 10000;

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
