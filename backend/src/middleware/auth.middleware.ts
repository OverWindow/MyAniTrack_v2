import { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../lib/auth';

declare global {
  namespace Express {
    interface Request {
      authUser?: {
        userId: number;
        email: string;
        username: string;
      };
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authorization = req.header('Authorization');

  if (!authorization?.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Authorization token is required',
    });
  }

  const token = authorization.slice('Bearer '.length).trim();

  try {
    const payload = verifyAccessToken(token);
    req.authUser = {
      userId: payload.userId,
      email: payload.email,
      username: payload.username,
    };

    return next();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized';

    return res.status(401).json({
      success: false,
      message,
    });
  }
}
