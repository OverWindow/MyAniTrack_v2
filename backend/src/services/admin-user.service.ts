import { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/db';
import { normalizeProfileImageUrl } from '../lib/supabase-storage';

type UserRole = 'USER' | 'ADMIN';
type UserRoleFilter = 'ALL' | UserRole;

interface AdminUserListRow extends RowDataPacket {
  id: number;
  email: string;
  username: string;
  role: UserRole;
  profileImageUrl: string | null;
  emailVerified: number | boolean;
  emailVerifiedAt: string | null;
  supabaseLinked: number | boolean;
  animeListCount: number;
  completedCount: number;
  activeSessionCount: number;
  createdAt: string;
  updatedAt: string;
}

interface AdminUserDetailRow extends AdminUserListRow {
  bio: string | null;
  plannedCount: number;
  watchingCount: number;
  pausedCount: number;
  droppedCount: number;
  totalWatchedEpisodes: number;
  totalWatchMinutes: number;
  averageScore: string | number | null;
  favoriteGenre: string | null;
  favoriteReleasePeriod: string | null;
  statsUpdatedAt: string | null;
}

interface CountRow extends RowDataPacket {
  total: number;
}

export interface AdminUserListParams {
  page?: unknown;
  limit?: unknown;
  search?: unknown;
  role?: unknown;
}

function validatePage(value: unknown) {
  const page = Number(value ?? 1);

  if (!Number.isInteger(page) || page < 1) {
    throw new Error('page must be a positive integer');
  }

  return page;
}

function validateLimit(value: unknown) {
  const limit = Number(value ?? 20);

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('limit must be an integer between 1 and 100');
  }

  return limit;
}

function validateSearch(value: unknown) {
  if (value === undefined) {
    return '';
  }

  if (typeof value !== 'string') {
    throw new Error('search must be a string');
  }

  const search = value.trim();

  if (search.length > 100) {
    throw new Error('search must be 100 characters or fewer');
  }

  return search;
}

function validateRole(value: unknown): UserRoleFilter {
  const role = typeof value === 'string' ? value.toUpperCase() : 'ALL';

  if (role !== 'ALL' && role !== 'USER' && role !== 'ADMIN') {
    throw new Error('role must be one of ALL, USER, ADMIN');
  }

  return role;
}

function mapListItem(row: AdminUserListRow) {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    role: row.role,
    profileImageUrl: normalizeProfileImageUrl(row.profileImageUrl),
    emailVerified: Boolean(row.emailVerified),
    emailVerifiedAt: row.emailVerifiedAt,
    supabaseLinked: Boolean(row.supabaseLinked),
    animeListCount: Number(row.animeListCount),
    completedCount: Number(row.completedCount),
    activeSessionCount: Number(row.activeSessionCount),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getAdminUsers(params: AdminUserListParams) {
  const page = validatePage(params.page);
  const limit = validateLimit(params.limit);
  const search = validateSearch(params.search);
  const role = validateRole(params.role);
  const whereClauses: string[] = [];
  const whereParams: Array<string | number> = [];

  if (search) {
    whereClauses.push('(u.email LIKE ? OR u.username LIKE ?)');
    const searchPattern = `%${search}%`;
    whereParams.push(searchPattern, searchPattern);
  }

  if (role !== 'ALL') {
    whereClauses.push('u.role = ?');
    whereParams.push(role);
  }

  const whereSql = whereClauses.length > 0
    ? `WHERE ${whereClauses.join(' AND ')}`
    : '';

  const [countRows] = await pool.query<CountRow[]>(
    `SELECT COUNT(*) AS total FROM users u ${whereSql}`,
    whereParams
  );

  const totalItems = Number(countRows[0]?.total ?? 0);
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limit);
  const offset = (page - 1) * limit;
  const [rows] = await pool.query<AdminUserListRow[]>(
    `
    SELECT
      u.id,
      u.email,
      u.username,
      u.role,
      u.profile_image_url AS profileImageUrl,
      u.email_verified AS emailVerified,
      u.email_verified_at AS emailVerifiedAt,
      (u.supabase_user_id IS NOT NULL) AS supabaseLinked,
      (
        SELECT COUNT(*)
        FROM user_anime_lists ual
        WHERE ual.user_id = u.id
      ) AS animeListCount,
      (
        SELECT COUNT(*)
        FROM user_anime_lists ual
        WHERE ual.user_id = u.id
          AND ual.status = 'completed'
      ) AS completedCount,
      (
        SELECT COUNT(*)
        FROM refresh_tokens rt
        WHERE rt.user_id = u.id
          AND rt.revoked_at IS NULL
          AND rt.expires_at > CURRENT_TIMESTAMP
      ) AS activeSessionCount,
      u.created_at AS createdAt,
      u.updated_at AS updatedAt
    FROM users u
    ${whereSql}
    ORDER BY u.id DESC
    LIMIT ? OFFSET ?
    `,
    [...whereParams, limit, offset]
  );

  return {
    items: rows.map(mapListItem),
    pageInfo: {
      page,
      limit,
      totalItems,
      totalPages,
      hasPrevious: page > 1 && totalItems > 0,
      hasNext: page < totalPages,
    },
    filters: {
      search,
      role,
    },
  };
}

