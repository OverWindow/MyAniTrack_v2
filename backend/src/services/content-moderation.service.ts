import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/db';
import { deleteProfileImageByUrl, normalizeProfileImageUrl } from '../lib/supabase-storage';

export const PROFILE_REPORT_REASONS = [
  'SEXUAL_CONTENT',
  'VIOLENT_CONTENT',
  'ALCOHOL_TOBACCO_DRUGS',
  'HATE_HARASSMENT',
  'SPAM_IMPERSONATION',
  'OTHER',
] as const;
export type ProfileReportReason = typeof PROFILE_REPORT_REASONS[number];
export type ProfileReportAction = 'DISMISS' | 'REMOVE_PROFILE' | 'SUSPEND_USER';

interface UserRow extends RowDataPacket {
  id: number;
  username: string;
  profileImageUrl: string | null;
}

interface ReportRow extends RowDataPacket {
  id: number;
  reporterUserId: number;
  reportedUserId: number;
  reporterUsername: string;
  reportedUsername: string;
  profileImageUrl: string | null;
  reason: ProfileReportReason;
  status: string;
  requestCount: number;
  createdAt: string;
  updatedAt: string;
}

export function assertOtherUser(actorId: number, targetId: number) {
  if (!Number.isInteger(targetId) || targetId <= 0) throw new Error('userId must be a positive integer');
  if (actorId === targetId) throw new Error('You cannot report or block yourself');
}

export function validateProfileReportReason(reason: unknown) {
  if (!PROFILE_REPORT_REASONS.includes(reason as ProfileReportReason)) throw new Error('Invalid report reason');
  return reason as ProfileReportReason;
}

async function findUser(userId: number) {
  const [rows] = await pool.query<UserRow[]>(
    `SELECT id, username, profile_image_url AS profileImageUrl FROM users WHERE id = ? LIMIT 1`,
    [userId],
  );
  return rows[0] ?? null;
}

export async function areUsersBlocked(userId: number, otherUserId: number) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `
    SELECT 1 FROM user_blocks
    WHERE (blocker_user_id = ? AND blocked_user_id = ?)
       OR (blocker_user_id = ? AND blocked_user_id = ?)
    LIMIT 1
    `,
    [userId, otherUserId, otherUserId, userId],
  );
  return rows.length > 0;
}

