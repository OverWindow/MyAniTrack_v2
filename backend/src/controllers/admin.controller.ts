import { Request, Response } from 'express';
import { syncAnimePage, syncAllAnime, syncAnimeInChunks, syncSeasonAnime } from '../../sync/anime.sync.service';
import { translateAnimeKoreanTitlesInBatches } from '../../translations/anime.korean-title.service';

function sendError(res: Response, error: unknown) {
  console.error(error);

  return res.status(500).json({
    success: false,
    message: error instanceof Error ? error.message : 'Unknown error',
  });
}

export async function syncAnimePageController(req: Request, res: Response) {
  try {
    const page = Number(req.body.page || 1);
    const perPage = Number(req.body.perPage || 50);

    const result = await syncAnimePage(page, perPage);

    return res.json({
      success: true,
      message: 'Anime page synced successfully',
      result,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function syncAllAnimeController(req: Request, res: Response) {
  try {
    const startPage = Number(req.body.startPage || 1);
    const perPage = Number(req.body.perPage || 50);
    const maxPages = req.body.maxPages ? Number(req.body.maxPages) : undefined;

    const result = await syncAllAnime(startPage, perPage, maxPages);

    return res.json({
      success: true,
      message: 'Anime sync completed',
      result,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function syncAnimeInChunksController(req: Request, res: Response) {
  try {
    const startPage = Number(req.body.startPage || 1);
    const perPage = Number(req.body.perPage || 50);
    const pagesPerChunk = Number(req.body.pagesPerChunk || 10);
    const chunkDelayMs = Number(req.body.chunkDelayMs || 10000);
    const maxChunks = req.body.maxChunks ? Number(req.body.maxChunks) : undefined;

    const result = await syncAnimeInChunks(
      startPage,
      perPage,
      pagesPerChunk,
      chunkDelayMs,
      maxChunks
    );

    return res.json({
      success: true,
      message: 'Anime chunked sync completed',
      result,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function syncSeasonAnimeController(req: Request, res: Response) {
  try {
    const season = req.body.season as 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL' | undefined;
    const seasonYear = req.body.seasonYear ? Number(req.body.seasonYear) : undefined;
    const startPage = Number(req.body.startPage || 1);
    const perPage = Number(req.body.perPage || 50);
    const maxPages = req.body.maxPages ? Number(req.body.maxPages) : undefined;

    const result = await syncSeasonAnime(
      season,
      seasonYear,
      startPage,
      perPage,
      maxPages
    );

    return res.json({
      success: true,
      message: 'Season anime sync completed',
      result,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function translateAnimeKoreanTitlesController(req: Request, res: Response) {
  try {
    const batchSize = Number(req.body.batchSize || 100);
    const maxBatches = Number(req.body.maxBatches || 1);

    const result = await translateAnimeKoreanTitlesInBatches(batchSize, maxBatches);

    return res.json({
      success: true,
      message: 'Anime Korean title translation completed',
      result,
    });
  } catch (error) {
    return sendError(res, error);
  }
}
