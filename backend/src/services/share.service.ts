import crypto from 'crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/db';
import { areUsersBlocked } from './content-moderation.service';

const DEFAULT_SHARE_SECRET = 'dev-only-share-secret-change-me-please';
const SHARE_SECRET = process.env.SHARE_TOKEN_SECRET?.trim() || DEFAULT_SHARE_SECRET;
const SHARE_PUBLIC_ORIGIN = (process.env.SHARE_PUBLIC_ORIGIN?.trim()
  || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173')).replace(/\/$/, '');
const SHARE_API_ORIGIN = (process.env.SHARE_API_ORIGIN?.trim()
  || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000')).replace(/\/$/, '');
const CURSOR_KEY = crypto.createHash('sha256').update(`cursor:${SHARE_SECRET}`).digest();

if (process.env.NODE_ENV === 'production') {
  if (SHARE_SECRET === DEFAULT_SHARE_SECRET || SHARE_SECRET.length < 32) {
    throw new Error('SHARE_TOKEN_SECRET must be at least 32 characters in production');
  }
  if (!SHARE_PUBLIC_ORIGIN) throw new Error('SHARE_PUBLIC_ORIGIN is required in production');
  if (!SHARE_API_ORIGIN) throw new Error('SHARE_API_ORIGIN is required in production');
}

export type ShareResourceType = 'COLLECTION' | 'ANALYSIS';
export type ShareExpiryDays = 1 | 7 | 30 | null;

type ShareRow = RowDataPacket & {
  id: number;
  ownerUserId: number;
  resourceType: ShareResourceType;
  publicId: string;
  expiresAt: Date | string | null;
  revokedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type ResolvedShareRow = ShareRow & {
  username: string;
  profileImageUrl: string | null;
  bio: string | null;
  animeListCount: number | string;
};

export class ShareError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
  }
}

function iso(value: Date | string | null) {
  return value ? new Date(value).toISOString() : null;
}

function createSignature(publicId: string) {
  return crypto.createHmac('sha256', SHARE_SECRET).update(publicId).digest('base64url');
}

export function createShareToken(publicId: string) {
  return `${publicId}.${createSignature(publicId)}`;
}

export function verifyShareToken(token: string) {
  const [publicId, signature, ...rest] = token.split('.');
  if (rest.length > 0 || !/^[A-Za-z0-9_-]{22}$/.test(publicId ?? '') || !signature) return null;
  const expected = Buffer.from(createSignature(publicId), 'utf8');
  const actual = Buffer.from(signature, 'utf8');
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
  return publicId;
}

export function validateShareResourceType(value: unknown): ShareResourceType {
  const normalized = String(value ?? '').toUpperCase();
  if (normalized !== 'COLLECTION' && normalized !== 'ANALYSIS') {
    throw new ShareError(400, 'INVALID_RESOURCE_TYPE', 'resourceType must be collection or analysis');
  }
  return normalized;
}

export function validateShareExpiryDays(value: unknown): ShareExpiryDays {
  if (value === null || value === 'never') return null;
  const days = value === undefined ? 7 : Number(value);
  if (days !== 1 && days !== 7 && days !== 30) {
    throw new ShareError(400, 'INVALID_EXPIRY', 'expiresInDays must be one of 1, 7, 30, or null');
  }
  return days;
}

function toManagedShare(row: ShareRow) {
  const token = createShareToken(row.publicId);
  const expiresAt = iso(row.expiresAt);
  const expired = expiresAt !== null && new Date(expiresAt).getTime() <= Date.now();
  return {
    resourceType: row.resourceType,
    url: `${SHARE_PUBLIC_ORIGIN}/s/${token}`,
    expiresAt,
    revoked: Boolean(row.revokedAt),
    expired,
  };
}

export async function listMyShares(ownerUserId: number) {
  const [rows] = await pool.query<ShareRow[]>(`
    SELECT id, owner_user_id AS ownerUserId, resource_type AS resourceType,
      public_id AS publicId, expires_at AS expiresAt, revoked_at AS revokedAt,
      created_at AS createdAt, updated_at AS updatedAt
    FROM share_links WHERE owner_user_id = ? ORDER BY resource_type
  `, [ownerUserId]);
  return rows.map(toManagedShare);
}

export async function putMyShare(ownerUserId: number, resourceType: ShareResourceType, expiresInDays: ShareExpiryDays) {
  const [rows] = await pool.query<ShareRow[]>(`
    SELECT id, owner_user_id AS ownerUserId, resource_type AS resourceType,
      public_id AS publicId, expires_at AS expiresAt, revoked_at AS revokedAt,
      created_at AS createdAt, updated_at AS updatedAt
    FROM share_links WHERE owner_user_id = ? AND resource_type = ? LIMIT 1
  `, [ownerUserId, resourceType]);
  const current = rows[0];
  const currentExpiry = iso(current?.expiresAt ?? null);
  const mustRotate = !current || Boolean(current.revokedAt)
    || (currentExpiry !== null && new Date(currentExpiry).getTime() <= Date.now());
  const publicId = mustRotate ? crypto.randomBytes(16).toString('base64url') : current.publicId;
  const expiresAt = expiresInDays === null ? null : new Date(Date.now() + expiresInDays * 86_400_000);

  await pool.execute<ResultSetHeader>(`
    INSERT INTO share_links (owner_user_id, resource_type, public_id, expires_at, revoked_at)
    VALUES (?, ?, ?, ?, NULL)
    ON DUPLICATE KEY UPDATE public_id = VALUES(public_id), expires_at = VALUES(expires_at),
      revoked_at = NULL, updated_at = CURRENT_TIMESTAMP
  `, [ownerUserId, resourceType, publicId, expiresAt]);

  const [savedRows] = await pool.query<ShareRow[]>(`
    SELECT id, owner_user_id AS ownerUserId, resource_type AS resourceType,
      public_id AS publicId, expires_at AS expiresAt, revoked_at AS revokedAt,
      created_at AS createdAt, updated_at AS updatedAt
    FROM share_links WHERE owner_user_id = ? AND resource_type = ? LIMIT 1
  `, [ownerUserId, resourceType]);
  return toManagedShare(savedRows[0]);
}

export async function revokeMyShare(ownerUserId: number, resourceType: ShareResourceType) {
  const [result] = await pool.execute<ResultSetHeader>(`
    UPDATE share_links SET revoked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE owner_user_id = ? AND resource_type = ? AND revoked_at IS NULL
  `, [ownerUserId, resourceType]);
  if (result.affectedRows === 0) throw new ShareError(404, 'SHARE_NOT_FOUND', 'Share not found');
}

export async function resolveShare(token: string, viewerUserId?: number) {
  const publicId = verifyShareToken(token);
  if (!publicId) throw new ShareError(404, 'SHARE_NOT_FOUND', 'Share not found');
  const [rows] = await pool.query<ResolvedShareRow[]>(`
    SELECT sl.id, sl.owner_user_id AS ownerUserId, sl.resource_type AS resourceType,
      sl.public_id AS publicId, sl.expires_at AS expiresAt, sl.revoked_at AS revokedAt,
      sl.created_at AS createdAt, sl.updated_at AS updatedAt,
      u.username, u.profile_image_url AS profileImageUrl, u.bio,
      (SELECT COUNT(*)
       FROM user_anime_lists ual
       INNER JOIN anime a ON a.id = ual.anime_id AND a.is_adult = FALSE AND a.app_visible = TRUE
       WHERE ual.user_id = u.id) AS animeListCount
    FROM share_links sl
    INNER JOIN users u ON u.id = sl.owner_user_id AND u.moderation_status = 'ACTIVE'
    WHERE sl.public_id = ? AND sl.revoked_at IS NULL LIMIT 1
  `, [publicId]);
  const row = rows[0];
  if (!row) throw new ShareError(404, 'SHARE_NOT_FOUND', 'Share not found');
  const expiresAt = iso(row.expiresAt);
  if (expiresAt !== null && new Date(expiresAt).getTime() <= Date.now()) {
    throw new ShareError(410, 'SHARE_EXPIRED', 'Share link has expired');
  }
  if (viewerUserId && viewerUserId !== row.ownerUserId && await areUsersBlocked(viewerUserId, row.ownerUserId)) {
    throw new ShareError(404, 'SHARE_NOT_FOUND', 'Share not found');
  }
  return {
    ownerUserId: row.ownerUserId,
    resourceType: row.resourceType,
    publicId: row.publicId,
    expiresAt,
    owner: {
      username: row.username,
      profileImageUrl: row.profileImageUrl,
      bio: row.bio,
      animeListCount: Number(row.animeListCount),
    },
  };
}

export function protectShareCursor(cursor: string | null, publicId: string, purpose: string) {
  if (!cursor) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', CURSOR_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify({ cursor, publicId, purpose })), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}

export function unprotectShareCursor(value: unknown, publicId: string, purpose: string) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new ShareError(400, 'INVALID_CURSOR', 'Invalid cursor');
  try {
    const payload = Buffer.from(value, 'base64url');
    const decipher = crypto.createDecipheriv('aes-256-gcm', CURSOR_KEY, payload.subarray(0, 12));
    decipher.setAuthTag(payload.subarray(12, 28));
    const decoded = JSON.parse(Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString('utf8'));
    if (decoded.publicId !== publicId || decoded.purpose !== purpose || typeof decoded.cursor !== 'string') throw new Error();
    return decoded.cursor as string;
  } catch {
    throw new ShareError(400, 'INVALID_CURSOR', 'Invalid cursor');
  }
}

export function sanitizeCollectionResult(result: any, publicId: string, purpose = 'anime-list') {
  return {
    totalCount: result.totalCount,
    items: result.items.map(({ id: _id, userId: _userId, notes: _notes, createdAt: _createdAt, updatedAt: _updatedAt, ...item }: any) => item),
    pageInfo: {
      ...result.pageInfo,
      nextCursor: protectShareCursor(result.pageInfo.nextCursor, publicId, purpose),
    },
  };
}

export function sanitizeSeriesResult(result: any, publicId: string) {
  return {
    items: result.items.map(({ lastActivityAt: _lastActivityAt, ...series }: any) => ({
      ...series,
      items: series.items.map((member: any) => ({
        ...member,
        userList: member.userList ? {
          status: member.userList.status,
          score: member.userList.score,
          progress: member.userList.progress,
        } : null,
      })),
    })),
    pageInfo: {
      ...result.pageInfo,
      nextCursor: protectShareCursor(result.pageInfo.nextCursor, publicId, 'series'),
    },
  };
}

export function sanitizeAnalysisValue(value: any, parentKey = ''): any {
  if (Array.isArray(value)) return value.map((item) => sanitizeAnalysisValue(item, parentKey));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => key !== 'createdAt'
      && key !== 'updatedAt'
      && key !== 'notes'
      && key !== 'userId'
      && key !== 'listId'
      && key !== 'userAnimeListId'
      && !(parentKey === 'userList' && key === 'id'))
    .map(([key, nested]) => [key, sanitizeAnalysisValue(nested, key)]));
}

export function getSharePublicOrigin() { return SHARE_PUBLIC_ORIGIN; }
export function getShareApiOrigin() { return SHARE_API_ORIGIN; }
