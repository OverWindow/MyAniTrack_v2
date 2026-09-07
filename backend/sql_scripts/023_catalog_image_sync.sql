USE myanitrack_v2;

CREATE TABLE IF NOT EXISTS catalog_image_sync_jobs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  scope VARCHAR(30) NOT NULL DEFAULT 'all',
  mode VARCHAR(30) NOT NULL DEFAULT 'pending',
  trigger_type VARCHAR(30) NOT NULL DEFAULT 'admin',
  status VARCHAR(30) NOT NULL DEFAULT 'queued',
  total_assets INT UNSIGNED NOT NULL DEFAULT 0,
  processed_assets INT UNSIGNED NOT NULL DEFAULT 0,
  succeeded_assets INT UNSIGNED NOT NULL DEFAULT 0,
  failed_assets INT UNSIGNED NOT NULL DEFAULT 0,
  skipped_assets INT UNSIGNED NOT NULL DEFAULT 0,
  last_error VARCHAR(1000) NULL,
  started_at DATETIME NULL,
  finished_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_catalog_image_jobs_status (status, id),
  KEY idx_catalog_image_jobs_created_at (created_at)
);

CREATE TABLE IF NOT EXISTS catalog_image_assets (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  entity_type VARCHAR(30) NOT NULL,
  entity_id BIGINT NOT NULL,
  anilist_id INT NOT NULL,
  variant VARCHAR(40) NOT NULL,
  source_url VARCHAR(1000) NULL,
  source_hash CHAR(64) NULL,
  object_key VARCHAR(1000) NULL,
  public_url VARCHAR(1000) NULL,
  content_type VARCHAR(100) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
  last_error VARCHAR(1000) NULL,
  job_id BIGINT NULL,
  synced_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_catalog_image_asset (entity_type, anilist_id, variant),
  KEY idx_catalog_image_asset_job_status (job_id, status, id),
  KEY idx_catalog_image_asset_status (status, id),
  CONSTRAINT fk_catalog_image_asset_job
    FOREIGN KEY (job_id) REFERENCES catalog_image_sync_jobs(id)
    ON DELETE SET NULL
);

INSERT INTO catalog_image_assets (
  entity_type, entity_id, anilist_id, variant, source_url, source_hash, status
)
SELECT 'anime', id, anilist_id, 'cover_large', cover_image_large, SHA2(cover_image_large, 256), 'pending'
FROM anime
WHERE cover_image_large LIKE '%://s4.anilist.co/%'
ON DUPLICATE KEY UPDATE
  entity_id = VALUES(entity_id),
  source_url = VALUES(source_url),
  source_hash = VALUES(source_hash),
  status = 'pending';

INSERT INTO catalog_image_assets (
  entity_type, entity_id, anilist_id, variant, source_url, source_hash, status
)
SELECT 'anime', id, anilist_id, 'cover_extra_large', cover_image_extra_large, SHA2(cover_image_extra_large, 256), 'pending'
FROM anime
WHERE cover_image_extra_large LIKE '%://s4.anilist.co/%'
ON DUPLICATE KEY UPDATE
  entity_id = VALUES(entity_id),
  source_url = VALUES(source_url),
  source_hash = VALUES(source_hash),
  status = 'pending';

INSERT INTO catalog_image_assets (
  entity_type, entity_id, anilist_id, variant, source_url, source_hash, status
)
SELECT 'anime', id, anilist_id, 'banner', banner_image, SHA2(banner_image, 256), 'pending'
FROM anime
WHERE banner_image LIKE '%://s4.anilist.co/%'
ON DUPLICATE KEY UPDATE
  entity_id = VALUES(entity_id),
  source_url = VALUES(source_url),
  source_hash = VALUES(source_hash),
  status = 'pending';

INSERT INTO catalog_image_assets (
  entity_type, entity_id, anilist_id, variant, source_url, source_hash, status
)
SELECT 'character', id, anilist_id, 'image_large', image_large, SHA2(image_large, 256), 'pending'
FROM characters
WHERE image_large LIKE '%://s4.anilist.co/%'
ON DUPLICATE KEY UPDATE
  entity_id = VALUES(entity_id),
  source_url = VALUES(source_url),
  source_hash = VALUES(source_hash),
  status = 'pending';

INSERT INTO catalog_image_assets (
  entity_type, entity_id, anilist_id, variant, source_url, source_hash, status
)
SELECT 'character', id, anilist_id, 'image_medium', image_medium, SHA2(image_medium, 256), 'pending'
FROM characters
WHERE image_medium LIKE '%://s4.anilist.co/%'
ON DUPLICATE KEY UPDATE
  entity_id = VALUES(entity_id),
  source_url = VALUES(source_url),
  source_hash = VALUES(source_hash),
  status = 'pending';

INSERT INTO catalog_image_assets (
  entity_type, entity_id, anilist_id, variant, source_url, source_hash, status
)
SELECT 'voice_actor', id, anilist_id, 'image_large', image_large, SHA2(image_large, 256), 'pending'
FROM voice_actors
WHERE image_large LIKE '%://s4.anilist.co/%'
ON DUPLICATE KEY UPDATE
  entity_id = VALUES(entity_id),
  source_url = VALUES(source_url),
  source_hash = VALUES(source_hash),
  status = 'pending';

INSERT INTO catalog_image_assets (
  entity_type, entity_id, anilist_id, variant, source_url, source_hash, status
)
SELECT 'voice_actor', id, anilist_id, 'image_medium', image_medium, SHA2(image_medium, 256), 'pending'
FROM voice_actors
WHERE image_medium LIKE '%://s4.anilist.co/%'
ON DUPLICATE KEY UPDATE
  entity_id = VALUES(entity_id),
  source_url = VALUES(source_url),
  source_hash = VALUES(source_hash),
  status = 'pending';

UPDATE anime
SET
  cover_image_large = IF(cover_image_large LIKE '%://s4.anilist.co/%', NULL, cover_image_large),
  cover_image_extra_large = IF(cover_image_extra_large LIKE '%://s4.anilist.co/%', NULL, cover_image_extra_large),
  banner_image = IF(banner_image LIKE '%://s4.anilist.co/%', NULL, banner_image);

UPDATE characters
SET
  image_large = IF(image_large LIKE '%://s4.anilist.co/%', NULL, image_large),
  image_medium = IF(image_medium LIKE '%://s4.anilist.co/%', NULL, image_medium);

UPDATE voice_actors
SET
  image_large = IF(image_large LIKE '%://s4.anilist.co/%', NULL, image_large),
  image_medium = IF(image_medium LIKE '%://s4.anilist.co/%', NULL, image_medium);
