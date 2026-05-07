import { Request, Response } from 'express';
import { getPlatformStats, getTopPopularAnime } from '../services/platform-stats.service';

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

export async function getPopularAnimeList(_req: Request, res: Response) {
  try {
    const items = await getTopPopularAnime();

    return res.json({
      success: true,
      items,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
