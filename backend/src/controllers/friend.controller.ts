import { Request, Response } from 'express';
import {
  getFriendRequests,
  getFriends,
  removeFriend,
  respondToFriendRequest,
  sendFriendRequest,
} from '../services/friend.service';

function parsePositiveInteger(value: unknown, fieldName: string) {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }

  return parsedValue;
}

function parseOptionalUsername(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new Error('username must be a string');
  }

  const normalizedUsername = value.trim();

  if (!normalizedUsername) {
    throw new Error('username must not be empty');
  }

  return normalizedUsername;
}

function parseFriendRequestAction(value: unknown) {
  if (value === 'accept' || value === 'reject' || value === 'cancel') {
    return value;
  }

  throw new Error('action must be one of accept, reject, cancel');
}

function getFriendRequestActionMessage(action: 'accept' | 'reject' | 'cancel') {
  if (action === 'accept') {
    return 'Friend request accepted successfully';
  }

  if (action === 'reject') {
    return 'Friend request rejected successfully';
  }

  return 'Friend request cancelled successfully';
}

function getErrorStatus(message: string) {
  if (
    message.includes('must be') ||
    message.includes('cannot') ||
    message.includes('Only the') ||
    message.includes('already') ||
    message.includes('no longer pending') ||
    message.includes('Either receiverId or username is required')
  ) {
    return message.includes('already') ? 409 : 400;
  }

  if (
    message === 'Receiver user not found' ||
    message === 'Friend request not found' ||
    message === 'Friendship not found'
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

export async function createFriendRequest(req: Request, res: Response) {
  try {
    const authUser = ensureAuth(req, res);

    if (!authUser) {
      return;
    }

    const receiverId = req.body.receiverId === undefined
      ? undefined
      : parsePositiveInteger(req.body.receiverId, 'receiverId');
    const username = parseOptionalUsername(req.body.username);
    const item = await sendFriendRequest(authUser.userId, {
      receiverId,
      username,
    });

    return res.status(201).json({
      success: true,
      message: 'Friend request sent',
      item,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function listFriendRequests(req: Request, res: Response) {
  try {
    const authUser = ensureAuth(req, res);

    if (!authUser) {
      return;
    }

    const result = await getFriendRequests(authUser.userId);

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function updateFriendRequest(req: Request, res: Response) {
  try {
    const authUser = ensureAuth(req, res);

    if (!authUser) {
      return;
    }

    const requestId = parsePositiveInteger(req.params.requestId, 'requestId');
    const action = parseFriendRequestAction(req.body.action);
    const item = await respondToFriendRequest(authUser.userId, requestId, action);

    return res.json({
      success: true,
      message: getFriendRequestActionMessage(action),
      item,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function listFriends(req: Request, res: Response) {
  try {
    const authUser = ensureAuth(req, res);

    if (!authUser) {
      return;
    }

    const items = await getFriends(authUser.userId);

    return res.json({
      success: true,
      items,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function deleteFriend(req: Request, res: Response) {
  try {
    const authUser = ensureAuth(req, res);

    if (!authUser) {
      return;
    }

    const friendUserId = parsePositiveInteger(req.params.friendUserId, 'friendUserId');
    await removeFriend(authUser.userId, friendUserId);

    return res.json({
      success: true,
      message: 'Friend removed successfully',
    });
  } catch (error) {
    return sendError(res, error);
  }
}
