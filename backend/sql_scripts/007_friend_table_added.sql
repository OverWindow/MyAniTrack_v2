USE myanitrack_v2;
CREATE TABLE friend_requests (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  requester_id BIGINT NOT NULL,
  receiver_id BIGINT NOT NULL,
  status ENUM('pending', 'accepted', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  responded_at DATETIME NULL,

  CONSTRAINT fk_friend_requests_requester
    FOREIGN KEY (requester_id) REFERENCES users(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_friend_requests_receiver
    FOREIGN KEY (receiver_id) REFERENCES users(id)
    ON DELETE CASCADE,

  CONSTRAINT chk_friend_requests_not_self
    CHECK (requester_id <> receiver_id),

  UNIQUE KEY uq_friend_request_pair (requester_id, receiver_id),
  KEY idx_friend_requests_receiver_status (receiver_id, status),
  KEY idx_friend_requests_requester_status (requester_id, status)
);

CREATE TABLE friendships (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  friend_user_id BIGINT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_friendships_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_friendships_friend_user
    FOREIGN KEY (friend_user_id) REFERENCES users(id)
    ON DELETE CASCADE,

  CONSTRAINT chk_friendships_not_self
    CHECK (user_id <> friend_user_id),

  UNIQUE KEY uq_friendship_pair (user_id, friend_user_id),
  KEY idx_friendships_user_id (user_id),
  KEY idx_friendships_friend_user_id (friend_user_id)
);
