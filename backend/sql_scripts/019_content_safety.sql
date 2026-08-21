-- Google Play content-safety and profile UGC moderation.
-- This migration is resumable because MySQL DDL may commit before a later
-- statement fails.

DROP PROCEDURE IF EXISTS migrate_019_content_safety;

DELIMITER $$

CREATE PROCEDURE migrate_019_content_safety()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'anime' AND COLUMN_NAME = 'app_visible'
  ) THEN
    ALTER TABLE anime ADD COLUMN app_visible BOOLEAN NOT NULL DEFAULT TRUE AFTER is_adult;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'anime' AND COLUMN_NAME = 'visibility_reason'
  ) THEN
    ALTER TABLE anime ADD COLUMN visibility_reason VARCHAR(500) NULL AFTER app_visible;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'anime' AND COLUMN_NAME = 'visibility_updated_at'
  ) THEN
    ALTER TABLE anime ADD COLUMN visibility_updated_at DATETIME NULL AFTER visibility_reason;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'moderation_status'
  ) THEN
    ALTER TABLE users
      ADD COLUMN moderation_status ENUM('ACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE' AFTER role;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'suspended_at'
  ) THEN
    ALTER TABLE users ADD COLUMN suspended_at DATETIME NULL AFTER moderation_status;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'suspension_reason'
  ) THEN
    ALTER TABLE users ADD COLUMN suspension_reason VARCHAR(500) NULL AFTER suspended_at;
  END IF;

  CREATE TABLE IF NOT EXISTS user_blocks (
    blocker_user_id BIGINT NOT NULL,
    blocked_user_id BIGINT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (blocker_user_id, blocked_user_id),
    KEY idx_user_blocks_blocked (blocked_user_id, blocker_user_id),
    CONSTRAINT chk_user_blocks_not_self CHECK (blocker_user_id <> blocked_user_id),
    CONSTRAINT fk_user_blocks_blocker FOREIGN KEY (blocker_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_blocks_blocked FOREIGN KEY (blocked_user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS profile_reports (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    reporter_user_id BIGINT NOT NULL,
    reported_user_id BIGINT NOT NULL,
    profile_image_url VARCHAR(1000) NULL,
    reason ENUM(
      'SEXUAL_CONTENT',
      'VIOLENT_CONTENT',
      'ALCOHOL_TOBACCO_DRUGS',
      'HATE_HARASSMENT',
      'SPAM_IMPERSONATION',
      'OTHER'
    ) NOT NULL,
    status ENUM('PENDING', 'DISMISSED', 'PROFILE_REMOVED', 'USER_SUSPENDED') NOT NULL DEFAULT 'PENDING',
    request_count INT UNSIGNED NOT NULL DEFAULT 1,
    reviewed_by_user_id BIGINT NULL,
    reviewed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_profile_reports_queue (status, created_at),
    KEY idx_profile_reports_reporter (reporter_user_id, created_at),
    KEY idx_profile_reports_reported (reported_user_id, status),
    CONSTRAINT chk_profile_reports_not_self CHECK (reporter_user_id <> reported_user_id),
    CONSTRAINT fk_profile_reports_reporter FOREIGN KEY (reporter_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_profile_reports_reported FOREIGN KEY (reported_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_profile_reports_reviewer FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'anime' AND INDEX_NAME = 'idx_anime_user_visibility'
  ) THEN
    CREATE INDEX idx_anime_user_visibility ON anime (is_adult, app_visible, id);
  END IF;
END$$

DELIMITER ;

CALL migrate_019_content_safety();
DROP PROCEDURE migrate_019_content_safety;
