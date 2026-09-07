import crypto from 'crypto';
import { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../config/db';
import {
  assertImageStorageReady,
  deleteObjectByKey,
  getCatalogImagesPrefix,
  getImageFileExtension,
  uploadPublicObject,
} from '../src/lib/image-storage';
import { getS3ImageStorageConfig, getSupabaseStorageConfig } from '../src/config/env';
import { validateAniListImageSourceUrl } from '../src/lib/catalog-image-url';
import {
  getObjectKeyFromPublicUrl as getLegacySupabaseObjectKeyFromPublicUrl,
  getPublicObjectUrl as getLegacySupabasePublicObjectUrl,
} from '../src/lib/supabase-storage';
import { queueLegacySupabaseObject } from '../src/services/legacy-image-cleanup.service';

const IMAGE_DOWNLOAD_TIMEOUT_MS = 20_000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const WORKER_CONCURRENCY = 4;
const MAX_DOWNLOAD_ATTEMPTS = 3;
const JOB_CREATE_LOCK = 'myanitrack:catalog-image-job-create';
const WORKER_LOCK = 'myanitrack:catalog-image-worker';

const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

export type CatalogImageEntityType =
  | 'anime'
  | 'character'
  | 'voice_actor'
  | 'user_profile'
  | 'badge'
  | 'profile_report';
export type CatalogImageSourceProvider = 'anilist' | 'supabase' | 'cloudfront';
export type CatalogImageStorageProvider = 'supabase' | 's3';
export type CatalogImageJobStatus =
  | 'queued'
  | 'running'
  | 'paused'
  | 'completed'
  | 'completed_with_errors'
  | 'failed'
  | 'cancelled';
export type CatalogImageJobMode = 'pending' | 'refresh' | 'retry';

type CatalogImageSourceMap = Record<string, string | null | undefined>;

interface CatalogImageAssetRow extends RowDataPacket {
  id: number;
  entityType: CatalogImageEntityType;
  entityId: number;
  anilistId: number;
  variant: string;
  sourceUrl: string | null;
  sourceHash: string | null;
  sourceProvider: CatalogImageSourceProvider;
  objectKey: string | null;
  publicUrl: string | null;
  storageProvider: CatalogImageStorageProvider | null;
  legacyObjectKey: string | null;
  legacyPublicUrl: string | null;
  status: 'pending' | 'syncing' | 'success' | 'failed';
  attemptCount: number;
  jobId: number | null;
}

interface CatalogImageJobRow extends RowDataPacket {
  id: number;
  scope: string;
  mode: CatalogImageJobMode;
  triggerType: 'admin' | 'system';
  targetProvider: 'supabase' | 's3';
  status: CatalogImageJobStatus;
  totalAssets: number;
  processedAssets: number;
  succeededAssets: number;
  failedAssets: number;
  skippedAssets: number;
  lastError: string | null;
  startedAt: Date | string | null;
  finishedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface CountRow extends RowDataPacket {
  total: number | string;
  pending: number | string;
  syncing: number | string;
  succeeded: number | string;
  failed: number | string;
}

interface ExternalReferenceCountRow extends RowDataPacket {
  count: number | string;
}

interface LockRow extends RowDataPacket {
  acquired: number | null;
}

const ENTITY_COLUMNS: Record<CatalogImageEntityType, { table: string; variants: Record<string, string> }> = {
  anime: {
    table: 'anime',
    variants: {
      cover_large: 'cover_image_large',
      cover_extra_large: 'cover_image_extra_large',
      banner: 'banner_image',
    },
  },
  character: {
    table: 'characters',
    variants: {
      image_large: 'image_large',
      image_medium: 'image_medium',
    },
  },
  voice_actor: {
    table: 'voice_actors',
    variants: {
      image_large: 'image_large',
      image_medium: 'image_medium',
    },
  },
  user_profile: {
    table: 'users',
    variants: {
      profile_image: 'profile_image_url',
    },
  },
  badge: {
    table: 'badges',
    variants: {
      image: 'image_url',
    },
  },
  profile_report: {
    table: 'profile_reports',
    variants: {
      reported_profile_image: 'profile_image_url',
    },
  },
};

let workerPromise: Promise<void> | null = null;
let workerRestartRequested = false;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sha256(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function getEntityTarget(entityType: CatalogImageEntityType, variant: string) {
  const definition = ENTITY_COLUMNS[entityType];
  const column = definition?.variants[variant];

  if (!definition || !column) {
    throw new Error(`Unsupported catalog image target: ${entityType}/${variant}`);
  }

  return { table: definition.table, column };
}

export function createCatalogImageObjectKey(params: {
  entityType: CatalogImageEntityType;
  anilistId: number;
  variant: string;
  sourceHash: string;
  contentType: string;
  prefix?: string;
}) {
  const prefix = (params.prefix ?? getCatalogImagesPrefix()).replace(/^\/+|\/+$/g, '');
  const extension = getImageFileExtension(params.contentType);
  return `${prefix}/${params.entityType}/${params.anilistId}/${params.variant}-${params.sourceHash.slice(0, 16)}.${extension}`;
}

function validateLegacySupabaseImageSourceUrl(value: string) {
  const config = getSupabaseStorageConfig();
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error('Legacy Supabase image source URL must be a valid URL');
  }

  const configuredOrigins = new Set<string>();

  for (const candidate of [
    config.url,
    config.publicBaseUrl,
    getLegacySupabasePublicObjectUrl('_origin-check'),
  ]) {
    if (!candidate) continue;

    try {
      configuredOrigins.add(new URL(candidate).origin);
    } catch {
      // Invalid configuration is reported by the storage configuration validator.
    }
  }

  if (
    url.protocol !== 'https:'
    || url.username
    || url.password
    || !configuredOrigins.has(url.origin)
    || !getLegacySupabaseObjectKeyFromPublicUrl(url.toString())
  ) {
    throw new Error('Legacy Supabase image source host is not allowed');
  }

  return url;
}

function validateCloudFrontImageSourceUrl(value: string) {
  let url: URL;
  const base = new URL(`${getS3ImageStorageConfig().publicBaseUrl}/`);

  try {
    url = new URL(value);
  } catch {
    throw new Error('CloudFront image source URL must be a valid URL');
  }

  if (
    url.protocol !== 'https:'
    || url.username
    || url.password
    || url.origin !== base.origin
  ) {
    throw new Error('CloudFront image source host is not allowed');
  }

  return url;
}

export function validateCatalogImageSourceUrl(
  value: string,
  provider: CatalogImageSourceProvider,
) {
  if (provider === 'anilist') {
    return validateAniListImageSourceUrl(value);
  }

  if (provider === 'supabase') {
    return validateLegacySupabaseImageSourceUrl(value);
  }

  return validateCloudFrontImageSourceUrl(value);
}

function getAssetDownloadSource(asset: CatalogImageAssetRow) {
  if (asset.storageProvider === 'supabase' && asset.legacyPublicUrl) {
    return {
      url: asset.legacyPublicUrl,
      provider: 'supabase' as const,
    };
  }

  return {
    url: asset.sourceUrl,
    provider: asset.sourceProvider,
  };
}

function createImageAssetObjectKey(
  asset: CatalogImageAssetRow,
  contentType: string,
) {
  const legacyObjectKey = asset.legacyObjectKey
    || (asset.legacyPublicUrl
      ? getLegacySupabaseObjectKeyFromPublicUrl(asset.legacyPublicUrl)
      : null);

  if (legacyObjectKey) {
    return legacyObjectKey;
  }

  if (asset.entityType === 'user_profile') {
    return `profile-images/user-${asset.entityId}/migrated-${asset.sourceHash?.slice(0, 16)}.${getImageFileExtension(contentType)}`;
  }

  if (asset.entityType === 'badge') {
    return `badges/badge-${asset.entityId}-${asset.sourceHash?.slice(0, 16)}.${getImageFileExtension(contentType)}`;
  }

  if (asset.entityType === 'profile_report') {
    return `profile-report-images/report-${asset.entityId}-${asset.sourceHash?.slice(0, 16)}.${getImageFileExtension(contentType)}`;
  }

  return createCatalogImageObjectKey({
    entityType: asset.entityType,
    anilistId: asset.anilistId,
    variant: asset.variant,
    sourceHash: asset.sourceHash ?? sha256(asset.sourceUrl ?? ''),
    contentType,
  });
}

export async function readCatalogImageResponse(
  response: Response,
  maxBytes = MAX_IMAGE_BYTES,
) {
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(`Catalog image download failed with HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();

  if (!contentType || !ALLOWED_CONTENT_TYPES.has(contentType)) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error('Catalog image response has an unsupported content type');
  }

  const declaredLength = Number(response.headers.get('content-length') ?? 0);

  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error('Catalog image exceeds the 10MB limit');
  }

  if (!response.body) {
    throw new Error('Catalog image response has no body');
  }

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  while (true) {
    const result = await reader.read();

    if (result.done) {
      break;
    }

    totalBytes += result.value.byteLength;

    if (totalBytes > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new Error('Catalog image exceeds the 10MB limit');
    }

    chunks.push(Buffer.from(result.value));
  }

  if (totalBytes === 0) {
    throw new Error('Catalog image response is empty');
  }

  return {
    buffer: Buffer.concat(chunks, totalBytes),
    contentType,
  };
}

async function downloadCatalogImage(
  sourceUrl: string,
  sourceProvider: CatalogImageSourceProvider,
  fetchImplementation: typeof fetch = fetch,
) {
  let currentUrl = validateCatalogImageSourceUrl(sourceUrl, sourceProvider);

  for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
    const response = await fetchImplementation(currentUrl, {
      method: 'GET',
      redirect: 'manual',
      headers: { Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif' },
      signal: AbortSignal.timeout(IMAGE_DOWNLOAD_TIMEOUT_MS),
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      await response.body?.cancel().catch(() => undefined);

      if (!location || redirectCount === 3) {
        throw new Error('Catalog image redirect could not be followed safely');
      }

      currentUrl = validateCatalogImageSourceUrl(
        new URL(location, currentUrl).toString(),
        sourceProvider,
      );
      continue;
    }

    return readCatalogImageResponse(response);
  }

  throw new Error('Catalog image redirect limit exceeded');
}

export async function queueCatalogImageSources(
  connection: PoolConnection,
  params: {
    entityType: CatalogImageEntityType;
    entityId: number;
    anilistId: number;
    sources: CatalogImageSourceMap;
  },
) {
  for (const [variant, rawSourceUrl] of Object.entries(params.sources)) {
    getEntityTarget(params.entityType, variant);
    const sourceUrl = rawSourceUrl?.trim() || null;

    if (!sourceUrl) {
      await connection.execute(
        `
        UPDATE catalog_image_assets
        SET
          status = IF(source_url IS NULL, status, 'pending'),
          attempt_count = IF(source_url IS NULL, attempt_count, 0),
          last_error = IF(source_url IS NULL, last_error, NULL),
          job_id = IF(source_url IS NULL, job_id, NULL),
          source_url = NULL,
          source_hash = NULL,
          source_provider = 'anilist',
          entity_id = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE entity_type = ?
          AND anilist_id = ?
          AND variant = ?
        `,
        [params.entityId, params.entityType, params.anilistId, variant],
      );
      continue;
    }

    const sourceHash = sha256(sourceUrl);

    await connection.execute(
      `
      INSERT INTO catalog_image_assets (
        entity_type,
        entity_id,
        anilist_id,
        variant,
        source_url,
        source_hash,
        source_provider,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, 'anilist', 'pending')
      ON DUPLICATE KEY UPDATE
        entity_id = VALUES(entity_id),
        status = IF(source_hash <=> VALUES(source_hash), status, 'pending'),
        attempt_count = IF(source_hash <=> VALUES(source_hash), attempt_count, 0),
        last_error = IF(source_hash <=> VALUES(source_hash), last_error, NULL),
        job_id = IF(source_hash <=> VALUES(source_hash), job_id, NULL),
        source_url = VALUES(source_url),
        source_hash = VALUES(source_hash),
        source_provider = 'anilist',
        updated_at = CURRENT_TIMESTAMP
      `,
      [
        params.entityType,
        params.entityId,
        params.anilistId,
        variant,
        sourceUrl,
        sourceHash,
      ],
    );
  }
}

export async function queueCatalogImageSourcesWithPool(params: {
  entityType: CatalogImageEntityType;
  entityId: number;
  anilistId: number;
  sources: CatalogImageSourceMap;
}) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await queueCatalogImageSources(connection, params);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function acquireLock(connection: PoolConnection, name: string, timeoutSeconds: number) {
  const [rows] = await connection.query<LockRow[]>('SELECT GET_LOCK(?, ?) AS acquired', [name, timeoutSeconds]);
  return rows[0]?.acquired === 1;
}

async function releaseLock(connection: PoolConnection, name: string) {
  await connection.query('SELECT RELEASE_LOCK(?)', [name]).catch(() => undefined);
}

async function findActiveJob(connection: PoolConnection) {
  const [rows] = await connection.query<CatalogImageJobRow[]>(
    `
    SELECT
      id,
      scope,
      mode,
      trigger_type AS triggerType,
      target_provider AS targetProvider,
      status,
      total_assets AS totalAssets,
      processed_assets AS processedAssets,
      succeeded_assets AS succeededAssets,
      failed_assets AS failedAssets,
      skipped_assets AS skippedAssets,
      last_error AS lastError,
      started_at AS startedAt,
      finished_at AS finishedAt,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM catalog_image_sync_jobs
    WHERE status IN ('queued', 'running', 'paused')
    ORDER BY id DESC
    LIMIT 1
    `,
  );

  return rows[0] ?? null;
}

async function createJob(params: {
  mode: 'pending' | 'refresh';
  triggerType: 'admin' | 'system';
}) {
  const connection = await pool.getConnection();
  let locked = false;

  try {
    locked = await acquireLock(connection, JOB_CREATE_LOCK, 5);

    if (!locked) {
      throw new Error('Could not acquire the catalog image job lock');
    }

    const activeJob = await findActiveJob(connection);

    if (activeJob) {
      const [assignmentResult] = await connection.query<ResultSetHeader>(
        `
        UPDATE catalog_image_assets
        SET job_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE job_id IS NULL
          AND status IN ('pending', 'failed')
        `,
        [activeJob.id],
      );

      if (assignmentResult.affectedRows > 0) {
        await connection.execute(
          `
          UPDATE catalog_image_sync_jobs
          SET total_assets = (
            SELECT COUNT(*) FROM catalog_image_assets WHERE job_id = ?
          )
          WHERE id = ?
          `,
          [activeJob.id, activeJob.id],
        );
      }

      return { jobId: activeJob.id, created: false, status: activeJob.status };
    }

    await connection.beginTransaction();
    const [insertResult] = await connection.execute<ResultSetHeader>(
      `
      INSERT INTO catalog_image_sync_jobs (scope, mode, trigger_type, target_provider, status)
      VALUES ('all', ?, ?, 's3', 'queued')
      `,
      [params.mode, params.triggerType],
    );
    const jobId = insertResult.insertId;
    const condition = params.mode === 'refresh'
      ? '1 = 1'
      : "status IN ('pending', 'failed')";
    const [assignmentResult] = await connection.query<ResultSetHeader>(
      `
      UPDATE catalog_image_assets
      SET
        job_id = ?,
        status = 'pending',
        attempt_count = IF(? = 'refresh', 0, attempt_count),
        last_error = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE ${condition}
      `,
      [jobId, params.mode],
    );
    const totalAssets = assignmentResult.affectedRows;

    await connection.execute(
      `
      UPDATE catalog_image_sync_jobs
      SET
        total_assets = ?,
        status = ?,
        finished_at = ?
      WHERE id = ?
      `,
      [totalAssets, totalAssets === 0 ? 'completed' : 'queued', totalAssets === 0 ? new Date() : null, jobId],
    );
    await connection.commit();

    return {
      jobId,
      created: true,
      status: totalAssets === 0 ? 'completed' as const : 'queued' as const,
    };
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    throw error;
  } finally {
    if (locked) {
      await releaseLock(connection, JOB_CREATE_LOCK);
    }
    connection.release();
  }
}

export async function createCatalogImageSyncJob(mode: 'pending' | 'refresh' = 'pending') {
  await assertImageStorageReady({ force: true });
  const result = await createJob({ mode, triggerType: 'admin' });

  if (!result.created && result.status !== 'completed') {
    const error = new Error('A catalog image sync job is already active');
    Object.assign(error, { statusCode: 409 });
    throw error;
  }

  if (result.status !== 'completed') {
    kickCatalogImageSyncWorker();
  }

  return getCatalogImageSyncStatus(result.jobId);
}

export async function ensureAutomaticCatalogImageSyncJob() {
  try {
    await assertImageStorageReady();
    const result = await createJob({ mode: 'pending', triggerType: 'system' });

    if (result.status !== 'completed' && result.status !== 'paused') {
      kickCatalogImageSyncWorker();
    }
  } catch (error) {
    console.error('Catalog images were queued but the automatic worker could not start', error);
  }
}

async function getAssetCounts(jobId?: number) {
  const where = jobId ? 'WHERE job_id = ?' : '';
  const values = jobId ? [jobId] : [];
  const [rows] = await pool.query<CountRow[]>(
    `
    SELECT
      COUNT(*) AS total,
      SUM(status = 'pending') AS pending,
      SUM(status = 'syncing') AS syncing,
      SUM(status = 'success') AS succeeded,
      SUM(status = 'failed') AS failed
    FROM catalog_image_assets
    ${where}
    `,
    values,
  );
  const row = rows[0];

  return {
    total: toNumber(row?.total),
    pending: toNumber(row?.pending),
    syncing: toNumber(row?.syncing),
    succeeded: toNumber(row?.succeeded),
    failed: toNumber(row?.failed),
  };
}

async function findJob(jobId?: number) {
  const [rows] = await pool.query<CatalogImageJobRow[]>(
    `
    SELECT
      id,
      scope,
      mode,
      trigger_type AS triggerType,
      target_provider AS targetProvider,
      status,
      total_assets AS totalAssets,
      processed_assets AS processedAssets,
      succeeded_assets AS succeededAssets,
      failed_assets AS failedAssets,
      skipped_assets AS skippedAssets,
      last_error AS lastError,
      started_at AS startedAt,
      finished_at AS finishedAt,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM catalog_image_sync_jobs
    ${jobId ? 'WHERE id = ?' : ''}
    ORDER BY id DESC
    LIMIT 1
    `,
    jobId ? [jobId] : [],
  );

  return rows[0] ?? null;
}

export async function getCatalogImageSyncStatus(jobId?: number) {
  const job = await findJob(jobId);
  const queue = await getAssetCounts();

  if (!job) {
    return { job: null, queue, recentFailures: [] };
  }

  const counts = await getAssetCounts(job.id);
  const [failureRows] = await pool.query<RowDataPacket[]>(
    `
    SELECT
      id,
      entity_type AS entityType,
      entity_id AS entityId,
      anilist_id AS anilistId,
      variant,
      attempt_count AS attemptCount,
      last_error AS lastError,
      updated_at AS updatedAt
    FROM catalog_image_assets
    WHERE job_id = ?
      AND status = 'failed'
    ORDER BY updated_at DESC, id DESC
    LIMIT 20
    `,
    [job.id],
  );
  const [currentRows] = await pool.query<RowDataPacket[]>(
    `
    SELECT
      id,
      entity_type AS entityType,
      entity_id AS entityId,
      anilist_id AS anilistId,
      variant
    FROM catalog_image_assets
    WHERE job_id = ?
      AND status = 'syncing'
    ORDER BY id
    LIMIT 1
    `,
    [job.id],
  );

  return {
    job: {
      ...job,
      totalAssets: counts.total,
      processedAssets: counts.succeeded + counts.failed,
      succeededAssets: counts.succeeded,
      failedAssets: counts.failed,
      pendingAssets: counts.pending,
      syncingAssets: counts.syncing,
      currentAsset: currentRows[0] ?? null,
    },
    queue,
    recentFailures: failureRows,
  };
}

async function requireJob(jobId: number) {
  if (!Number.isInteger(jobId) || jobId <= 0) {
    const error = new Error('jobId must be a positive integer');
    Object.assign(error, { statusCode: 400 });
    throw error;
  }

  const job = await findJob(jobId);

  if (!job) {
    const error = new Error('Catalog image sync job not found');
    Object.assign(error, { statusCode: 404 });
    throw error;
  }

  return job;
}

export async function pauseCatalogImageSyncJob(jobId: number) {
  await requireJob(jobId);
  await pool.execute(
    `
    UPDATE catalog_image_sync_jobs
    SET status = 'paused'
    WHERE id = ?
      AND status IN ('queued', 'running')
    `,
    [jobId],
  );
  return getCatalogImageSyncStatus(jobId);
}

export async function resumeCatalogImageSyncJob(jobId: number) {
  const job = await requireJob(jobId);

  if (job.status !== 'paused') {
    const error = new Error('Only a paused catalog image sync job can be resumed');
    Object.assign(error, { statusCode: 409 });
    throw error;
  }

  await assertImageStorageReady({ force: true });

  await pool.execute(
    `UPDATE catalog_image_sync_jobs SET status = 'queued', finished_at = NULL WHERE id = ?`,
    [jobId],
  );
  kickCatalogImageSyncWorker();
  return getCatalogImageSyncStatus(jobId);
}

export async function retryFailedCatalogImages(jobId: number) {
  await requireJob(jobId);
  await assertImageStorageReady({ force: true });
  const connection = await pool.getConnection();
  let locked = false;

  try {
    locked = await acquireLock(connection, JOB_CREATE_LOCK, 5);

    if (!locked) {
      throw new Error('Could not acquire the catalog image job lock');
    }

    const activeJob = await findActiveJob(connection);

    if (activeJob) {
      const error = new Error('A catalog image sync job is already active');
      Object.assign(error, { statusCode: 409 });
      throw error;
    }

    await connection.beginTransaction();
    const [insertResult] = await connection.execute<ResultSetHeader>(
      `
      INSERT INTO catalog_image_sync_jobs (scope, mode, trigger_type, target_provider, status)
      VALUES ('all', 'retry', 'admin', 's3', 'queued')
      `,
    );
    const retryJobId = insertResult.insertId;
    const [assignmentResult] = await connection.execute<ResultSetHeader>(
      `
      UPDATE catalog_image_assets
      SET
        job_id = ?,
        status = 'pending',
        attempt_count = 0,
        last_error = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE job_id = ?
        AND status = 'failed'
      `,
      [retryJobId, jobId],
    );
    const totalAssets = assignmentResult.affectedRows;

    await connection.execute(
      `
      UPDATE catalog_image_sync_jobs
      SET total_assets = ?, status = ?, finished_at = ?
      WHERE id = ?
      `,
      [totalAssets, totalAssets === 0 ? 'completed' : 'queued', totalAssets === 0 ? new Date() : null, retryJobId],
    );
    await connection.commit();

    if (totalAssets > 0) {
      kickCatalogImageSyncWorker();
    }

    return getCatalogImageSyncStatus(retryJobId);
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    throw error;
  } finally {
    if (locked) {
      await releaseLock(connection, JOB_CREATE_LOCK);
    }
    connection.release();
  }
}

async function claimAssets(jobId: number) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<CatalogImageAssetRow[]>(
      `
      SELECT
        id,
        entity_type AS entityType,
        entity_id AS entityId,
        anilist_id AS anilistId,
        variant,
        source_url AS sourceUrl,
        source_hash AS sourceHash,
        source_provider AS sourceProvider,
        object_key AS objectKey,
        public_url AS publicUrl,
        storage_provider AS storageProvider,
        legacy_object_key AS legacyObjectKey,
        legacy_public_url AS legacyPublicUrl,
        status,
        attempt_count AS attemptCount,
        job_id AS jobId
      FROM catalog_image_assets
      WHERE job_id = ?
        AND status = 'pending'
      ORDER BY id
      LIMIT ${WORKER_CONCURRENCY}
      FOR UPDATE
      `,
      [jobId],
    );

    if (rows.length > 0) {
      await connection.query(
        `UPDATE catalog_image_assets SET status = 'syncing' WHERE id IN (?)`,
        [rows.map((row) => row.id)],
      );
    }

    await connection.commit();
    return rows;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function saveSuccessfulAsset(
  asset: CatalogImageAssetRow,
  upload: {
    objectKey: string | null;
    publicUrl: string | null;
    contentType: string | null;
    contentSizeBytes: number | null;
    contentSha256: string | null;
  },
  attempts: number,
) {
  const connection = await pool.getConnection();
  const target = getEntityTarget(asset.entityType, asset.variant);
  let stale = false;

  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<CatalogImageAssetRow[]>(
      `
      SELECT
        id,
        source_hash AS sourceHash,
        job_id AS jobId
      FROM catalog_image_assets
      WHERE id = ?
      FOR UPDATE
      `,
      [asset.id],
    );
    const current = rows[0];

    if (!current || current.sourceHash !== asset.sourceHash || current.jobId !== asset.jobId) {
      stale = true;
      await connection.rollback();
      return {
        stale,
        previousObjectKey: null as string | null,
        previousStorageProvider: null as CatalogImageStorageProvider | null,
      };
    }

    if (asset.storageProvider === 'supabase') {
      await queueLegacySupabaseObject(connection, {
        publicUrl: asset.publicUrl ?? asset.legacyPublicUrl,
        objectKey: asset.legacyObjectKey,
      });
    }

    const [entityUpdate] = await connection.query<ResultSetHeader>(
      `UPDATE ${target.table} SET ${target.column} = ? WHERE id = ?`,
      [upload.publicUrl, asset.entityId],
    );

    if (entityUpdate.affectedRows === 0) {
      throw new Error('Catalog image owner no longer exists');
    }

    await connection.execute(
      `
      UPDATE catalog_image_assets
      SET
        object_key = ?,
        public_url = ?,
        storage_provider = ?,
        content_type = ?,
        content_size_bytes = ?,
        content_sha256 = ?,
        source_url = IF(entity_type IN ('anime', 'character', 'voice_actor'), source_url, ?),
        source_provider = IF(entity_type IN ('anime', 'character', 'voice_actor'), 'anilist', 'cloudfront'),
        status = 'success',
        attempt_count = attempt_count + ?,
        last_error = NULL,
        synced_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [
        upload.objectKey,
        upload.publicUrl,
        upload.publicUrl ? 's3' : null,
        upload.contentType,
        upload.contentSizeBytes,
        upload.contentSha256,
        upload.publicUrl,
        attempts,
        asset.id,
      ],
    );
    await connection.commit();
    return {
      stale,
      previousObjectKey: asset.objectKey,
      previousStorageProvider: asset.storageProvider,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function processAssetOnce(asset: CatalogImageAssetRow) {
  let uploadedObjectKey: string | null = null;

  try {
    const source = getAssetDownloadSource(asset);

    if (!source.url || !asset.sourceHash) {
      const saved = await saveSuccessfulAsset(
        asset,
        {
          objectKey: null,
          publicUrl: null,
          contentType: null,
          contentSizeBytes: null,
          contentSha256: null,
        },
        1,
      );

      if (saved.previousObjectKey && saved.previousStorageProvider === 's3') {
        await deleteObjectByKey(saved.previousObjectKey).catch((error) => {
          console.error('Failed to delete removed catalog image object', error);
        });
      }
      return saved.stale ? 'skipped' as const : 'success' as const;
    }

    const image = await downloadCatalogImage(source.url, source.provider);
    const objectKey = createImageAssetObjectKey(asset, image.contentType);
    const upload = await uploadPublicObject({
      objectKey,
      buffer: image.buffer,
      contentType: image.contentType,
    });
    uploadedObjectKey = upload.objectKey;
    const saved = await saveSuccessfulAsset(
      asset,
      { ...upload, contentType: image.contentType },
      1,
    );

    if (saved.stale) {
      if (asset.storageProvider !== 's3' || upload.objectKey !== asset.objectKey) {
        await deleteObjectByKey(upload.objectKey).catch(() => undefined);
      }
      return 'skipped' as const;
    }

    if (
      saved.previousStorageProvider === 's3'
      && saved.previousObjectKey
      && saved.previousObjectKey !== upload.objectKey
    ) {
      await deleteObjectByKey(saved.previousObjectKey).catch((error) => {
        console.error('Failed to delete superseded catalog image object', error);
      });
    }

    return 'success' as const;
  } catch (error) {
    if (
      uploadedObjectKey
      && (asset.storageProvider !== 's3' || uploadedObjectKey !== asset.objectKey)
    ) {
      await deleteObjectByKey(uploadedObjectKey).catch(() => undefined);
    }
    throw error;
  }
}

async function markAssetFailed(asset: CatalogImageAssetRow, error: unknown, attempts: number) {
  const message = error instanceof Error ? error.message : 'Unknown catalog image sync error';
  await pool.execute(
    `
    UPDATE catalog_image_assets
    SET
      status = 'failed',
      attempt_count = attempt_count + ?,
      last_error = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
      AND job_id = ?
      AND source_hash <=> ?
    `,
    [attempts, message.slice(0, 1000), asset.id, asset.jobId, asset.sourceHash],
  );
}

async function processClaimedAsset(asset: CatalogImageAssetRow) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_DOWNLOAD_ATTEMPTS; attempt += 1) {
    try {
      const result = await processAssetOnce(asset);

      if (attempt > 1 && result === 'success') {
        await pool.execute(
          `UPDATE catalog_image_assets SET attempt_count = attempt_count + ? WHERE id = ?`,
          [attempt - 1, asset.id],
        );
      }

      return result;
    } catch (error) {
      lastError = error;

      if (attempt < MAX_DOWNLOAD_ATTEMPTS) {
        await sleep(500 * (2 ** (attempt - 1)));
      }
    }
  }

  await markAssetFailed(asset, lastError, MAX_DOWNLOAD_ATTEMPTS);
  return 'failed' as const;
}

async function updateJobCounters(jobId: number, finished = false) {
  const counts = await getAssetCounts(jobId);
  const status = finished
    ? counts.failed > 0 ? 'completed_with_errors' : 'completed'
    : 'running';

  await pool.execute(
    `
    UPDATE catalog_image_sync_jobs
    SET
      total_assets = ?,
      processed_assets = ?,
      succeeded_assets = ?,
      failed_assets = ?,
      status = IF(status = 'paused', 'paused', ?),
      finished_at = ?
    WHERE id = ?
    `,
    [
      counts.total,
      counts.succeeded + counts.failed,
      counts.succeeded,
      counts.failed,
      status,
      finished ? new Date() : null,
      jobId,
    ],
  );
}

async function countExternalImageReferences() {
  const externalCondition = (column: string) => `(
    ${column} LIKE '%://s4.anilist.co/%'
    OR ${column} LIKE '%/storage/v1/object/public/%'
  )`;
  const [rows] = await pool.query<ExternalReferenceCountRow[]>(
    `
    SELECT (
      (SELECT COUNT(*) FROM anime WHERE ${externalCondition('cover_image_large')})
      + (SELECT COUNT(*) FROM anime WHERE ${externalCondition('cover_image_extra_large')})
      + (SELECT COUNT(*) FROM anime WHERE ${externalCondition('banner_image')})
      + (SELECT COUNT(*) FROM characters WHERE ${externalCondition('image_large')})
      + (SELECT COUNT(*) FROM characters WHERE ${externalCondition('image_medium')})
      + (SELECT COUNT(*) FROM voice_actors WHERE ${externalCondition('image_large')})
      + (SELECT COUNT(*) FROM voice_actors WHERE ${externalCondition('image_medium')})
      + (SELECT COUNT(*) FROM users WHERE ${externalCondition('profile_image_url')})
      + (SELECT COUNT(*) FROM badges WHERE ${externalCondition('image_url')})
      + (SELECT COUNT(*) FROM profile_reports WHERE ${externalCondition('profile_image_url')})
    ) AS count
    `,
  );

  return toNumber(rows[0]?.count);
}

async function finishCatalogImageSyncJob(jobId: number) {
  await updateJobCounters(jobId, true);
  const externalReferenceCount = await countExternalImageReferences();

  if (externalReferenceCount > 0) {
    await pool.execute(
      `
      UPDATE catalog_image_sync_jobs
      SET
        status = 'completed_with_errors',
        last_error = ?
      WHERE id = ?
        AND status <> 'paused'
      `,
      [`Image reference audit found ${externalReferenceCount} AniList or Supabase URL(s)`, jobId],
    );
  }
}

async function runCatalogImageSyncWorker() {
  const lockConnection = await pool.getConnection();
  let locked = false;

  try {
    locked = await acquireLock(lockConnection, WORKER_LOCK, 0);

    if (!locked) {
      return;
    }

    const activeJob = await findActiveJob(lockConnection);

    if (!activeJob || activeJob.status === 'paused') {
      return;
    }

    await pool.execute(
      `
      UPDATE catalog_image_assets
      SET status = 'pending'
      WHERE job_id = ?
        AND status = 'syncing'
      `,
      [activeJob.id],
    );
    await pool.execute(
      `
      UPDATE catalog_image_sync_jobs
      SET status = 'running', started_at = COALESCE(started_at, CURRENT_TIMESTAMP), finished_at = NULL
      WHERE id = ?
      `,
      [activeJob.id],
    );

    while (true) {
      const currentJob = await findJob(activeJob.id);

      if (!currentJob || currentJob.status === 'paused') {
        break;
      }

      const assets = await claimAssets(activeJob.id);

      if (assets.length === 0) {
        await finishCatalogImageSyncJob(activeJob.id);
        break;
      }

      const results = await Promise.all(assets.map((asset) => processClaimedAsset(asset)));
      const skipped = results.filter((result) => result === 'skipped').length;

      if (skipped > 0) {
        await pool.execute(
          `UPDATE catalog_image_sync_jobs SET skipped_assets = skipped_assets + ? WHERE id = ?`,
          [skipped, activeJob.id],
        );
      }

      await updateJobCounters(activeJob.id);
    }
  } catch (error) {
    console.error('Catalog image sync worker failed', error);
    const activeJob = await findActiveJob(lockConnection).catch(() => null);

    if (activeJob) {
      await pool.execute(
        `
        UPDATE catalog_image_assets
        SET status = 'pending', updated_at = CURRENT_TIMESTAMP
        WHERE job_id = ?
          AND status = 'syncing'
        `,
        [activeJob.id],
      ).catch(() => undefined);
      await pool.execute(
        `
        UPDATE catalog_image_sync_jobs
        SET status = 'failed', last_error = ?, finished_at = CURRENT_TIMESTAMP
        WHERE id = ?
        `,
        [error instanceof Error ? error.message.slice(0, 1000) : 'Unknown worker error', activeJob.id],
      ).catch(() => undefined);
    }
  } finally {
    if (locked) {
      await releaseLock(lockConnection, WORKER_LOCK);
    }
    lockConnection.release();
  }
}

export function kickCatalogImageSyncWorker() {
  if (workerPromise) {
    workerRestartRequested = true;
    return;
  }

  workerPromise = runCatalogImageSyncWorker()
    .catch((error) => console.error('Catalog image worker could not start', error))
    .finally(() => {
      workerPromise = null;

      if (workerRestartRequested) {
        workerRestartRequested = false;
        kickCatalogImageSyncWorker();
      }
    });
}

export async function resumeCatalogImageSyncWorker() {
  await pool.execute<ResultSetHeader>(
    `
    UPDATE catalog_image_sync_jobs
    SET status = 'queued'
    WHERE status = 'running'
      AND target_provider = 's3'
    `,
  );
  const connection = await pool.getConnection();
  let job: CatalogImageJobRow | null = null;

  try {
    job = await findActiveJob(connection);
  } finally {
    connection.release();
  }

  if (job?.status === 'queued') {
    try {
      await assertImageStorageReady();
      kickCatalogImageSyncWorker();
    } catch (error) {
      console.error('S3 image sync remains queued because storage preflight failed', error);
    }
  }
}
