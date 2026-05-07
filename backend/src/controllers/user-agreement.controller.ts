import { Request, Response } from 'express';
import { getUserAgreementStatus, updateUserAgreements } from '../services/user-agreement.service';

function getErrorStatus(message: string) {
  if (
    message.includes('required') ||
    message.includes('must be') ||
    message.includes('At least one agreement field is required')
  ) {
    return 400;
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

export async function getMyAgreements(req: Request, res: Response) {
  try {
    const authUser = ensureAuth(req, res);

    if (!authUser) {
      return;
    }

    const item = await getUserAgreementStatus(authUser.userId);

    return res.json({
      success: true,
      item,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function updateMyAgreements(req: Request, res: Response) {
  try {
    const authUser = ensureAuth(req, res);

    if (!authUser) {
      return;
    }

    const item = await updateUserAgreements(authUser.userId, {
      termsAgreed: req.body.termsAgreed,
      termsVersion: req.body.termsVersion,
      privacyAgreed: req.body.privacyAgreed,
      privacyVersion: req.body.privacyVersion,
    });

    return res.json({
      success: true,
      message: 'User agreements updated successfully',
      item,
    });
  } catch (error) {
    return sendError(res, error);
  }
}
