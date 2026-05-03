import { Request, Response, Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
  getMyProfile,
  login,
  logout,
  logoutAll,
  refreshSession,
  signUp,
} from '../services/auth.service';

const router = Router();

function getErrorStatus(message: string) {
  if (
    message.includes('required') ||
    message.includes('must be') ||
    message.includes('already exists')
  ) {
    return 400;
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

router.post('/auth/signup', async (req: Request, res: Response) => {
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
      message: 'Sign up successful',
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

router.post('/auth/login', async (req: Request, res: Response) => {
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

router.post('/auth/refresh', async (req: Request, res: Response) => {
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

router.post('/auth/logout', async (req: Request, res: Response) => {
  try {
    await logout(typeof req.body.refreshToken === 'string' ? req.body.refreshToken : '');

    return res.json({
      success: true,
      message: 'Logout successful',
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

router.get('/auth/me', requireAuth, async (req: Request, res: Response) => {
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

router.post('/auth/logout-all', requireAuth, async (req: Request, res: Response) => {
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
