import { Request, Response } from 'express';
import { getPlatformStats, getTopPopularAnime } from '../services/platform-stats.service';

function parseLimit(value: unknown) {
  const limit = Number(value ?? 10);

  if (!Number.isInteger(limit) || limit <= 0 || limit > 50) {
    throw new Error('limit must be an integer between 1 and 50');
  }

  return limit;
}

export async function getPlatformSummary(_req: Request, res: Response) {
  try {
    const item = await getPlatformStats();

    return res.json({
      success: true,
      item,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

export async function getPopularAnimeList(req: Request, res: Response) {
  try {
    const limit = parseLimit(req.query.limit);
    const items = await getTopPopularAnime(limit);

    return res.json({
      success: true,
      limit,
      items,
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
