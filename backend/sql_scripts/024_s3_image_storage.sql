USE myanitrack_v2;

ALTER TABLE catalog_image_sync_jobs
  ADD COLUMN target_provider VARCHAR(20) NOT NULL DEFAULT 's3' AFTER trigger_type;

ALTER TABLE catalog_image_assets
  MODIFY COLUMN anilist_id BIGINT NOT NULL,
  ADD COLUMN source_provider VARCHAR(20) NOT NULL DEFAULT 'anilist' AFTER source_hash,
  ADD COLUMN storage_provider VARCHAR(20) NULL AFTER public_url,
  ADD COLUMN legacy_object_key VARCHAR(1000) NULL AFTER storage_provider,
  ADD COLUMN legacy_public_url VARCHAR(1000) NULL AFTER legacy_object_key,
  ADD COLUMN content_size_bytes BIGINT UNSIGNED NULL AFTER content_type,
  ADD COLUMN content_sha256 CHAR(64) NULL AFTER content_size_bytes;

CREATE TABLE IF NOT EXISTS catalog_image_legacy_objects (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  provider VARCHAR(20) NOT NULL,
  object_key VARCHAR(1000) NOT NULL,
  public_url VARCHAR(1000) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
  last_error VARCHAR(1000) NULL,
  delete_after DATETIME NOT NULL,
  deleted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_catalog_legacy_object (provider, object_key(700)),
  KEY idx_catalog_legacy_due (status, delete_after, id)
);

UPDATE catalog_image_sync_jobs
SET target_provider = 'supabase';

UPDATE catalog_image_sync_jobs
SET
  last_error = 'Supabase image job was cancelled for the S3 cutover',
  finished_at = CURRENT_TIMESTAMP,
  status = 'cancelled'
WHERE status IN ('queued', 'running', 'paused');

UPDATE catalog_image_assets
SET
  source_provider = IF(
    public_url LIKE '%/storage/v1/object/public/%',
    'supabase',
    'anilist'
  ),
  storage_provider = IF(
    public_url LIKE '%/storage/v1/object/public/%',
    'supabase',
    NULL
  ),
  legacy_object_key = IF(
    public_url LIKE '%/storage/v1/object/public/%',
    object_key,
    NULL
  ),
  legacy_public_url = IF(
    public_url LIKE '%/storage/v1/object/public/%',
    public_url,
    NULL
  ),
  status = 'pending',
  attempt_count = 0,
  last_error = NULL,
  job_id = NULL;

INSERT INTO catalog_image_assets (
  entity_type,
  entity_id,
  anilist_id,
  variant,
  source_url,
  source_hash,
  source_provider,
  public_url,
  storage_provider,
  legacy_object_key,
  legacy_public_url,
  status
)
SELECT
  'user_profile',
  id,
  id,
  'profile_image',
  profile_image_url,
  SHA2(profile_image_url, 256),
  'supabase',
  profile_image_url,
  'supabase',
  SUBSTRING(
    SUBSTRING_INDEX(profile_image_url, '/storage/v1/object/public/', -1),
    LOCATE('/', SUBSTRING_INDEX(profile_image_url, '/storage/v1/object/public/', -1)) + 1
  ),
  profile_image_url,
  'pending'
FROM users
WHERE profile_image_url LIKE '%/storage/v1/object/public/%'
ON DUPLICATE KEY UPDATE
  entity_id = VALUES(entity_id),
  source_url = VALUES(source_url),
  source_hash = VALUES(source_hash),
  source_provider = VALUES(source_provider),
  public_url = VALUES(public_url),
  storage_provider = VALUES(storage_provider),
  legacy_object_key = VALUES(legacy_object_key),
  legacy_public_url = VALUES(legacy_public_url),
  status = 'pending',
  attempt_count = 0,
  last_error = NULL,
  job_id = NULL;

INSERT INTO catalog_image_assets (
  entity_type,
  entity_id,
  anilist_id,
  variant,
  source_url,
  source_hash,
  source_provider,
  public_url,
  storage_provider,
  legacy_object_key,
  legacy_public_url,
  status
)
SELECT
  'badge',
  id,
  id,
  'image',
  image_url,
  SHA2(image_url, 256),
  'supabase',
  image_url,
  'supabase',
  SUBSTRING(
    SUBSTRING_INDEX(image_url, '/storage/v1/object/public/', -1),
    LOCATE('/', SUBSTRING_INDEX(image_url, '/storage/v1/object/public/', -1)) + 1
  ),
  image_url,
  'pending'
FROM badges
WHERE image_url LIKE '%/storage/v1/object/public/%'
ON DUPLICATE KEY UPDATE
  entity_id = VALUES(entity_id),
  source_url = VALUES(source_url),
  source_hash = VALUES(source_hash),
  source_provider = VALUES(source_provider),
  public_url = VALUES(public_url),
  storage_provider = VALUES(storage_provider),
  legacy_object_key = VALUES(legacy_object_key),
  legacy_public_url = VALUES(legacy_public_url),
  status = 'pending',
  attempt_count = 0,
  last_error = NULL,
  job_id = NULL;

INSERT INTO catalog_image_assets (
  entity_type,
  entity_id,
  anilist_id,
  variant,
  source_url,
  source_hash,
  source_provider,
  public_url,
  storage_provider,
  legacy_object_key,
  legacy_public_url,
  status
)
SELECT
  'profile_report',
  id,
  id,
  'reported_profile_image',
  profile_image_url,
  SHA2(profile_image_url, 256),
  'supabase',
  profile_image_url,
  'supabase',
  SUBSTRING(
    SUBSTRING_INDEX(profile_image_url, '/storage/v1/object/public/', -1),
    LOCATE('/', SUBSTRING_INDEX(profile_image_url, '/storage/v1/object/public/', -1)) + 1
  ),
  profile_image_url,
  'pending'
FROM profile_reports
WHERE profile_image_url LIKE '%/storage/v1/object/public/%'
ON DUPLICATE KEY UPDATE
  entity_id = VALUES(entity_id),
  source_url = VALUES(source_url),
  source_hash = VALUES(source_hash),
  source_provider = VALUES(source_provider),
  public_url = VALUES(public_url),
  storage_provider = VALUES(storage_provider),
  legacy_object_key = VALUES(legacy_object_key),
  legacy_public_url = VALUES(legacy_public_url),
  status = 'pending',
  attempt_count = 0,
  last_error = NULL,
  job_id = NULL;
