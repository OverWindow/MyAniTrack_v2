USE myanitrack_v2;

ALTER TABLE users
ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'USER'
COMMENT '사용자 권한: USER(일반 사용자), ADMIN(관리자)';