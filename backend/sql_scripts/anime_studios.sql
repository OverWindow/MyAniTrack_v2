USE myanitrack_v2;

CREATE TABLE IF NOT EXISTS studios (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  anilist_id INT NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  is_animation_studio BOOLEAN NOT NULL DEFAULT TRUE,
  site_url VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_studios_name (name)
);

CREATE TABLE IF NOT EXISTS anime_studios (
  anime_id BIGINT NOT NULL,
  studio_id BIGINT NOT NULL,
  is_main BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (anime_id, studio_id),
  INDEX idx_anime_studios_studio_main (studio_id, is_main),
  CONSTRAINT fk_anime_studios_anime
    FOREIGN KEY (anime_id) REFERENCES anime(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_anime_studios_studio
    FOREIGN KEY (studio_id) REFERENCES studios(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS anime_studio_sync_state (
  anime_id BIGINT PRIMARY KEY,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  source_updated_at DATETIME NULL,
  last_error TEXT NULL,
  synced_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_anime_studio_sync_status (status),
  CONSTRAINT fk_anime_studio_sync_state_anime
    FOREIGN KEY (anime_id) REFERENCES anime(id)
    ON DELETE CASCADE
);

INSERT INTO anime_studio_sync_state (anime_id, status)
SELECT a.id, 'pending'
FROM anime a
LEFT JOIN anime_studio_sync_state ass
  ON ass.anime_id = a.id
WHERE ass.anime_id IS NULL;

INSERT INTO anime_studio_sync_state (
  anime_id,
  status,
  synced_at
)
SELECT DISTINCT
  ans.anime_id,
  'success',
  CURRENT_TIMESTAMP
FROM anime_studios ans
ON DUPLICATE KEY UPDATE
  status = 'success',
  synced_at = CURRENT_TIMESTAMP,
  last_error = NULL,
  updated_at = CURRENT_TIMESTAMP;
