import { NextFunction, Request, Response } from 'express';
import { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/db';
import { requireAuth } from './auth.middleware';

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.header('Authorization')) return next();
  return requireAuth(req, res, next);
}

export async function requireVisibleUser(req: Request, res: Response, next: NextFunction) {
  const targetUserId = Number(req.params.userId);
  if (!Number.isInteger(targetUserId) || targetUserId <= 0) return next();
  const params: number[] = [targetUserId];
  let blockSql = '';
  if (req.authUser && req.authUser.userId !== targetUserId) {
    blockSql = `AND NOT EXISTS (
      SELECT 1 FROM user_blocks ub
      WHERE (ub.blocker_user_id = ? AND ub.blocked_user_id = ?)
         OR (ub.blocker_user_id = ? AND ub.blocked_user_id = ?)
    )`;
    params.push(req.authUser.userId, targetUserId, targetUserId, req.authUser.userId);
  }
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 1 FROM users WHERE id = ? AND moderation_status = 'ACTIVE' ${blockSql} LIMIT 1`,
    params,
  );
  if (rows.length === 0) return res.status(404).json({ success: false, message: 'User not found' });
  return next();
}
