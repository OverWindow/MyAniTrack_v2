import { Request, Response, Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
  addAnimeToUserList,
  getUserAnimeList,
  removeAnimeFromUserList,
  updateUserAnimeListItem,
  validateUserAnimeListGenre,
  validateUserAnimeListLimit,
  validateUserAnimeListSort,
  validateUserAnimeListTitleLanguage,
} from '../services/user-anime-list.service';

const router = Router();

function parseAnimeId(value: unknown) {
  const animeId = Number(value);

  if (!Number.isInteger(animeId) || animeId <= 0) {
    throw new Error('animeId must be a positive integer');
  }

  return animeId;
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
    message === 'User anime list item not found'
  ) {
    return 404;
  }

  return 500;
}

router.post('/me/anime-list', requireAuth, async (req: Request, res: Response) => {
  try {
    const authUser = req.authUser;

    if (!authUser) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const animeId = parseAnimeId(req.body.animeId);
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

router.get('/me/anime-list', requireAuth, async (req: Request, res: Response) => {
  try {
    const authUser = req.authUser;

    if (!authUser) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
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

router.patch('/me/anime-list/:animeId', requireAuth, async (req: Request, res: Response) => {
  try {
    const authUser = req.authUser;

    if (!authUser) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const animeId = parseAnimeId(req.params.animeId);
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

router.delete('/me/anime-list/:animeId', requireAuth, async (req: Request, res: Response) => {
  try {
    const authUser = req.authUser;

    if (!authUser) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const animeId = parseAnimeId(req.params.animeId);
    await removeAnimeFromUserList(authUser.userId, animeId);

    return res.json({
      success: true,
      message: 'Anime removed from user list',
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
