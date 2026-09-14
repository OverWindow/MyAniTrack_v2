USE myanitrack_v2;

CREATE TABLE anime_korean_titles (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,

  anime_id BIGINT NOT NULL,

  title VARCHAR(255) NOT NULL,
  subtitle VARCHAR(255) NULL,

  full_title VARCHAR(512) GENERATED ALWAYS AS (
    CASE
      WHEN subtitle IS NULL OR subtitle = '' THEN title
      ELSE CONCAT(title, ' ', subtitle)
    END
  ) STORED,

  is_primary BOOLEAN NOT NULL DEFAULT TRUE,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_anime_title (anime_id, title, subtitle),
  KEY idx_title (title),
  KEY idx_full_title (full_title),

  CONSTRAINT fk_anime_korean_titles_anime
    FOREIGN KEY (anime_id) REFERENCES anime(id)
    ON DELETE CASCADE
);