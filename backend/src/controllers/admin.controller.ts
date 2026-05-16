import { Request, Response } from 'express';
import { syncAnimePage, syncAllAnime, syncAnimeInChunks, syncSeasonAnime } from '../../sync/anime.sync.service';
import { translateAnimeKoreanTitlesInBatches } from '../../translations/anime.korean-title.service';
import { updateAnimeKoreanTitleByAdmin } from '../services/admin-korean-title.service';

function sendError(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  const statusCode = getErrorStatus(message);

  if (statusCode === 500) {
    console.error(error);
  }

  return res.status(statusCode).json({
    success: false,
    message,
  });
}

function getErrorStatus(message: string) {
  if (message.includes('must be') || message.includes('required')) {
    return 400;
  }

  if (message === 'Anime not found' || message === 'Korean title not found') {
    return 404;
  }

  return 500;
}

function parsePositiveInteger(value: unknown, fieldName: string) {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }

  return parsedValue;
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

export async function updateAnimeKoreanTitleController(req: Request, res: Response) {
  try {
    const authUser = req.authUser;

    if (!authUser) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const animeId = parsePositiveInteger(req.params.animeId, 'animeId');
    const item = await updateAnimeKoreanTitleByAdmin(authUser.userId, animeId, {
      title: req.body.title,
      subtitle: req.body.subtitle,
    });

    return res.json({
      success: true,
      message: 'Anime Korean title updated and locked',
      item,
    });
  } catch (error) {
    return sendError(res, error);
  }
}
