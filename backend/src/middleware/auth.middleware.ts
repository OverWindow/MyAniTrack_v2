import { NextFunction, Request, Response } from 'express';
import { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/db';
import { verifyAccessToken } from '../lib/auth';
import { findOrCreateUserFromSupabaseToken } from '../services/auth.service';

type UserRole = 'USER' | 'ADMIN';

interface AuthUserRow extends RowDataPacket {
  id: number;
  email: string;
  username: string;
  role: UserRole;
  moderationStatus: 'ACTIVE' | 'SUSPENDED';
}

declare global {
  namespace Express {
    interface Request {
      authUser?: {
        userId: number;
        email: string;
        username: string;
        role: UserRole;
      };
    }
  }
}

async function findAuthUserById(userId: number) {
  const [rows] = await pool.query<AuthUserRow[]>(
    `
    SELECT
      id,
      email,
      username,
      role
      , moderation_status AS moderationStatus
    FROM users
    WHERE id = ?
    LIMIT 1
    `,
    [userId]
  );

  return rows[0] ?? null;
}

function rejectSuspended(user: AuthUserRow, res: Response) {
  if (user.moderationStatus !== 'SUSPENDED') return false;
  res.status(403).json({ success: false, message: 'Account suspended' });
  return true;
}

function getSupabaseAuthFailureStatus(message: string) {
  if (message === 'Supabase email verification required') {
    return 403;
  }

  if (message === 'Invalid Supabase token' || message === 'Invalid Supabase user') {
    return 401;
  }

  return 500;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
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
    const user = await findAuthUserById(payload.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
      });
    }

    if (rejectSuspended(user, res)) return;

    req.authUser = {
      userId: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    };

    return next();
  } catch (error) {
    try {
      const user = await findOrCreateUserFromSupabaseToken(token);
      const persistedUser = await findAuthUserById(user.id);
      if (!persistedUser) throw new Error('User not found');
      if (rejectSuspended(persistedUser, res)) return;

      req.authUser = {
        userId: persistedUser.id,
        email: persistedUser.email,
        username: persistedUser.username,
        role: persistedUser.role,
      };

      return next();
    } catch (supabaseError) {
      const appTokenMessage = error instanceof Error ? error.message : 'Unauthorized';
      const supabaseTokenMessage = supabaseError instanceof Error ? supabaseError.message : 'Unauthorized';
      const message = appTokenMessage === 'Invalid token' ? supabaseTokenMessage : appTokenMessage;
      const statusCode = appTokenMessage === 'Invalid token'
        ? getSupabaseAuthFailureStatus(supabaseTokenMessage)
        : 401;

      if (statusCode === 500) {
        console.error(supabaseError);
      }

      return res.status(statusCode).json({
        success: false,
        message,
      });
    }
  }
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  await requireAuth(req, res, async () => {
    if (!req.authUser || req.authUser.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    return next();
  });
}
