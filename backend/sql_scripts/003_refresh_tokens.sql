USE myanitrack_v2;
CREATE TABLE refresh_tokens (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    user_id BIGINT NOT NULL,

    token_hash VARCHAR(255) NOT NULL,
    jti VARCHAR(100) NOT NULL,

    device_type ENUM('web', 'android', 'ios', 'unknown') DEFAULT 'unknown',
    device_name VARCHAR(255) NULL,

    user_agent TEXT NULL,
    ip_address VARCHAR(45) NULL,

    issued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,

    revoked_at DATETIME NULL,
    revoke_reason VARCHAR(255) NULL,

    replaced_by_token_id BIGINT UNSIGNED NULL,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_refresh_tokens_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_refresh_tokens_replaced_by
        FOREIGN KEY (replaced_by_token_id) REFERENCES refresh_tokens(id)
        ON DELETE SET NULL,

    CONSTRAINT uq_refresh_tokens_jti UNIQUE (jti),
    CONSTRAINT uq_refresh_tokens_token_hash UNIQUE (token_hash),

    INDEX idx_refresh_tokens_user_id (user_id),
    INDEX idx_refresh_tokens_expires_at (expires_at),
    INDEX idx_refresh_tokens_revoked_at (revoked_at),
    INDEX idx_refresh_tokens_user_device (user_id, device_type)
);