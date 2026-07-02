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