export async function getAdminUserById(userId: number) {
  const [rows] = await pool.query<AdminUserDetailRow[]>(
    `
    SELECT
      u.id,
      u.email,
      u.username,
      u.role,
      u.profile_image_url AS profileImageUrl,
      u.bio,
      u.email_verified AS emailVerified,
      u.email_verified_at AS emailVerifiedAt,
      (u.supabase_user_id IS NOT NULL) AS supabaseLinked,
      (
        SELECT COUNT(*) FROM user_anime_lists ual
        WHERE ual.user_id = u.id
      ) AS animeListCount,
      (
        SELECT COUNT(*) FROM user_anime_lists ual
        WHERE ual.user_id = u.id AND ual.status = 'planned'
      ) AS plannedCount,
      (
        SELECT COUNT(*) FROM user_anime_lists ual
        WHERE ual.user_id = u.id AND ual.status = 'watching'
      ) AS watchingCount,
      (
        SELECT COUNT(*) FROM user_anime_lists ual
        WHERE ual.user_id = u.id AND ual.status = 'completed'
      ) AS completedCount,
      (
        SELECT COUNT(*) FROM user_anime_lists ual
        WHERE ual.user_id = u.id AND ual.status = 'paused'
      ) AS pausedCount,
      (
        SELECT COUNT(*) FROM user_anime_lists ual
        WHERE ual.user_id = u.id AND ual.status = 'dropped'
      ) AS droppedCount,
      (
        SELECT COUNT(*) FROM refresh_tokens rt
        WHERE rt.user_id = u.id
          AND rt.revoked_at IS NULL
          AND rt.expires_at > CURRENT_TIMESTAMP
      ) AS activeSessionCount,
      COALESCE(uas.total_watched_episodes, 0) AS totalWatchedEpisodes,
      COALESCE(uas.total_watch_minutes, 0) AS totalWatchMinutes,
      uas.avg_score AS averageScore,
      uas.favorite_genre AS favoriteGenre,
      uas.favorite_release_period AS favoriteReleasePeriod,
      uas.updated_at AS statsUpdatedAt,
      u.created_at AS createdAt,
      u.updated_at AS updatedAt
    FROM users u
    LEFT JOIN user_anime_stats uas
      ON uas.user_id = u.id
    WHERE u.id = ?
    LIMIT 1
    `,
    [userId]
  );

  const row = rows[0];

  if (!row) {
    throw new Error('User not found');
  }

  return {
    ...mapListItem(row),
    bio: row.bio,
    collection: {
      totalCount: Number(row.animeListCount),
      plannedCount: Number(row.plannedCount),
      watchingCount: Number(row.watchingCount),
      completedCount: Number(row.completedCount),
      pausedCount: Number(row.pausedCount),
      droppedCount: Number(row.droppedCount),
      totalWatchedEpisodes: Number(row.totalWatchedEpisodes),
      totalWatchMinutes: Number(row.totalWatchMinutes),
      averageScore: row.averageScore === null ? null : Number(row.averageScore),
      favoriteGenre: row.favoriteGenre,
      favoriteReleasePeriod: row.favoriteReleasePeriod,
      statsUpdatedAt: row.statsUpdatedAt,
    },
  };
}
