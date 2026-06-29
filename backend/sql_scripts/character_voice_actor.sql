USE myanitrack_v2;

CREATE TABLE IF NOT EXISTS characters (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  anilist_id INT NOT NULL UNIQUE,
  name_full VARCHAR(255) NULL,
  name_native VARCHAR(255) NULL,
  name_user_preferred VARCHAR(255) NULL,
  image_large VARCHAR(500) NULL,
  image_medium VARCHAR(500) NULL,
  gender VARCHAR(50) NULL,
  age VARCHAR(50) NULL,
  description TEXT NULL,
  site_url VARCHAR(500) NULL,
  source_updated_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_characters_name_full (name_full),
  KEY idx_characters_name_native (name_native)
);

CREATE TABLE IF NOT EXISTS voice_actors (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  anilist_id INT NOT NULL UNIQUE,
  name_full VARCHAR(255) NULL,
  name_native VARCHAR(255) NULL,
  name_user_preferred VARCHAR(255) NULL,
  language_v2 VARCHAR(100) NULL,
  image_large VARCHAR(500) NULL,
  image_medium VARCHAR(500) NULL,
  description TEXT NULL,
  site_url VARCHAR(500) NULL,
  source_updated_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_voice_actors_name_full (name_full),
  KEY idx_voice_actors_language_v2 (language_v2)
);

CREATE TABLE IF NOT EXISTS anime_characters (
  anime_id BIGINT NOT NULL,
  character_id BIGINT NOT NULL,
  role VARCHAR(50) NULL,
  edge_name VARCHAR(255) NULL,
  sort_order INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (anime_id, character_id),
  KEY idx_anime_characters_character_id (character_id),
  KEY idx_anime_characters_role (role),
  CONSTRAINT fk_anime_characters_anime
    FOREIGN KEY (anime_id) REFERENCES anime(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_anime_characters_character
    FOREIGN KEY (character_id) REFERENCES characters(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS anime_character_voice_actors (
  anime_id BIGINT NOT NULL,
  character_id BIGINT NOT NULL,
  voice_actor_id BIGINT NOT NULL,
  language_v2 VARCHAR(100) NULL,
  sort_order INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (anime_id, character_id, voice_actor_id),
  KEY idx_acva_character_id (character_id),
  KEY idx_acva_voice_actor_id (voice_actor_id),
  KEY idx_acva_language_v2 (language_v2),
  CONSTRAINT fk_acva_anime
    FOREIGN KEY (anime_id) REFERENCES anime(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_acva_character
    FOREIGN KEY (character_id) REFERENCES characters(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_acva_voice_actor
    FOREIGN KEY (voice_actor_id) REFERENCES voice_actors(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS anime_cast_sync_state (
  anime_id BIGINT PRIMARY KEY,
  last_synced_at DATETIME NULL,
  source_updated_at DATETIME NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  error_message TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_anime_cast_sync_state_status (status),
  KEY idx_anime_cast_sync_state_last_synced_at (last_synced_at),
  CONSTRAINT fk_anime_cast_sync_state_anime
    FOREIGN KEY (anime_id) REFERENCES anime(id)
    ON DELETE CASCADE
);