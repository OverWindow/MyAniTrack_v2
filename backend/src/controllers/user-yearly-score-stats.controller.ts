import { Request, Response } from 'express';
import { getPublicUserProfile } from '../services/user-profile.service';
import {
  getUserYearlyScoreStats,
  validateYearlyScoreStatsMinimumCount,
  validateYearlyScoreStatsStatus,
} from '../services/user-yearly-score-stats.service';

function parseUserId(value: unknown) {
  const userId = Number(value);

  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error('userId must be a positive integer');
  }

  return userId;
}

function getErrorStatus(message: string) {
  if (message.includes('must be')) {
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

function buildParams(req: Request, userId: number) {
  return {
    userId,
    status: validateYearlyScoreStatsStatus(req.query.status),
    minRatedAnimeCount: validateYearlyScoreStatsMinimumCount(req.query.minRatedAnimeCount),
  };
}

export async function getMyYearlyScoreStats(req: Request, res: Response) {
  try {
    const authUser = ensureAuth(req, res);

    if (!authUser) {
      return;
    }

    const item = await getUserYearlyScoreStats(buildParams(req, authUser.userId));

    return res.json({
      success: true,
      item,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getUserYearlyScoreStatsController(req: Request, res: Response) {
  try {
    const userId = parseUserId(req.params.userId);
    const user = await getPublicUserProfile(userId);
    const item = await getUserYearlyScoreStats(buildParams(req, userId));

    return res.json({
      success: true,
      user,
      item,
    });
  } catch (error) {
    return sendError(res, error);
  }
}
