import { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/db';
import {
  deleteObjectByKey as deleteLegacySupabaseObjectByKey,
  getObjectKeyFromPublicUrl as getLegacySupabaseObjectKeyFromPublicUrl,
} from '../lib/supabase-storage';

const LEGACY_RETENTION_DAYS = 14;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const CLEANUP_BATCH_SIZE = 100;

interface LegacyObjectRow extends RowDataPacket {
  id: number;
  objectKey: string;
  publicUrl: string | null;
}

interface CountRow extends RowDataPacket {
  count: number | string;
}

let cleanupRunning = false;

export async function queueLegacySupabaseObject(
  connection: PoolConnection,
  params: { publicUrl: string | null | undefined; objectKey?: string | null },
) {
  if (!params.publicUrl) {
    return;
  }

  const objectKey = params.objectKey
    || getLegacySupabaseObjectKeyFromPublicUrl(params.publicUrl);

  if (!objectKey) {
    return;
  }

  await connection.execute(
    `
    INSERT INTO catalog_image_legacy_objects (
      provider,
      object_key,
      public_url,
      status,
      delete_after
    )
    VALUES ('supabase', ?, ?, 'pending', DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ? DAY))
    ON DUPLICATE KEY UPDATE
      public_url = VALUES(public_url),
      status = IF(status = 'deleted', status, 'pending'),
      last_error = NULL,
      delete_after = GREATEST(delete_after, VALUES(delete_after)),
      updated_at = CURRENT_TIMESTAMP
    `,
    [objectKey, params.publicUrl, LEGACY_RETENTION_DAYS],
  );
}

export async function queueLegacySupabaseObjectWithPool(params: {
  publicUrl: string | null | undefined;
  objectKey?: string | null;
}) {
  const connection = await pool.getConnection();

  try {
    await queueLegacySupabaseObject(connection, params);
  } finally {
    connection.release();
  }
}

async function isLegacyUrlStillReferenced(publicUrl: string | null) {
  if (!publicUrl) {
    return false;
  }

  const [rows] = await pool.query<CountRow[]>(
    `
    SELECT (
      (SELECT COUNT(*) FROM anime
        WHERE cover_image_large = ? OR cover_image_extra_large = ? OR banner_image = ?)
      + (SELECT COUNT(*) FROM characters WHERE image_large = ? OR image_medium = ?)
      + (SELECT COUNT(*) FROM voice_actors WHERE image_large = ? OR image_medium = ?)
      + (SELECT COUNT(*) FROM users WHERE profile_image_url = ?)
      + (SELECT COUNT(*) FROM badges WHERE image_url = ?)
      + (SELECT COUNT(*) FROM profile_reports WHERE profile_image_url = ?)
    ) AS count
    `,
    [
      publicUrl,
      publicUrl,
      publicUrl,
      publicUrl,
      publicUrl,
      publicUrl,
      publicUrl,
      publicUrl,
      publicUrl,
      publicUrl,
    ],
  );

  return Number(rows[0]?.count ?? 0) > 0;
}

export async function cleanupDueLegacyImageObjects(limit = CLEANUP_BATCH_SIZE) {
  if (cleanupRunning) {
    return { processed: 0, deleted: 0, failed: 0, deferred: 0 };
  }

  cleanupRunning = true;

  try {
    const safeLimit = Math.max(1, Math.min(1000, Math.trunc(limit)));
    const [rows] = await pool.query<LegacyObjectRow[]>(
      `
      SELECT id, object_key AS objectKey, public_url AS publicUrl
      FROM catalog_image_legacy_objects
      WHERE status IN ('pending', 'failed')
        AND delete_after <= CURRENT_TIMESTAMP
      ORDER BY delete_after, id
      LIMIT ${safeLimit}
      `,
    );
    let deleted = 0;
    let failed = 0;
    let deferred = 0;

    for (const row of rows) {
      if (await isLegacyUrlStillReferenced(row.publicUrl)) {
        deferred += 1;
        await pool.execute(
          `
          UPDATE catalog_image_legacy_objects
          SET delete_after = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 1 DAY), updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
          `,
          [row.id],
        );
        continue;
      }

      try {
        await deleteLegacySupabaseObjectByKey(row.objectKey);
        deleted += 1;
        await pool.execute(
          `
          UPDATE catalog_image_legacy_objects
          SET status = 'deleted', last_error = NULL, deleted_at = CURRENT_TIMESTAMP
          WHERE id = ?
          `,
          [row.id],
        );
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : 'Unknown legacy cleanup error';
        await pool.execute(
          `
          UPDATE catalog_image_legacy_objects
          SET status = 'failed', attempt_count = attempt_count + 1, last_error = ?
          WHERE id = ?
          `,
          [message.slice(0, 1000), row.id],
        );
      }
    }

    return { processed: rows.length, deleted, failed, deferred };
  } finally {
    cleanupRunning = false;
  }
}

export function startLegacyImageCleanupScheduler() {
  void cleanupDueLegacyImageObjects().catch((error) => {
    console.error('Legacy image cleanup failed', error);
  });

  const timer = setInterval(() => {
    void cleanupDueLegacyImageObjects().catch((error) => {
      console.error('Legacy image cleanup failed', error);
    });
  }, CLEANUP_INTERVAL_MS);

  timer.unref();
}
