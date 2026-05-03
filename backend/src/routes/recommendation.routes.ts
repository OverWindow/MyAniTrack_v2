import { Request, Response, Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
  getRecommendedAnime,
  getUserAnimeStats,
  recalculateUserAnimeStats,
} from '../services/recommendation.service';

const router = Router();

function parseTitleLanguage(value: unknown): 'ko' | 'en' | 'ja' {
  if (value === 'ko' || value === 'en' || value === 'ja') {
    return value;
  }

  return 'ko';
}

function parseLimit(value: unknown) {
  const limit = Number(value ?? 20);

  if (!Number.isInteger(limit) || limit <= 0 || limit > 50) {
    throw new Error('limit must be an integer between 1 and 50');
  }

  return limit;
}

function getErrorStatus(message: string) {
  if (message.includes('must be') || message.includes('required')) {
    return 400;
  }

  if (message === 'Unauthorized') {
    return 401;
  }

  return 500;
}

router.get('/me/anime-stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const authUser = req.authUser;

    if (!authUser) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const stats = await getUserAnimeStats(authUser.userId);

    return res.json({
      success: true,
      item: stats,
    });
  } catch (error) {
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
});

router.post('/me/anime-stats/recalculate', requireAuth, async (req: Request, res: Response) => {
  try {
    const authUser = req.authUser;

    if (!authUser) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const stats = await recalculateUserAnimeStats(authUser.userId);

    return res.json({
      success: true,
      message: 'User anime stats recalculated',
      item: stats,
    });
  } catch (error) {
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
});

router.get('/me/recommendations', requireAuth, async (req: Request, res: Response) => {
  try {
    const authUser = req.authUser;

    if (!authUser) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const titleLanguage = parseTitleLanguage(req.query.titleLanguage);
    const limit = parseLimit(req.query.limit);
    const result = await getRecommendedAnime(authUser.userId, titleLanguage, limit);

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
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
});

export default router;
