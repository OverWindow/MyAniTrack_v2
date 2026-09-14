USE myanitrack_v2;

CREATE TABLE user_agreements (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,

  user_id BIGINT NOT NULL,

  agreement_type VARCHAR(50) NOT NULL
    COMMENT '약관 종류: TERMS, PRIVACY',

  version VARCHAR(20) NOT NULL
    COMMENT '약관 버전 (예: v1.0)',

  agreed BOOLEAN NOT NULL DEFAULT TRUE
    COMMENT '동의 여부',

  agreed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    COMMENT '동의 시각',

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_user_id (user_id),
  INDEX idx_type (agreement_type),

  CONSTRAINT fk_user_agreements_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);

ALTER TABLE users
ADD COLUMN terms_agreed BOOLEAN NOT NULL DEFAULT FALSE
  COMMENT '이용약관 동의 여부 (필수)',
ADD COLUMN privacy_agreed BOOLEAN NOT NULL DEFAULT FALSE
  COMMENT '개인정보처리방침 동의 여부 (필수)',
ADD COLUMN agreed_at DATETIME NULL
  COMMENT '약관 동의 시각';