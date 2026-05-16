import { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/db';

interface KoreanTitleRow extends RowDataPacket {
  id: number;
  animeId: number;
  title: string;
  subtitle: string;
  fullTitle: string;
  isPrimary: number | boolean;
  isLocked: number | boolean;
  lockedAt: string | null;
  lockedBy: number | null;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateAdminKoreanTitleInput {
  title: unknown;
  subtitle?: unknown;
}

function normalizeTitle(value: unknown) {
  if (typeof value !== 'string') {
    throw new Error('title is required');
  }

  const title = value.trim();

  if (!title) {
    throw new Error('title is required');
  }

  if (title.length > 255) {
    throw new Error('title must be 255 characters or less');
  }

  return title;
}

function normalizeSubtitle(value: unknown) {
  if (value === undefined || value === null) {
    return '';
  }

  if (typeof value !== 'string') {
    throw new Error('subtitle must be a string');
  }

  const subtitle = value.trim();

  if (subtitle.length > 255) {
    throw new Error('subtitle must be 255 characters or less');
  }

  return subtitle;
}

function normalizeBoolean(value: number | boolean) {
  return Boolean(value);
}

function mapKoreanTitle(row: KoreanTitleRow) {
  return {
    id: row.id,
    animeId: row.animeId,
    title: row.title,
    subtitle: row.subtitle || null,
    fullTitle: row.fullTitle,
    isPrimary: normalizeBoolean(row.isPrimary),
    isLocked: normalizeBoolean(row.isLocked),
    lockedAt: row.lockedAt,
    lockedBy: row.lockedBy,
    source: row.source,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function ensureAnimeExists(conn: PoolConnection, animeId: number) {
  const [rows] = await conn.query<RowDataPacket[]>(
    `
    SELECT id
    FROM anime
    WHERE id = ?
    LIMIT 1
    `,
    [animeId]
  );

  if (!rows[0]) {
    throw new Error('Anime not found');
  }
}

async function findExactKoreanTitle(
  conn: PoolConnection,
  animeId: number,
  title: string,
  subtitle: string
) {
  const [rows] = await conn.query<KoreanTitleRow[]>(
    `
    SELECT
      id,
      anime_id AS animeId,
      title,
      COALESCE(subtitle, '') AS subtitle,
      full_title AS fullTitle,
      is_primary AS isPrimary,
      is_locked AS isLocked,
      locked_at AS lockedAt,
      locked_by AS lockedBy,
      source,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM anime_korean_titles
    WHERE anime_id = ?
      AND title = ?
      AND COALESCE(subtitle, '') = ?
    LIMIT 1
    FOR UPDATE
    `,
    [animeId, title, subtitle]
  );

  return rows[0] ?? null;
}

async function findKoreanTitleById(conn: PoolConnection, id: number) {
  const [rows] = await conn.query<KoreanTitleRow[]>(
    `
    SELECT
      id,
      anime_id AS animeId,
      title,
      COALESCE(subtitle, '') AS subtitle,
      full_title AS fullTitle,
      is_primary AS isPrimary,
      is_locked AS isLocked,
      locked_at AS lockedAt,
      locked_by AS lockedBy,
      source,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM anime_korean_titles
    WHERE id = ?
    LIMIT 1
    `,
    [id]
  );

  const row = rows[0];

  if (!row) {
    throw new Error('Korean title not found');
  }

  return row;
}

export async function updateAnimeKoreanTitleByAdmin(
  adminUserId: number,
  animeId: number,
  input: UpdateAdminKoreanTitleInput
) {
  if (!Number.isInteger(animeId) || animeId <= 0) {
    throw new Error('animeId must be a positive integer');
  }

  const title = normalizeTitle(input.title);
  const subtitle = normalizeSubtitle(input.subtitle);
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();
    await ensureAnimeExists(conn, animeId);

    await conn.execute(
      `
      UPDATE anime_korean_titles
      SET
        is_primary = FALSE,
        updated_at = CURRENT_TIMESTAMP
      WHERE anime_id = ?
      `,
      [animeId]
    );

    const existingTitle = await findExactKoreanTitle(conn, animeId, title, subtitle);
    let titleId: number;

    if (existingTitle) {
      await conn.execute(
        `
        UPDATE anime_korean_titles
        SET
          is_primary = TRUE,
          is_locked = TRUE,
          locked_at = CURRENT_TIMESTAMP,
          locked_by = ?,
          source = 'MANUAL',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        `,
        [adminUserId, existingTitle.id]
      );
      titleId = existingTitle.id;
    } else {
      const [result] = await conn.execute<ResultSetHeader>(
        `
        INSERT INTO anime_korean_titles (
          anime_id,
          title,
          subtitle,
          is_primary,
          is_locked,
          locked_at,
          locked_by,
          source
        )
        VALUES (?, ?, ?, TRUE, TRUE, CURRENT_TIMESTAMP, ?, 'MANUAL')
        `,
        [animeId, title, subtitle, adminUserId]
      );
      titleId = result.insertId;
    }

    const updatedTitle = await findKoreanTitleById(conn, titleId);
    await conn.commit();

    return mapKoreanTitle(updatedTitle);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
