USE myanitrack_v2;

DROP TABLE IF EXISTS catalog_source_refs;

UPDATE catalog_image_assets
SET
  source_url = NULL,
  source_hash = NULL,
  source_provider = 'unknown'
WHERE source_provider = 'legacy_external'
   OR (
     entity_type IN ('anime', 'character', 'voice_actor')
     AND source_provider <> 'admin_upload'
   );

ALTER TABLE catalog_image_assets
  MODIFY COLUMN source_provider VARCHAR(20) NOT NULL DEFAULT 'unknown';
