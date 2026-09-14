import { Request, Response } from 'express';
import {
  getGuestSampleAnimeList,
  getGuestSampleAnimeStats,
  getGuestSampleFormatStats,
  getGuestSampleGenreBubbleChart,
  getGuestSampleOverview,
  getGuestSampleStudioRanking,
  getGuestSampleYearlyScoreStats,
} from '../services/guest-sample.service';
import {
  validateUserAnimeListGenre,
  validateUserAnimeListLimit,
  validateUserAnimeListScoreFilter,
  validateUserAnimeListSort,
  validateUserAnimeListTitleLanguage,
  validateUserAnimeListYear,
} from '../services/user-anime-list.service';
import {
  validateFormatStatsMinimumCount,
  validateFormatStatsStatus,
} from '../services/user-format-stats.service';
import {
  validateYearlyScoreStatsMinimumCount,
  validateYearlyScoreStatsStatus,
} from '../services/user-yearly-score-stats.service';
import { validateStudioStatsSort } from '../services/user-studio-stats.service';

function getErrorStatus(message: string) {
  if (message.includes('must be') || message.includes('required')) {
    return 400;
  }

  return 500;
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

function validateLimit(value: unknown, defaultValue: number, maxValue: number) {
  const limit = Number(value ?? defaultValue);

  if (!Number.isInteger(limit) || limit <= 0 || limit > maxValue) {
    throw new Error(`limit must be an integer between 1 and ${maxValue}`);
  }

  return limit;
}

export async function getGuestSampleOverviewController(_req: Request, res: Response) {
  try {
    return res.json({
      success: true,
      item: getGuestSampleOverview(),
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getGuestSampleAnimeListController(req: Request, res: Response) {
  try {
    const result = getGuestSampleAnimeList({
      sort: validateUserAnimeListSort(typeof req.query.sort === 'string' ? req.query.sort : 'latest'),
      titleLanguage: validateUserAnimeListTitleLanguage(
        typeof req.query.titleLanguage === 'string' ? req.query.titleLanguage : 'ko'
      ),
      genre: validateUserAnimeListGenre(req.query.genre),
      year: validateUserAnimeListYear(req.query.year),
      score: validateUserAnimeListScoreFilter(req.query.score),
      limit: validateUserAnimeListLimit(req.query.limit),
    });

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getGuestSampleAnimeStatsController(_req: Request, res: Response) {
  try {
    return res.json({
      success: true,
      item: getGuestSampleAnimeStats(),
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getGuestSampleGenreBubbleChartController(_req: Request, res: Response) {
  try {
    return res.json({
      success: true,
      item: getGuestSampleGenreBubbleChart(),
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getGuestSampleYearlyScoreStatsController(req: Request, res: Response) {
  try {
    return res.json({
      success: true,
      item: getGuestSampleYearlyScoreStats(
        validateYearlyScoreStatsStatus(req.query.status),
        validateYearlyScoreStatsMinimumCount(req.query.minRatedAnimeCount)
      ),
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getGuestSampleFormatStatsController(req: Request, res: Response) {
  try {
    return res.json({
      success: true,
      item: getGuestSampleFormatStats(
        validateFormatStatsStatus(req.query.status),
        validateFormatStatsMinimumCount(req.query.minCount)
      ),
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getGuestSampleStudioRankingController(req: Request, res: Response) {
  try {
    const result = getGuestSampleStudioRanking(
      validateStudioStatsSort(req.query.sort),
      validateLimit(req.query.limit, 20, 50)
    );

    return res.json(result);
  } catch (error) {
    return sendError(res, error);
  }
}
