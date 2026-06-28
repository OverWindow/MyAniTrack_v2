import { Request, Response } from 'express';
import { getPublicUserProfile } from '../services/user-profile.service';
import {
  getMyBadgeList,
  getPublicUserBadgeList,
  recalculateAllUserBadges,
  recalculateUserBadges,
} from '../services/badge.service';

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

export async function getMyBadges(req: Request, res: Response) {
  try {
    const authUser = ensureAuth(req, res);

    if (!authUser) {
      return;
    }

    const result = await getMyBadgeList(authUser.userId);

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getUserBadges(req: Request, res: Response) {
  try {
    const userId = parseUserId(req.params.userId);
    const user = await getPublicUserProfile(userId);
    const result = await getPublicUserBadgeList(userId);

    return res.json({
      success: true,
      user,
      ...result,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function recalculateMyBadges(req: Request, res: Response) {
  try {
    const authUser = ensureAuth(req, res);

    if (!authUser) {
      return;
    }

    const result = await recalculateUserBadges(authUser.userId);
    const badgeList = await getMyBadgeList(authUser.userId);

    return res.json({
      success: true,
      message: 'User badges recalculated',
      newlyEarned: result.newlyEarned,
      revokedCount: result.revokedCount,
      items: badgeList.items,
      earnedCount: badgeList.earnedCount,
      totalCount: badgeList.totalCount,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function recalculateEveryUserBadges(req: Request, res: Response) {
  try {
    const authUser = ensureAuth(req, res);

    if (!authUser) {
      return;
    }

    if (authUser.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    const result = await recalculateAllUserBadges();

    return res.json({
      success: true,
      message: 'All user badges recalculated',
      ...result,
    });
  } catch (error) {
    return sendError(res, error);
  }
}
