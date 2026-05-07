import { Request, Response } from 'express';
import { getPublicUserProfile } from '../services/user-profile.service';
import {
  addAnimeToUserList,
  getMyAnimeRelation,
  getUserAnimeList,
  removeAnimeFromUserList,
  updateUserAnimeListItem,
  validateUserAnimeListGenre,
  validateUserAnimeListLimit,
  validateUserAnimeListSort,
  validateUserAnimeListTitleLanguage,
} from '../services/user-anime-list.service';

function parsePositiveInteger(value: unknown, fieldName: string) {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }

  return parsedValue;
}

function getErrorStatus(message: string) {
  if (
    message.includes('must be') ||
    message.includes('required') ||
    message === 'At least one field is required to update' ||
    message === 'Invalid cursor' ||
    message.includes('Cursor sort') ||
    message.includes('Cursor genre')
  ) {
    return 400;
  }

  if (message === 'Anime is already in the user list') {
    return 409;
  }

  if (
    message === 'Anime not found' ||
    message === 'User anime list item not found' ||
    message === 'User not found'
  ) {
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

export async function createMyAnimeListItem(req: Request, res: Response) {
  try {
    const authUser = ensureAuth(req, res);

    if (!authUser) {
      return;
    }

    const animeId = parsePositiveInteger(req.body.animeId, 'animeId');
    const item = await addAnimeToUserList(authUser.userId, animeId, {
      status: req.body.status,
      score: req.body.score,
      progress: req.body.progress,
      startedAt: req.body.startedAt,
      completedAt: req.body.completedAt,
      notes: req.body.notes,
    });

    return res.status(201).json({
      success: true,
      message: 'Anime added to user list',
      item,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getMyAnimeList(req: Request, res: Response) {
  try {
    const authUser = ensureAuth(req, res);

    if (!authUser) {
      return;
    }

    const sort = validateUserAnimeListSort(typeof req.query.sort === 'string' ? req.query.sort : 'latest');
    const titleLanguage = validateUserAnimeListTitleLanguage(
      typeof req.query.titleLanguage === 'string' ? req.query.titleLanguage : 'ko'
    );
    const genre = validateUserAnimeListGenre(req.query.genre);
    const limit = validateUserAnimeListLimit(req.query.limit);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;

    const result = await getUserAnimeList({
      userId: authUser.userId,
      sort,
      titleLanguage,
      genre,
      limit,
      cursor,
    });

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getUserAnimeListController(req: Request, res: Response) {
  try {
    const userId = parsePositiveInteger(req.params.userId, 'userId');
    const user = await getPublicUserProfile(userId);
    const sort = validateUserAnimeListSort(typeof req.query.sort === 'string' ? req.query.sort : 'latest');
    const titleLanguage = validateUserAnimeListTitleLanguage(
      typeof req.query.titleLanguage === 'string' ? req.query.titleLanguage : 'ko'
    );
    const genre = validateUserAnimeListGenre(req.query.genre);
    const limit = validateUserAnimeListLimit(req.query.limit);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;

    const result = await getUserAnimeList({
      userId,
      sort,
      titleLanguage,
      genre,
      limit,
      cursor,
    });

    return res.json({
      success: true,
      user,
      ...result,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getMyAnimeRelationController(req: Request, res: Response) {
  try {
    const authUser = ensureAuth(req, res);

    if (!authUser) {
      return;
    }

    const animeId = parsePositiveInteger(req.params.animeId, 'animeId');
    const titleLanguage = validateUserAnimeListTitleLanguage(
      typeof req.query.titleLanguage === 'string' ? req.query.titleLanguage : 'ko'
    );

    const item = await getMyAnimeRelation(authUser.userId, animeId, titleLanguage);

    return res.json({
      success: true,
      item,
    });
  } catch (error) {
    return sendError(res, error);
  }
}
export async function updateMyAnimeListItem(req: Request, res: Response) {
  try {
    const authUser = ensureAuth(req, res);

    if (!authUser) {
      return;
    }

    const animeId = parsePositiveInteger(req.params.animeId, 'animeId');
    const item = await updateUserAnimeListItem(authUser.userId, animeId, {
      status: req.body.status,
      score: req.body.score,
      progress: req.body.progress,
      startedAt: req.body.startedAt,
      completedAt: req.body.completedAt,
      notes: req.body.notes,
    });

    return res.json({
      success: true,
      message: 'User anime list updated',
      item,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function deleteMyAnimeListItem(req: Request, res: Response) {
  try {
    const authUser = ensureAuth(req, res);

    if (!authUser) {
      return;
    }

    const animeId = parsePositiveInteger(req.params.animeId, 'animeId');
    await removeAnimeFromUserList(authUser.userId, animeId);

    return res.json({
      success: true,
      message: 'Anime removed from user list',
    });
  } catch (error) {
    return sendError(res, error);
  }
}

