USE myanitrack_v2;

CREATE TABLE IF NOT EXISTS user_analysis_state (
  user_id BIGINT PRIMARY KEY,
  voice_actor_stats_dirty BOOLEAN NOT NULL DEFAULT TRUE,
  voice_actor_stats_version BIGINT NOT NULL DEFAULT 1,
  voice_actor_stats_calculated_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_analysis_state_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_voice_actor_stats (
  user_id BIGINT NOT NULL,
  voice_actor_id BIGINT NOT NULL,
  anime_count INT NOT NULL DEFAULT 0,
  character_count INT NOT NULL DEFAULT 0,
  rated_anime_count INT NOT NULL DEFAULT 0,
  score_sum DECIMAL(12, 2) NULL,
  average_score DECIMAL(5, 2) NULL,
  last_calculated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, voice_actor_id),
  KEY idx_uvas_user_count (user_id, anime_count, voice_actor_id),
  KEY idx_uvas_user_score (user_id, average_score, rated_anime_count, anime_count, voice_actor_id),
  KEY idx_uvas_voice_actor (voice_actor_id),
  CONSTRAINT fk_uvas_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_uvas_voice_actor
    FOREIGN KEY (voice_actor_id) REFERENCES voice_actors(id)
    ON DELETE CASCADE
);
