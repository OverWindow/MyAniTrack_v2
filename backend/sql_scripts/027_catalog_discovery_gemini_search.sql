USE myanitrack_v2;

ALTER TABLE catalog_discovery_runs
  MODIFY COLUMN search_model VARCHAR(100) NOT NULL DEFAULT 'gemini-3.5-flash-lite';
