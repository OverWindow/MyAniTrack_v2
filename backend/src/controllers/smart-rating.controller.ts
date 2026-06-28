import { Request, Response } from 'express';
import {
  estimateSmartRating,
  getSmartRatingCandidates,
} from '../services/smart-rating.service';
import { validateUserAnimeListTitleLanguage } from '../services/user-anime-list.service';

function parsePositiveInteger(value: unknown, fieldName: string) {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }

  return parsedValue;
}

function parseCandidateLimit(value: unknown) {
  const limit = Number(value ?? 5);

  if (!Number.isInteger(limit) || limit <= 0 || limit > 5) {
    throw new Error('limit must be an integer between 1 and 5');
  }

  return limit;
}

function getErrorStatus(message: string) {
  if (
    message.includes('must be') ||
    message.includes('required') ||
    message.includes('At least one rated anime') ||
    message.includes('comparisons') ||
    message.includes('All comparison anime')
  ) {
    return 400;
  }

  if (message === 'Unauthorized') {
    return 401;
  }

  if (message === 'Anime not found') {
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

export async function getSmartRatingCandidatesController(req: Request, res: Response) {
  try {
    const authUser = ensureAuth(req, res);

    if (!authUser) {
      return;
    }

    const targetAnimeId = parsePositiveInteger(req.query.targetAnimeId, 'targetAnimeId');
    const titleLanguage = validateUserAnimeListTitleLanguage(
      typeof req.query.titleLanguage === 'string' ? req.query.titleLanguage : 'ko'
    );
    const limit = parseCandidateLimit(req.query.limit);
    const result = await getSmartRatingCandidates({
      userId: authUser.userId,
      targetAnimeId,
      titleLanguage,
      limit,
    });

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function estimateSmartRatingController(req: Request, res: Response) {
  try {
    const authUser = ensureAuth(req, res);

    if (!authUser) {
      return;
    }

    const targetAnimeId = parsePositiveInteger(req.body.targetAnimeId, 'targetAnimeId');
    const result = await estimateSmartRating({
      userId: authUser.userId,
      targetAnimeId,
      comparisons: req.body.comparisons,
    });

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    return sendError(res, error);
  }
}
