USE myanitrack_v2;

ALTER TABLE anime_korean_titles
ADD COLUMN is_locked BOOLEAN NOT NULL DEFAULT FALSE COMMENT '관리자가 직접 수정하여 자동 변경 금지',
ADD COLUMN locked_at DATETIME NULL COMMENT '잠금 처리 시각',
ADD COLUMN locked_by BIGINT NULL COMMENT '잠금 처리한 관리자 user id',
ADD COLUMN source VARCHAR(30) NOT NULL DEFAULT 'MANUAL' COMMENT 'MANUAL, AUTO, IMPORTED';

ALTER TABLE anime_korean_titles
ADD CONSTRAINT fk_anime_korean_titles_locked_by
FOREIGN KEY (locked_by)
REFERENCES users(id)
ON DELETE SET NULL;