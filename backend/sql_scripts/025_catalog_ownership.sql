USE myanitrack_v2;

CREATE TABLE IF NOT EXISTS catalog_source_refs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  entity_type VARCHAR(30) NOT NULL,
  entity_id BIGINT NOT NULL,
  provider VARCHAR(50) NOT NULL,
  external_id VARCHAR(255) NULL,
  source_url VARCHAR(1000) NULL,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_catalog_source_ref (entity_type, provider, external_id),
  KEY idx_catalog_source_entity (entity_type, entity_id)
);

CREATE TABLE IF NOT EXISTS catalog_change_requests (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  source VARCHAR(20) NOT NULL COMMENT 'USER, AI',
  kind VARCHAR(30) NOT NULL COMMENT 'CREATE_ENTITY, UPDATE_ENTITY, LINK_TO_ANIME',
  entity_type VARCHAR(30) NOT NULL COMMENT 'ANIME, CHARACTER, VOICE_ACTOR, STUDIO',
  target_entity_id BIGINT NULL,
  submitted_by_user_id BIGINT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  display_name VARCHAR(255) NOT NULL,
  normalized_name VARCHAR(255) NOT NULL,
  source_url VARCHAR(1000) NOT NULL,
  description VARCHAR(2000) NOT NULL,
  payload JSON NOT NULL,
  base_updated_at DATETIME NULL,
  confidence_overall DECIMAL(4,3) NULL,
  confidence_basic DECIMAL(4,3) NULL,
  confidence_airing DECIMAL(4,3) NULL,
  confidence_studios DECIMAL(4,3) NULL,
  confidence_characters DECIMAL(4,3) NULL,
  confidence_voice_actors DECIMAL(4,3) NULL,
  confidence_relations DECIMAL(4,3) NULL,
  warnings JSON NULL,
  reviewed_by_user_id BIGINT NULL,
  reviewed_at DATETIME NULL,
  rejection_reason VARCHAR(1000) NULL,
  approved_entity_id BIGINT NULL,
  duplicate_resolution VARCHAR(20) NULL COMMENT 'USE_EXISTING, CREATE_NEW',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_catalog_change_queue (status, source, entity_type, created_at),
  KEY idx_catalog_change_submitter (submitted_by_user_id, created_at),
  KEY idx_catalog_change_duplicate (entity_type, normalized_name, status),
  CONSTRAINT fk_catalog_change_submitter FOREIGN KEY (submitted_by_user_id)
    REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_catalog_change_reviewer FOREIGN KEY (reviewed_by_user_id)
    REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS catalog_change_request_sources (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  request_id BIGINT NOT NULL,
  section_name VARCHAR(30) NOT NULL,
  source_url VARCHAR(1000) NOT NULL,
  source_title VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_catalog_change_source (request_id, section_name, source_url(500)),
  CONSTRAINT fk_catalog_change_source_request FOREIGN KEY (request_id)
    REFERENCES catalog_change_requests(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS catalog_change_audit_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  request_id BIGINT NULL,
  actor_user_id BIGINT NULL,
  action VARCHAR(30) NOT NULL,
  entity_type VARCHAR(30) NOT NULL,
  entity_id BIGINT NULL,
  before_payload JSON NULL,
  after_payload JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_catalog_audit_entity (entity_type, entity_id, created_at),
  KEY idx_catalog_audit_request (request_id),
  CONSTRAINT fk_catalog_audit_request FOREIGN KEY (request_id)
    REFERENCES catalog_change_requests(id) ON DELETE SET NULL,
  CONSTRAINT fk_catalog_audit_actor FOREIGN KEY (actor_user_id)
    REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS catalog_discovery_runs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  season_year INT NOT NULL,
  season VARCHAR(10) NOT NULL,
  phase VARCHAR(20) NOT NULL COMMENT 'INITIAL, REFRESH, MANUAL',
  schedule_key VARCHAR(50) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'queued',
  model VARCHAR(100) NOT NULL DEFAULT 'gpt-5.6-luna',
  candidate_count INT UNSIGNED NOT NULL DEFAULT 0,
  processed_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_request_count INT UNSIGNED NOT NULL DEFAULT 0,
  failed_count INT UNSIGNED NOT NULL DEFAULT 0,
  cancel_requested BOOLEAN NOT NULL DEFAULT FALSE,
  response_id VARCHAR(255) NULL,
  last_error VARCHAR(2000) NULL,
  started_at DATETIME NULL,
  finished_at DATETIME NULL,
  created_by_user_id BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_catalog_discovery_schedule (schedule_key),
  KEY idx_catalog_discovery_status (status, id),
  CONSTRAINT fk_catalog_discovery_creator FOREIGN KEY (created_by_user_id)
    REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS catalog_discovery_items (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  run_id BIGINT NOT NULL,
  candidate_key VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  request_id BIGINT NULL,
  attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
  sources JSON NULL,
  last_error VARCHAR(2000) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_catalog_discovery_candidate (run_id, candidate_key),
  KEY idx_catalog_discovery_item_status (run_id, status, id),
  CONSTRAINT fk_catalog_discovery_item_run FOREIGN KEY (run_id)
    REFERENCES catalog_discovery_runs(id) ON DELETE CASCADE,
  CONSTRAINT fk_catalog_discovery_item_request FOREIGN KEY (request_id)
    REFERENCES catalog_change_requests(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS anime_community_metrics (
  anime_id BIGINT PRIMARY KEY,
  community_average_score DECIMAL(4,2) NULL,
  rating_count INT UNSIGNED NOT NULL DEFAULT 0,
  collection_count INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_anime_metrics_popular (collection_count, anime_id),
  KEY idx_anime_metrics_score (community_average_score, rating_count, anime_id),
  CONSTRAINT fk_anime_metrics_anime FOREIGN KEY (anime_id)
    REFERENCES anime(id) ON DELETE CASCADE
);

INSERT INTO anime_community_metrics (
  anime_id,
  community_average_score,
  rating_count,
  collection_count
)
SELECT
  a.id,
  AVG(ual.score),
  COUNT(ual.score),
  COUNT(ual.id)
FROM anime a
LEFT JOIN user_anime_lists ual ON ual.anime_id = a.id
GROUP BY a.id
ON DUPLICATE KEY UPDATE
  community_average_score = VALUES(community_average_score),
  rating_count = VALUES(rating_count),
  collection_count = VALUES(collection_count),
  updated_at = CURRENT_TIMESTAMP;

ALTER TABLE anime ADD COLUMN official_site_url VARCHAR(1000) NULL AFTER banner_image;
ALTER TABLE characters ADD COLUMN official_site_url VARCHAR(1000) NULL AFTER image_medium;
ALTER TABLE voice_actors ADD COLUMN official_site_url VARCHAR(1000) NULL AFTER image_medium;
ALTER TABLE studios ADD COLUMN official_site_url VARCHAR(1000) NULL AFTER is_animation_studio;

INSERT IGNORE INTO catalog_source_refs (entity_type, entity_id, provider, external_id, source_url)
SELECT 'ANIME', id, 'ANILIST', CAST(anilist_id AS CHAR), site_url FROM anime;
INSERT IGNORE INTO catalog_source_refs (entity_type, entity_id, provider, external_id, source_url)
SELECT 'CHARACTER', id, 'ANILIST', CAST(anilist_id AS CHAR), site_url FROM characters;
INSERT IGNORE INTO catalog_source_refs (entity_type, entity_id, provider, external_id, source_url)
SELECT 'VOICE_ACTOR', id, 'ANILIST', CAST(anilist_id AS CHAR), site_url FROM voice_actors;
INSERT IGNORE INTO catalog_source_refs (entity_type, entity_id, provider, external_id, source_url)
SELECT 'STUDIO', id, 'ANILIST', CAST(anilist_id AS CHAR), site_url FROM studios;

INSERT IGNORE INTO catalog_source_refs (
  entity_type,
  entity_id,
  provider,
  external_id,
  metadata
)
SELECT
  'ANIME_RELATION',
  source_anime_id,
  'ANILIST',
  CONCAT(source_anime_id, ':', target_anilist_id, ':', relation_type),
  JSON_OBJECT(
    'targetExternalId', target_anilist_id,
    'relationType', relation_type,
    'resolvedTargetAnimeId', target_anime_id
  )
FROM anime_relations;

DROP TABLE IF EXISTS anime_relations_next;
CREATE TABLE anime_relations_next (
  source_anime_id BIGINT NOT NULL,
  target_anime_id BIGINT NOT NULL,
  relation_type VARCHAR(30) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (source_anime_id, target_anime_id, relation_type),
  KEY idx_anime_relations_next_target (target_anime_id, relation_type),
  CONSTRAINT fk_anime_relations_next_source FOREIGN KEY (source_anime_id)
    REFERENCES anime(id) ON DELETE CASCADE,
  CONSTRAINT fk_anime_relations_next_target FOREIGN KEY (target_anime_id)
    REFERENCES anime(id) ON DELETE CASCADE
);

INSERT IGNORE INTO anime_relations_next (
  source_anime_id,
  target_anime_id,
  relation_type,
  created_at,
  updated_at
)
SELECT
  source_anime_id,
  target_anime_id,
  relation_type,
  created_at,
  updated_at
FROM anime_relations
WHERE target_anime_id IS NOT NULL;

DROP TABLE IF EXISTS anime_relation_sync_state;
DROP TABLE anime_relations;
RENAME TABLE anime_relations_next TO anime_relations;
DROP TABLE IF EXISTS anime_cast_sync_state;
DROP TABLE IF EXISTS anime_studio_sync_state;

UPDATE catalog_image_assets
SET source_provider = 'legacy_external'
WHERE source_provider = 'anilist';

ALTER TABLE catalog_image_assets
  DROP INDEX uq_catalog_image_asset,
  DROP COLUMN anilist_id,
  ADD UNIQUE KEY uq_catalog_image_asset (entity_type, entity_id, variant);

ALTER TABLE catalog_image_assets
  DROP FOREIGN KEY fk_catalog_image_asset_job,
  DROP INDEX idx_catalog_image_asset_job_status,
  DROP COLUMN job_id;

DROP TABLE catalog_image_sync_jobs;

ALTER TABLE anime
  DROP INDEX anilist_id,
  DROP COLUMN anilist_id,
  DROP COLUMN average_score,
  DROP COLUMN mean_score,
  DROP COLUMN popularity,
  DROP COLUMN favourites,
  DROP COLUMN site_url,
  DROP COLUMN source_updated_at;

ALTER TABLE characters
  DROP INDEX anilist_id,
  DROP COLUMN anilist_id,
  DROP COLUMN site_url,
  DROP COLUMN source_updated_at;

ALTER TABLE voice_actors
  DROP INDEX anilist_id,
  DROP COLUMN anilist_id,
  DROP COLUMN site_url,
  DROP COLUMN source_updated_at;

ALTER TABLE studios
  DROP INDEX anilist_id,
  DROP COLUMN anilist_id,
  DROP COLUMN site_url;
