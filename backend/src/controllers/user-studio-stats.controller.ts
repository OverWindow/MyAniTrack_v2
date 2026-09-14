import { Request, Response } from 'express';
import { AnimeTitleLanguage } from '../services/anime.service';
import { getPublicUserProfile } from '../services/user-profile.service';
import {
  getUserStudioAnime,
  getUserStudioRanking,
  validateStudioId,
  validateStudioStatsBoolean,
  validateStudioStatsLimit,
  validateStudioStatsMinimumCount,
  validateStudioStatsSort,
  validateStudioStatsStatus,
} from '../services/user-studio-stats.service';

function parseTitleLanguage(value: unknown): AnimeTitleLanguage {
  if (value === 'ko' || value === 'en' || value === 'ja') {
    return value;
  }

  return 'ko';
}

function parseUserId(value: unknown) {
  const userId = Number(value);

  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error('userId must be a positive integer');
  }

  return userId;
}

function getErrorStatus(message: string) {
  if (
    message.includes('must be')
    || message === 'Invalid cursor'
    || message.includes('Cursor does not match')
  ) {
    return 400;
  }

  if (message === 'Unauthorized') {
    return 401;
  }

  if (message === 'User not found' || message === 'Studio not found') {
    return 404;
  }

  return 500;
}

function ensureAuth(req: Request, res: Response) {
  const authUser = req.authUser;

  if (!authUser) {
    res.status(401).json({
      success: false,
      message: 'Unauthorized',
    });

    return null;
  }

  return authUser;
}

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

function buildRankingParams(req: Request, userId: number) {
  return {
    userId,
    sort: validateStudioStatsSort(req.query.sort),
    status: validateStudioStatsStatus(req.query.status),
    mainOnly: validateStudioStatsBoolean(req.query.mainOnly, true),
    minAnimeCount: validateStudioStatsMinimumCount(req.query.minAnimeCount, 'minAnimeCount', 1),
    minRatedAnimeCount: validateStudioStatsMinimumCount(req.query.minRatedAnimeCount, 'minRatedAnimeCount', 1),
    limit: validateStudioStatsLimit(req.query.limit),
    cursor: typeof req.query.cursor === 'string' ? req.query.cursor : undefined,
  };
}

function buildAnimeParams(req: Request, userId: number) {
  return {
    userId,
    studioId: validateStudioId(req.params.studioId),
    titleLanguage: parseTitleLanguage(req.query.titleLanguage),
    status: validateStudioStatsStatus(req.query.status),
    mainOnly: validateStudioStatsBoolean(req.query.mainOnly, true),
    limit: validateStudioStatsLimit(req.query.limit),
    cursor: typeof req.query.cursor === 'string' ? req.query.cursor : undefined,
  };
}

export async function getMyStudioRanking(req: Request, res: Response) {
  try {
    const authUser = ensureAuth(req, res);

    if (!authUser) {
      return;
    }

    const result = await getUserStudioRanking(buildRankingParams(req, authUser.userId));

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getUserStudioRankingController(req: Request, res: Response) {
  try {
    const userId = parseUserId(req.params.userId);
    const user = await getPublicUserProfile(userId);
    const result = await getUserStudioRanking(buildRankingParams(req, userId));

    return res.json({
      success: true,
      user,
      ...result,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getMyStudioAnime(req: Request, res: Response) {
  try {
    const authUser = ensureAuth(req, res);

    if (!authUser) {
      return;
    }

    const result = await getUserStudioAnime(buildAnimeParams(req, authUser.userId));

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getUserStudioAnimeController(req: Request, res: Response) {
  try {
    const userId = parseUserId(req.params.userId);
    const user = await getPublicUserProfile(userId);
    const result = await getUserStudioAnime(buildAnimeParams(req, userId));

    return res.json({
      success: true,
      user,
      ...result,
    });
  } catch (error) {
    return sendError(res, error);
  }
}