export async function createProfileReport(
  reporterUserId: number,
  reportedUserId: number,
  reason: unknown,
) {
  assertOtherUser(reporterUserId, reportedUserId);
  const validatedReason = validateProfileReportReason(reason);
  const reportedUser = await findUser(reportedUserId);
  if (!reportedUser) throw new Error('User not found');

  const [recentRows] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(request_count), 0) AS total FROM profile_reports WHERE reporter_user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`,
    [reporterUserId],
  );
  if (Number(recentRows[0]?.total ?? 0) >= 5) throw new Error('Report rate limit exceeded');

  const normalizedUrl = normalizeProfileImageUrl(reportedUser.profileImageUrl);
  const [duplicateRows] = await pool.query<RowDataPacket[]>(
    `
    SELECT id FROM profile_reports
    WHERE reporter_user_id = ? AND reported_user_id = ? AND status = 'PENDING'
      AND (profile_image_url <=> ?)
    LIMIT 1
    `,
    [reporterUserId, reportedUserId, normalizedUrl],
  );
  const duplicateId = duplicateRows[0]?.id;
  if (duplicateId) {
    await pool.execute(`UPDATE profile_reports SET request_count = request_count + 1, reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [validatedReason, duplicateId]);
    return { id: Number(duplicateId), merged: true };
  }

  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO profile_reports (reporter_user_id, reported_user_id, profile_image_url, reason) VALUES (?, ?, ?, ?)`,
    [reporterUserId, reportedUserId, normalizedUrl, validatedReason],
  );
  return { id: result.insertId, merged: false };
}

export async function blockUser(blockerUserId: number, blockedUserId: number) {
  assertOtherUser(blockerUserId, blockedUserId);
  if (!await findUser(blockedUserId)) throw new Error('User not found');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(`INSERT IGNORE INTO user_blocks (blocker_user_id, blocked_user_id) VALUES (?, ?)`, [blockerUserId, blockedUserId]);
    await connection.execute(
      `DELETE FROM friendships WHERE (user_id = ? AND friend_user_id = ?) OR (user_id = ? AND friend_user_id = ?)`,
      [blockerUserId, blockedUserId, blockedUserId, blockerUserId],
    );
    await connection.execute(
      `UPDATE friend_requests SET status = 'cancelled', responded_at = CURRENT_TIMESTAMP WHERE status = 'pending' AND ((requester_id = ? AND receiver_id = ?) OR (requester_id = ? AND receiver_id = ?))`,
      [blockerUserId, blockedUserId, blockedUserId, blockerUserId],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function unblockUser(blockerUserId: number, blockedUserId: number) {
  assertOtherUser(blockerUserId, blockedUserId);
  await pool.execute(`DELETE FROM user_blocks WHERE blocker_user_id = ? AND blocked_user_id = ?`, [blockerUserId, blockedUserId]);
}

export async function listBlockedUsers(blockerUserId: number) {
  const [rows] = await pool.query<UserRow[]>(
    `
    SELECT u.id, u.username, u.profile_image_url AS profileImageUrl
    FROM user_blocks ub INNER JOIN users u ON u.id = ub.blocked_user_id
    WHERE ub.blocker_user_id = ? ORDER BY ub.created_at DESC
    `,
    [blockerUserId],
  );
  return rows.map((row) => ({ id: row.id, username: row.username, profileImageUrl: normalizeProfileImageUrl(row.profileImageUrl) }));
}

export async function listPendingProfileReports() {
  const [rows] = await pool.query<ReportRow[]>(
    `
    SELECT pr.id, pr.reporter_user_id AS reporterUserId, pr.reported_user_id AS reportedUserId,
      reporter.username AS reporterUsername, reported.username AS reportedUsername,
      pr.profile_image_url AS profileImageUrl, pr.reason, pr.status,
      pr.request_count AS requestCount, pr.created_at AS createdAt, pr.updated_at AS updatedAt
    FROM profile_reports pr
    INNER JOIN users reporter ON reporter.id = pr.reporter_user_id
    INNER JOIN users reported ON reported.id = pr.reported_user_id
    WHERE pr.status = 'PENDING' ORDER BY pr.created_at ASC
    `,
  );
  return rows.map((row) => ({ ...row, profileImageUrl: normalizeProfileImageUrl(row.profileImageUrl) }));
}

export async function resolveProfileReport(reportId: number, adminUserId: number, action: ProfileReportAction) {
  if (!Number.isInteger(reportId) || reportId <= 0) throw new Error('reportId must be a positive integer');
  if (!['DISMISS', 'REMOVE_PROFILE', 'SUSPEND_USER'].includes(action)) throw new Error('Invalid moderation action');
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, reported_user_id AS reportedUserId, profile_image_url AS profileImageUrl, status FROM profile_reports WHERE id = ? LIMIT 1`,
    [reportId],
  );
  const report = rows[0];
  if (!report) throw new Error('Report not found');
  if (report.status !== 'PENDING') throw new Error('Report is already resolved');

  const nextStatus = action === 'DISMISS' ? 'DISMISSED' : action === 'REMOVE_PROFILE' ? 'PROFILE_REMOVED' : 'USER_SUSPENDED';
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    if (action === 'REMOVE_PROFILE') {
      await connection.execute(`UPDATE users SET profile_image_url = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [report.reportedUserId]);
    }
    if (action === 'SUSPEND_USER') {
      await connection.execute(`UPDATE users SET moderation_status = 'SUSPENDED', suspended_at = CURRENT_TIMESTAMP, suspension_reason = 'PROFILE_REPORT', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [report.reportedUserId]);
    }
    await connection.execute(
      `UPDATE profile_reports SET status = ?, reviewed_by_user_id = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [nextStatus, adminUserId, reportId],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  if (action === 'REMOVE_PROFILE' && report.profileImageUrl) {
    try {
      await deleteProfileImageByUrl(report.profileImageUrl);
    } catch (error) {
      await pool.execute(
        `UPDATE profile_reports SET status = 'PENDING', reviewed_by_user_id = NULL, reviewed_at = NULL WHERE id = ?`,
        [reportId],
      );
      throw error;
    }
  }
}

export async function setAnimeVisibilityOverride(animeId: number, visible: unknown, reason: unknown) {
  if (!Number.isInteger(animeId) || animeId <= 0) throw new Error('animeId must be a positive integer');
  if (typeof visible !== 'boolean') throw new Error('visible must be a boolean');
  const normalizedReason = typeof reason === 'string' && reason.trim() ? reason.trim().slice(0, 500) : null;
  const [result] = await pool.execute<ResultSetHeader>(
    `UPDATE anime SET app_visible = ?, visibility_reason = ?, visibility_updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [visible, normalizedReason, animeId],
  );
  if (result.affectedRows === 0) throw new Error('Anime not found');
}
