USE myanitrack_v2;

ALTER TABLE users
ADD COLUMN supabase_user_id CHAR(36) NULL COMMENT 'Supabase auth.users.id',
ADD COLUMN auth_provider VARCHAR(30) NULL COMMENT 'Last linked auth provider, e.g. google';

CREATE UNIQUE INDEX uq_users_supabase_user_id
ON users (supabase_user_id);
