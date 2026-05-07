import { Request, Response } from 'express';
import { getPublicUserProfile } from '../services/user-profile.service';
import {
  getRecommendedAnime,
  getUserAnimeStats,
  recalculateUserAnimeStats,
} from '../services/recommendation.service';

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

function parseUserId(value: unknown) {
  const userId = Number(value);

  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error('userId must be a positive integer');
  }

  return userId;
}

function getErrorStatus(message: string) {
  if (message.includes('must be') || message.includes('required')) {
    return 400;
  }

  if (message === 'Unauthorized') {
    return 401;
  }

  if (message === 'User not found') {
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

export async function getMyAnimeStats(req: Request, res: Response) {
  try {
    const authUser = ensureAuth(req, res);

    if (!authUser) {
      return;
    }

    const stats = await getUserAnimeStats(authUser.userId);

    return res.json({
      success: true,
      item: stats,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getUserStats(req: Request, res: Response) {
  try {
    const userId = parseUserId(req.params.userId);
    const user = await getPublicUserProfile(userId);
    const stats = await getUserAnimeStats(userId);

    return res.json({
      success: true,
      user,
      item: stats,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function recalculateMyAnimeStats(req: Request, res: Response) {
  try {
    const authUser = ensureAuth(req, res);

    if (!authUser) {
      return;
    }

    const stats = await recalculateUserAnimeStats(authUser.userId);

    return res.json({
      success: true,
      message: 'User anime stats recalculated',
      item: stats,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getMyRecommendations(req: Request, res: Response) {
  try {
    const authUser = ensureAuth(req, res);

    if (!authUser) {
      return;
    }

    const titleLanguage = parseTitleLanguage(req.query.titleLanguage);
    const limit = parseLimit(req.query.limit);
    const result = await getRecommendedAnime(authUser.userId, titleLanguage, limit);

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    return sendError(res, error);
  }
}
