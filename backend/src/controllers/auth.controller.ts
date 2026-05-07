import { Request, Response } from 'express';
import {
  checkUsernameAvailability,
  getMyProfile,
  login,
  logout,
  logoutAll,
  refreshSession,
  requestPasswordReset,
  resetPasswordWithEmailToken,
  sendSignupVerificationEmail,
  signUp,
  verifySignupEmail,
} from '../services/auth.service';

function getErrorStatus(message: string) {
  if (
    message.includes('required') ||
    message.includes('must be') ||
    message.includes('already exists') ||
    message.includes('Invalid verification token') ||
    message.includes('Verification token has') ||
    message.includes('Invalid password reset token') ||
    message.includes('Password reset token has') ||
    message === 'Email already verified'
  ) {
    return 400;
  }

  if (message === 'Email verification required') {
    return 403;
  }

  if (message === 'Invalid email or password') {
    return 401;
  }

  if (
    message === 'Invalid refresh token' ||
    message === 'Refresh token has expired' ||
    message === 'Refresh token has been revoked' ||
    message === 'Authorization token is required' ||
    message === 'Invalid token' ||
    message === 'Token expired'
  ) {
    return 401;
  }

  if (message === 'User not found') {
    return 404;
  }

  return 500;
}

function getClientMetadata(req: Request) {
  return {
    deviceType: typeof req.body.deviceType === 'string' ? req.body.deviceType : null,
    deviceName: typeof req.body.deviceName === 'string' ? req.body.deviceName : null,
    userAgent: req.get('user-agent') ?? null,
    ipAddress: req.ip ?? null,
  };
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

export async function checkUsername(req: Request, res: Response) {
  try {
    const result = await checkUsernameAvailability(
      typeof req.query.username === 'string' ? req.query.username : ''
    );

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function signup(req: Request, res: Response) {
  try {
    const result = await signUp({
      email: req.body.email,
      username: req.body.username,
      password: req.body.password,
      profileImageUrl: req.body.profileImageUrl,
      bio: req.body.bio,
      ...getClientMetadata(req),
    });

    return res.status(201).json({
      success: true,
      message: 'Sign up successful. Email verification required.',
      ...result,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function resendVerificationEmail(req: Request, res: Response) {
  try {
    const result = await sendSignupVerificationEmail({
      email: typeof req.body.email === 'string' ? req.body.email : '',
      userAgent: req.get('user-agent') ?? null,
      ipAddress: req.ip ?? null,
    });

    return res.json({
      success: true,
      message: 'Verification email sent successfully',
      ...result,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function confirmVerificationEmail(req: Request, res: Response) {
  try {
    const result = await verifySignupEmail(typeof req.body.token === 'string' ? req.body.token : '');

    return res.json({
      success: true,
      message: 'Email verified successfully',
      ...result,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function loginUser(req: Request, res: Response) {
  try {
    const result = await login({
      email: typeof req.body.email === 'string' ? req.body.email : '',
      password: typeof req.body.password === 'string' ? req.body.password : '',
      ...getClientMetadata(req),
    });

    return res.json({
      success: true,
      message: 'Login successful',
      ...result,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function refreshUserSession(req: Request, res: Response) {
  try {
    const result = await refreshSession({
      refreshToken: typeof req.body.refreshToken === 'string' ? req.body.refreshToken : '',
      ...getClientMetadata(req),
    });

    return res.json({
      success: true,
      message: 'Token refreshed successfully',
      ...result,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function requestPasswordResetEmail(req: Request, res: Response) {
  try {
    const result = await requestPasswordReset({
      email: typeof req.body.email === 'string' ? req.body.email : '',
      userAgent: req.get('user-agent') ?? null,
      ipAddress: req.ip ?? null,
    });

    return res.json({
      success: true,
      message: 'Password reset email sent successfully',
      ...result,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function confirmPasswordReset(req: Request, res: Response) {
  try {
    const result = await resetPasswordWithEmailToken(
      typeof req.body.token === 'string' ? req.body.token : '',
      typeof req.body.newPassword === 'string' ? req.body.newPassword : ''
    );

    return res.json({
      success: true,
      message: 'Password reset successful',
      ...result,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function logoutUser(req: Request, res: Response) {
  try {
    await logout(typeof req.body.refreshToken === 'string' ? req.body.refreshToken : '');

    return res.json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getCurrentUser(req: Request, res: Response) {
  try {
    const authUser = req.authUser;

    if (!authUser) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const user = await getMyProfile(authUser.userId);

    return res.json({
      success: true,
      user,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function logoutEverywhere(req: Request, res: Response) {
  try {
    const authUser = req.authUser;

    if (!authUser) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    await logoutAll(authUser.userId);

    return res.json({
      success: true,
      message: 'Logged out from all devices',
    });
  } catch (error) {
    return sendError(res, error);
  }
}
