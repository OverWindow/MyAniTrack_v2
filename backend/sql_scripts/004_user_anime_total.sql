USE myanitrack_v2;

ALTER TABLE users
ADD COLUMN anime_list_count INT NOT NULL DEFAULT 0;

UPDATE users u
LEFT JOIN (
  SELECT user_id, COUNT(*) AS cnt
  FROM user_anime_lists
  GROUP BY user_id
) t ON t.user_id = u.id
SET u.anime_list_count = COALESCE(t.cnt, 0);