CREATE TABLE share_links (
  id BIGINT NOT NULL AUTO_INCREMENT,
  owner_user_id BIGINT NOT NULL,
  resource_type ENUM('COLLECTION', 'ANALYSIS') NOT NULL,
  public_id CHAR(22) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  expires_at DATETIME NULL,
  revoked_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_share_links_owner_resource (owner_user_id, resource_type),
  UNIQUE KEY uq_share_links_public_id (public_id),
  KEY idx_share_links_public_lookup (public_id, revoked_at, expires_at),
  CONSTRAINT fk_share_links_owner
    FOREIGN KEY (owner_user_id) REFERENCES users(id)
    ON DELETE CASCADE
);
