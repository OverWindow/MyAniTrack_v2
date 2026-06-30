import { Request, Response } from 'express';
import { AnimeTitleLanguage } from '../services/anime.service';
import {
  ensureUserExists,
  getUserVoiceActorAnime,
  getUserVoiceActorRanking,
  validateMinimumCount,
  validateVoiceActorId,
  validateVoiceActorRankingSort,
  validateVoiceActorStatsLimit,
} from '../services/user-voice-actor-stats.service';

const TITLE_LANGUAGE_OPTIONS: AnimeTitleLanguage[] = ['ko', 'en', 'ja'];

function sendError(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  const statusCode = message.includes('must be')
    || message === 'Invalid cursor'
    || message.includes('Cursor')
    ? 400
    : message === 'User not found' || message === 'Voice actor not found'
      ? 404
      : 500;

  if (statusCode === 500) {
    console.error(error);
  }

  return res.status(statusCode).json({
    success: false,
    message,
  });
}

function parseUserId(value: unknown) {
  const userId = Number(value);

  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error('userId must be a positive integer');
  }

  return userId;
}

function parseTitleLanguage(value: unknown): AnimeTitleLanguage {
  const titleLanguage = typeof value === 'string' ? value : 'ko';

  if (!TITLE_LANGUAGE_OPTIONS.includes(titleLanguage as AnimeTitleLanguage)) {
    throw new Error('titleLanguage must be one of ko, en, ja');
  }

  return titleLanguage as AnimeTitleLanguage;
}

async function getVoiceActorRankingForUser(req: Request, res: Response, userId: number) {
  const sort = validateVoiceActorRankingSort(req.query.sort);
  const limit = validateVoiceActorStatsLimit(req.query.limit);
  const minAnimeCount = validateMinimumCount(req.query.minAnimeCount, 'minAnimeCount');
  const minRatedAnimeCount = validateMinimumCount(req.query.minRatedAnimeCount, 'minRatedAnimeCount');
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;

  await ensureUserExists(userId);

  const result = await getUserVoiceActorRanking({
    userId,
    sort,
    limit,
    minAnimeCount,
    minRatedAnimeCount,
    cursor,
  });

  return res.json({
    success: true,
    userId,
    ...result,
  });
}

async function getVoiceActorAnimeForUser(req: Request, res: Response, userId: number) {
  const voiceActorId = validateVoiceActorId(req.params.voiceActorId);
  const titleLanguage = parseTitleLanguage(req.query.titleLanguage);
  const limit = validateVoiceActorStatsLimit(req.query.limit);
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;

  await ensureUserExists(userId);

  const result = await getUserVoiceActorAnime({
    userId,
    voiceActorId,
    titleLanguage,
    limit,
    cursor,
  });

  return res.json({
    success: true,
    userId,
    ...result,
  });
}

export async function getMyVoiceActorRanking(req: Request, res: Response) {
  try {
    const authUser = req.authUser;

    if (!authUser) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    return await getVoiceActorRankingForUser(req, res, authUser.userId);
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getUserVoiceActorRankingController(req: Request, res: Response) {
  try {
    const userId = parseUserId(req.params.userId);
    return await getVoiceActorRankingForUser(req, res, userId);
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getMyVoiceActorAnime(req: Request, res: Response) {
  try {
    const authUser = req.authUser;

    if (!authUser) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    return await getVoiceActorAnimeForUser(req, res, authUser.userId);
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getUserVoiceActorAnimeController(req: Request, res: Response) {
  try {
    const userId = parseUserId(req.params.userId);
    return await getVoiceActorAnimeForUser(req, res, userId);
  } catch (error) {
    return sendError(res, error);
  }
}
