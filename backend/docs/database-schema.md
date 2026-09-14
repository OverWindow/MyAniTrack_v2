# Database schema overview

Core catalog tables are `anime`, `anime_korean_titles`, `anime_genres`, `anime_tags`, `anime_synonyms`, `characters`, `voice_actors`, `studios`, and their internal-ID link tables.

Catalog ownership adds:

- `catalog_change_requests` and `catalog_change_request_sources`: private user/AI drafts and evidence
- `catalog_change_audit_logs`: approval, rejection, and direct-edit audit history
- `catalog_discovery_runs` and `catalog_discovery_items`: persistent AI worker state
- `anime_community_metrics`: score, rating, and collection aggregates

`catalog_image_assets` identifies catalog images by internal `entity_type`, `entity_id`, and `variant`. Existing CloudFront object URLs are preserved. New public catalog images are administrator uploads validated by MIME type, size, and storage checksum.

Migration `025_catalog_ownership.sql` keeps resolved relations as internal anime links, recalculates community metrics, and removes external-only identifiers and synchronization state from public catalog tables. Migration `029_retired_catalog_provenance_cleanup.sql` removes the retired private source-reference table and clears obsolete image-source metadata while preserving stored image objects and public URLs.
