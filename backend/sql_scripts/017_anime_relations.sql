USE myanitrack_v2;

CREATE TABLE IF NOT EXISTS anime_relations (
  source_anime_id BIGINT NOT NULL,
  target_anime_id BIGINT NULL,
  target_legacy_source_id INT NOT NULL,
  relation_type VARCHAR(30) NOT NULL,
  synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (source_anime_id, target_legacy_source_id, relation_type),
  KEY idx_anime_relations_target (target_anime_id, relation_type),
  KEY idx_anime_relations_target_legacy_source (target_legacy_source_id),
  KEY idx_anime_relations_type (source_anime_id, relation_type),

  CONSTRAINT fk_anime_relations_source
    FOREIGN KEY (source_anime_id) REFERENCES anime(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_anime_relations_target
    FOREIGN KEY (target_anime_id) REFERENCES anime(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS anime_relation_sync_state (
  anime_id BIGINT PRIMARY KEY,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    COMMENT 'pending, syncing, success, failed',
  last_synced_at DATETIME NULL,
  source_updated_at DATETIME NULL,
  error_message VARCHAR(1000) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  KEY idx_anime_relation_sync_status (status),

  CONSTRAINT fk_anime_relation_sync_state_anime
    FOREIGN KEY (anime_id) REFERENCES anime(id)
    ON DELETE CASCADE
);

INSERT INTO anime_relation_sync_state (anime_id, status)
SELECT a.id, 'pending'
FROM anime a
ON DUPLICATE KEY UPDATE anime_id = VALUES(anime_id);
