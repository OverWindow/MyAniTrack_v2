USE myanitrack_v2;

CREATE TABLE email_verification_tokens (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    user_id BIGINT NULL,
    email VARCHAR(255) NOT NULL,

    purpose VARCHAR(30) NOT NULL COMMENT 'SIGNUP_VERIFY, PASSWORD_RESET',

    token_hash VARCHAR(255) NOT NULL,
    code_hash VARCHAR(255) NULL COMMENT '6자리 인증코드 해시를 쓰는 경우',

    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,

    request_ip VARCHAR(45) NULL,
    user_agent VARCHAR(500) NULL,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uq_token_hash (token_hash),
    INDEX idx_email_purpose (email, purpose),
    INDEX idx_user_id (user_id),
    INDEX idx_expires_at (expires_at),

    CONSTRAINT fk_email_verification_tokens_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

ALTER TABLE users
ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE COMMENT '이메일 인증 여부',
ADD COLUMN email_verified_at DATETIME NULL COMMENT '이메일 인증 완료 시각';