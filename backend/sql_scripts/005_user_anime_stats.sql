USE myanitrack_v2;
CREATE TABLE user_anime_stats (
    user_id BIGINT PRIMARY KEY,

    -- 기본 통계
    total_count INT DEFAULT 0,
    completed_count INT DEFAULT 0,
    watching_count INT DEFAULT 0,
    dropped_count INT DEFAULT 0,

    total_watched_episodes INT DEFAULT 0,

    -- 누적 시청 시간 (분)
    total_watch_minutes INT DEFAULT 0,

    -- 평균 평점
    avg_score DECIMAL(4,2) NULL,

    -- 핵심 취향
    favorite_genre VARCHAR(100) NULL,
    favorite_release_period VARCHAR(20) NULL,

    -- 장르 분석
    genre_distribution JSON NULL,
    genre_watch_minutes JSON NULL,
    genre_avg_score JSON NULL,

    -- 방영 시기 분석
    release_year_distribution JSON NULL,
    avg_release_year DECIMAL(6,2) NULL,

    -- 평점 분포
    score_distribution JSON NULL,

    -- AI 분석 (추천/설명용)
    preference_summary TEXT NULL,
    recommendation_context TEXT NULL,

    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);