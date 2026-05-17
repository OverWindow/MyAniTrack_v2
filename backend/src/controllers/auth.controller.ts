import { Request, Response } from 'express';
import { getRefreshTokenExpiresInSeconds } from '../lib/auth';
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
  if (message === 'refreshToken is required') {
    return 401;
  }

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

function getRequestBody(req: Request): Record<string, unknown> {
  return req.body && typeof req.body === 'object' ? req.body : {};
}

function getClientMetadata(req: Request) {
  const body = getRequestBody(req);

  return {
    deviceType: typeof body.deviceType === 'string' ? body.deviceType : null,
    deviceName: typeof body.deviceName === 'string' ? body.deviceName : null,
    userAgent: req.get('user-agent') ?? null,
    ipAddress: req.ip ?? null,
  };
}

function getRefreshCookieSameSite(): 'lax' | 'strict' | 'none' {
  const value = String(process.env.AUTH_REFRESH_COOKIE_SAME_SITE || 'lax').toLowerCase();

  if (value === 'strict' || value === 'none') {
    return value;
  }

  return 'lax';
}

function getRefreshCookieOptions() {
  const sameSite = getRefreshCookieSameSite();

  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || sameSite === 'none',
    sameSite,
    path: '/api/auth',
  } as const;
}

function setRefreshTokenCookie(res: Response, refreshToken: string) {
  res.cookie('refreshToken', refreshToken, {
    ...getRefreshCookieOptions(),
    maxAge: getRefreshTokenExpiresInSeconds() * 1000,
  });
}

function clearRefreshTokenCookie(res: Response) {
  res.clearCookie('refreshToken', getRefreshCookieOptions());
}

function getCookieValue(req: Request, name: string) {
  const cookieHeader = req.header('Cookie');

  if (!cookieHeader) {
    return '';
  }

  for (const part of cookieHeader.split(';')) {
    const [rawKey, ...rawValueParts] = part.trim().split('=');

    if (rawKey === name) {
      return decodeURIComponent(rawValueParts.join('='));
    }
  }

  return '';
}

function getRefreshTokenFromRequest(req: Request) {
  const body = getRequestBody(req);

  return getCookieValue(req, 'refreshToken')
    || (typeof body.refreshToken === 'string' ? body.refreshToken : '');
}

function sendAuthResponse(res: Response, result: Awaited<ReturnType<typeof login>>, message: string) {
  const { refreshToken, ...body } = result;
  setRefreshTokenCookie(res, refreshToken);

  return res.json({
    success: true,
    message,
    ...body,
  });
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

    return sendAuthResponse(res, result, 'Login successful');
  } catch (error) {
    return sendError(res, error);
  }
}

export async function refreshUserSession(req: Request, res: Response) {
  try {
    const result = await refreshSession({
      refreshToken: getRefreshTokenFromRequest(req),
      ...getClientMetadata(req),
    });

    return sendAuthResponse(res, result, 'Token refreshed successfully');
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
    await logout(getRefreshTokenFromRequest(req));
    clearRefreshTokenCookie(res);

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
    clearRefreshTokenCookie(res);

    return res.json({
      success: true,
      message: 'Logged out from all devices',
    });
  } catch (error) {
    return sendError(res, error);
  }
}
