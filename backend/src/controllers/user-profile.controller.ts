import { Request, Response } from 'express';
import { getPublicUserProfile, updateUserProfile } from '../services/user-profile.service';

function parseUserId(value: unknown) {
  const userId = Number(value);

  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error('userId must be a positive integer');
  }

  return userId;
}

function getErrorStatus(message: string) {
  if (
    message.includes('must be') ||
    message.includes('required') ||
    message === 'At least one profile field is required'
  ) {
    return 400;
  }

  if (message === 'Username already exists') {
    return 409;
  }

  if (message === 'User not found') {
    return 404;
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

export async function getUserProfile(req: Request, res: Response) {
  try {
    const userId = parseUserId(req.params.userId);
    const user = await getPublicUserProfile(userId);

    return res.json({
      success: true,
      user,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function updateMyProfile(req: Request, res: Response) {
  try {
    const authUser = req.authUser;

    if (!authUser) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const user = await updateUserProfile({
      userId: authUser.userId,
      username: req.body.username,
      removeProfileImage: req.body.removeProfileImage,
      profileImage: req.file,
    });

    return res.json({
      success: true,
      message: 'Profile updated successfully',
      user,
    });
  } catch (error) {
    return sendError(res, error);
  }
}
