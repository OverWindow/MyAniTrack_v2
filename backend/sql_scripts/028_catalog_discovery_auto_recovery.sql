USE myanitrack_v2;

ALTER TABLE catalog_discovery_runs
  ADD COLUMN auto_recovery_count TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER cancel_requested;
