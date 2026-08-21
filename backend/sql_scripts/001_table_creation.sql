USE myanitrack_v2;

CREATE TABLE anime (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  anilist_id INT NOT NULL UNIQUE,
  title_romaji VARCHAR(255),
  title_english VARCHAR(255),
  title_native VARCHAR(255),
  title_user_preferred VARCHAR(255),
  description TEXT,
  episodes INT,
  duration INT,
  season VARCHAR(20),
  season_year INT,
  format VARCHAR(50),
  status VARCHAR(50),
  source VARCHAR(50),
  country_of_origin VARCHAR(10),
  is_adult BOOLEAN NOT NULL DEFAULT FALSE,
  average_score INT,
  mean_score INT,
  popularity INT,
  favourites INT,
  cover_image_large VARCHAR(500),
  cover_image_extra_large VARCHAR(500),
  banner_image VARCHAR(500),
  site_url VARCHAR(500),
  source_updated_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE anime_genres (
  anime_id BIGINT NOT NULL,
  genre VARCHAR(100) NOT NULL,
  PRIMARY KEY (anime_id, genre),
  CONSTRAINT fk_anime_genres_anime
    FOREIGN KEY (anime_id) REFERENCES anime(id)
    ON DELETE CASCADE
);

CREATE TABLE anime_tags (
  anime_id BIGINT NOT NULL,
  tag_name VARCHAR(100) NOT NULL,
  rank_value INT NULL,
  is_spoiler BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (anime_id, tag_name),
  CONSTRAINT fk_anime_tags_anime
    FOREIGN KEY (anime_id) REFERENCES anime(id)
    ON DELETE CASCADE
);

CREATE TABLE anime_synonyms (
  anime_id BIGINT NOT NULL,
  synonym VARCHAR(255) NOT NULL,
  PRIMARY KEY (anime_id, synonym),
  CONSTRAINT fk_anime_synonyms_anime
    FOREIGN KEY (anime_id) REFERENCES anime(id)
    ON DELETE CASCADE
);

CREATE TABLE users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL UNIQUE,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  profile_image_url VARCHAR(500) NULL,
  bio VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE user_anime_lists (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  anime_id BIGINT NOT NULL,
  status VARCHAR(20) NOT NULL,
  score DECIMAL(4,2) NULL,
  progress INT NOT NULL DEFAULT 0,
  started_at DATE NULL,
  completed_at DATE NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT uq_user_anime UNIQUE (user_id, anime_id),

  CONSTRAINT fk_user_anime_lists_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_user_anime_lists_anime
    FOREIGN KEY (anime_id) REFERENCES anime(id)
    ON DELETE CASCADE
);