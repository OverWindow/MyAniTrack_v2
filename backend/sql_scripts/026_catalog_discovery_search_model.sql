USE myanitrack_v2;

ALTER TABLE catalog_discovery_runs
  ADD COLUMN search_model VARCHAR(100) NOT NULL DEFAULT 'sonar-pro' AFTER model;
