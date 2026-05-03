import { Router, Request, Response } from 'express';
import {
  AnimeSortOption,
  AnimeTitleLanguage,
  getAnimeDetailById,
  getAnimeList,
} from '../services/anime.service';

const router = Router();

const SORT_OPTIONS: AnimeSortOption[] = ['latest', 'score', 'season'];
const TITLE_LANGUAGE_OPTIONS: AnimeTitleLanguage[] = ['ko', 'en', 'ja'];

function parseSort(value: unknown): AnimeSortOption {
  const sort = typeof value === 'string' ? value : 'latest';

  if (!SORT_OPTIONS.includes(sort as AnimeSortOption)) {
    throw new Error('sort must be one of latest, score, season');
  }

  return sort as AnimeSortOption;
}

function parseTitleLanguage(value: unknown): AnimeTitleLanguage {
  const titleLanguage = typeof value === 'string' ? value : 'ko';

  if (!TITLE_LANGUAGE_OPTIONS.includes(titleLanguage as AnimeTitleLanguage)) {
    throw new Error('titleLanguage must be one of ko, en, ja');
  }

  return titleLanguage as AnimeTitleLanguage;
}

function parseLimit(value: unknown): number {
  const limit = Number(value ?? 20);

  if (!Number.isInteger(limit) || limit <= 0 || limit > 50) {
    throw new Error('limit must be an integer between 1 and 50');
  }

  return limit;
}

function parseSearchQuery(value: unknown): string {
  const query = typeof value === 'string' ? value.trim() : '';

  if (!query) {
    throw new Error('query is required');
  }

  return query;
}

function parseAnimeId(value: string): number {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('anime id must be a positive integer');
  }

  return id;
}

router.get('/anime', async (req: Request, res: Response) => {
  try {
    const sort = parseSort(req.query.sort);
    const titleLanguage = parseTitleLanguage(req.query.titleLanguage);
    const limit = parseLimit(req.query.limit);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;

    const result = await getAnimeList({
      sort,
      titleLanguage,
      limit,
      cursor,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const statusCode = message.includes('must be') || message === 'Invalid cursor' || message.includes('Cursor sort')
      ? 400
      : 500;

    if (statusCode === 500) {
      console.error(error);
    }

    res.status(statusCode).json({
      success: false,
      message,
    });
  }
});

router.get('/anime/search', async (req: Request, res: Response) => {
  try {
    const sort = parseSort(req.query.sort);
    const titleLanguage = parseTitleLanguage(req.query.titleLanguage);
    const limit = parseLimit(req.query.limit);
    const query = parseSearchQuery(req.query.query);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;

    const result = await getAnimeList({
      sort,
      titleLanguage,
      query,
      limit,
      cursor,
    });

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const statusCode = (
      message.includes('must be')
      || message === 'Invalid cursor'
      || message.includes('Cursor sort')
      || message.includes('Cursor query')
      || message === 'query is required'
    )
      ? 400
      : 500;

    if (statusCode === 500) {
      console.error(error);
    }

    return res.status(statusCode).json({
      success: false,
      message,
    });
  }
});

router.get('/anime/:id', async (req: Request, res: Response) => {
  try {
    const animeIdParam = typeof req.params.id === 'string' ? req.params.id : '';
    const animeId = parseAnimeId(animeIdParam);
    const titleLanguage = parseTitleLanguage(req.query.titleLanguage);
    const anime = await getAnimeDetailById(animeId, titleLanguage);

    if (!anime) {
      return res.status(404).json({
        success: false,
        message: 'Anime not found',
      });
    }

    return res.json({
      success: true,
      item: anime,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const statusCode = message.includes('must be') ? 400 : 500;

    if (statusCode === 500) {
      console.error(error);
    }

    return res.status(statusCode).json({
      success: false,
      message,
    });
  }
});

export default router;
