import crypto from 'crypto';
import { Request, Response } from 'express';
import { SupabaseStorageError } from '../lib/supabase-storage';
import { getPublicUserProfile, updateUserProfile } from '../services/user-profile.service';
import { getUserAgreementStatus } from '../services/user-agreement.service';

function parseUserId(value: unknown) {
  const userId = Number(value);

  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error('userId must be a positive integer');
  }

  return userId;
}

function getErrorStatus(error: unknown) {
  if (error instanceof SupabaseStorageError) {
    return 502;
  }

  const message = error instanceof Error ? error.message : 'Unknown error';

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

function sendError(
  res: Response,
  error: unknown,
  context?: { requestId: string; userId?: number },
) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  const statusCode = getErrorStatus(error);

  if (statusCode === 500) {
    console.error(JSON.stringify({
      event: 'profile_update',
      stage: 'request_failed',
      requestId: context?.requestId,
      userId: context?.userId,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    }));
  }

  const responseMessage = statusCode === 502
    ? '프로필 이미지 저장소에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.'
    : statusCode === 500
      ? '프로필을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.'
      : message;

  return res.status(statusCode).json({
    success: false,
    message: responseMessage,
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
  const requestId = req.header('x-request-id')?.trim() || crypto.randomUUID();
  res.setHeader('x-request-id', requestId);
  const userId = req.authUser?.userId;
  const trace = (stage: string, details?: Record<string, unknown>) => {
    console.info(JSON.stringify({
      event: 'profile_update',
      stage,
      requestId,
      userId,
      ...details,
    }));
  };

  try {
    const authUser = req.authUser;

    if (!authUser) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    trace('request_received', {
      hasImage: Boolean(req.file),
      removeProfileImage: req.body.removeProfileImage === 'true',
      mimeType: req.file?.mimetype,
      size: req.file?.size,
    });

    if (req.file) {
      const agreements = await getUserAgreementStatus(authUser.userId);
      if (!agreements.hasRequiredAgreements) {
        return res.status(403).json({
          success: false,
          message: 'Current terms agreement is required before uploading a profile image',
        });
      }
    }

    const user = await updateUserProfile({
      userId: authUser.userId,
      username: req.body.username,
      removeProfileImage: req.body.removeProfileImage,
      profileImage: req.file,
      trace,
    });

    trace('request_succeeded');

    return res.json({
      success: true,
      message: 'Profile updated successfully',
      user,
    });
  } catch (error) {
    return sendError(res, error, { requestId, userId });
  }
}
