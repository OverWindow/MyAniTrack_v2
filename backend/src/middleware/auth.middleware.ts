import { NextFunction, Request, Response } from 'express';
import { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/db';
import { verifyAccessToken } from '../lib/auth';

type UserRole = 'USER' | 'ADMIN';

interface AuthUserRow extends RowDataPacket {
  id: number;
  email: string;
  username: string;
  role: UserRole;
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
    FROM users
    WHERE id = ?
    LIMIT 1
    `,
    [userId]
  );

  return rows[0] ?? null;
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

    req.authUser = {
      userId: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
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
