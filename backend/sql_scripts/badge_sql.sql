USE myanitrack_v2;

CREATE TABLE badges (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500) NULL,

    image_url VARCHAR(500) NULL,

    category ENUM(
        'WATCH',
        'EPISODE',
        'TIME',
        'RATING',
        'GENRE',
        'SPECIAL'
    ) NOT NULL,

    condition_type ENUM(
        'TOTAL_COUNT',
        'COMPLETED_COUNT',
        'TOTAL_WATCHED_EPISODES',
        'TOTAL_WATCH_MINUTES',
        'AVG_SCORE',
        'FAVORITE_GENRE',
        'CUSTOM'
    ) NOT NULL,

    condition_value VARCHAR(100) NOT NULL,

    rarity ENUM(
        'COMMON',
        'RARE',
        'EPIC',
        'LEGENDARY'
        
    ) DEFAULT 'COMMON',

    is_active BOOLEAN DEFAULT TRUE,
    hidden BOOLEAN DEFAULT FALSE,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_badges (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    user_id BIGINT NOT NULL,
    badge_id BIGINT NOT NULL,

    earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    progress_snapshot JSON NULL,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE CASCADE,

    UNIQUE KEY uq_user_badge (user_id, badge_id),
    INDEX idx_user_badges_user_id (user_id),
    INDEX idx_user_badges_badge_id (badge_id)
);