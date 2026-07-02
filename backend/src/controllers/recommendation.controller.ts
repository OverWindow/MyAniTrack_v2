import { Request, Response } from 'express';
import { getPublicUserProfile } from '../services/user-profile.service';
import {
  getRecommendedAnime,
  getUserGenreBubbleChart,
  getUserAnimeStats,
  GenreBubbleCommunityScore,
  GenreBubbleStatus,
  GenreBubbleWeighting,
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

function parseTopLimit(value: unknown) {
  const limit = Number(value ?? 3);

  if (!Number.isInteger(limit) || limit <= 0 || limit > 10) {
    throw new Error('topLimit must be an integer between 1 and 10');
  }

  return limit;
}

function parseMinCount(value: unknown) {
  const minCount = Number(value ?? 5);

  if (!Number.isInteger(minCount) || minCount <= 0 || minCount > 100) {
    throw new Error('minCount must be an integer between 1 and 100');
  }

  return minCount;
}

function parseWeighting(value: unknown): GenreBubbleWeighting {
  const weighting = typeof value === 'string' ? value : 'fractional';

  if (weighting !== 'full' && weighting !== 'fractional') {
    throw new Error('weighting must be one of full, fractional');
  }

  return weighting;
}

function parseBubbleStatus(value: unknown): GenreBubbleStatus {
  const status = typeof value === 'string' ? value : 'completed';

  if (status !== 'all' && status !== 'completed') {
    throw new Error('status must be one of all, completed');
  }

  return status;
}

function parseCommunityScore(value: unknown): GenreBubbleCommunityScore {
  const communityScore = typeof value === 'string' ? value : 'average';

  if (communityScore !== 'average' && communityScore !== 'mean') {
    throw new Error('communityScore must be one of average, mean');
  }

  return communityScore;
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

export async function getMyGenreBubbleChart(req: Request, res: Response) {
  try {
    const authUser = ensureAuth(req, res);

    if (!authUser) {
      return;
    }

    const item = await getUserGenreBubbleChart(authUser.userId, {
      titleLanguage: parseTitleLanguage(req.query.titleLanguage),
      minCount: parseMinCount(req.query.minCount),
      weighting: parseWeighting(req.query.weighting),
      status: parseBubbleStatus(req.query.status),
      communityScore: parseCommunityScore(req.query.communityScore),
      topLimit: parseTopLimit(req.query.topLimit),
    });

    return res.json({
      success: true,
      item,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getUserGenreBubbleChartController(req: Request, res: Response) {
  try {
    const userId = parseUserId(req.params.userId);
    const user = await getPublicUserProfile(userId);
    const item = await getUserGenreBubbleChart(userId, {
      titleLanguage: parseTitleLanguage(req.query.titleLanguage),
      minCount: parseMinCount(req.query.minCount),
      weighting: parseWeighting(req.query.weighting),
      status: parseBubbleStatus(req.query.status),
      communityScore: parseCommunityScore(req.query.communityScore),
      topLimit: parseTopLimit(req.query.topLimit),
    });

    return res.json({
      success: true,
      user,
      item,
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
