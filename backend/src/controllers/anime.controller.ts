import { Request, Response } from 'express';
import {
  AnimeGenre,
  AnimeSortOption,
  AnimeTitleLanguage,
  getAnimeDetailById,
  getAnimeList,
} from '../services/anime.service';

const SORT_OPTIONS: AnimeSortOption[] = ['latest', 'score', 'season'];
const TITLE_LANGUAGE_OPTIONS: AnimeTitleLanguage[] = ['ko', 'en', 'ja'];
const GENRE_OPTIONS: AnimeGenre[] = [
  'Action',
  'Adventure',
  'Drama',
  'Sci-Fi',
  'Mystery',
  'Comedy',
  'Supernatural',
  'Fantasy',
  'Sports',
  'Romance',
  'Slice of Life',
  'Horror',
  'Psychological',
  'Thriller',
  'Ecchi',
  'Mecha',
  'Music',
  'Mahou Shoujo',
  'Hentai',
];

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

function parseGenre(value: unknown): AnimeGenre | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string' || !GENRE_OPTIONS.includes(value as AnimeGenre)) {
    throw new Error(`genre must be one of ${GENRE_OPTIONS.join(', ')}`);
  }

  return value as AnimeGenre;
}

function parseAnimeId(value: string): number {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('anime id must be a positive integer');
  }

  return id;
}

function sendError(res: Response, error: unknown, extraBadRequestChecks: string[] = []) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  const statusCode = message.includes('must be')
    || message === 'Invalid cursor'
    || message.includes('Cursor sort')
    || extraBadRequestChecks.some((pattern) => message.includes(pattern) || message === pattern)
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

export async function getAnimeIndex(req: Request, res: Response) {
  try {
    const sort = parseSort(req.query.sort);
    const titleLanguage = parseTitleLanguage(req.query.titleLanguage);
    const genre = parseGenre(req.query.genre);
    const limit = parseLimit(req.query.limit);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;

    const result = await getAnimeList({
      sort,
      titleLanguage,
      genre,
      limit,
      cursor,
    });

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function searchAnime(req: Request, res: Response) {
  try {
    const sort = parseSort(req.query.sort);
    const titleLanguage = parseTitleLanguage(req.query.titleLanguage);
    const genre = parseGenre(req.query.genre);
    const limit = parseLimit(req.query.limit);
    const query = parseSearchQuery(req.query.query);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;

    const result = await getAnimeList({
      sort,
      titleLanguage,
      query,
      genre,
      limit,
      cursor,
    });

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    return sendError(res, error, ['Cursor query', 'Cursor genre', 'query is required']);
  }
}

export async function getAnimeById(req: Request, res: Response) {
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
}
