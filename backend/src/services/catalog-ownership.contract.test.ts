import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8');

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const target = path.join(directory, name);
    return statSync(target).isDirectory() ? sourceFiles(target) : target.endsWith('.ts') && !target.endsWith('.test.ts') ? [target] : [];
  });
}

test('runtime catalog code contains no retired synchronization route', () => {
  const runtime = [path.join(root, 'server.ts'), ...sourceFiles(path.join(root, 'routes')), ...sourceFiles(path.join(root, 'src'))]
    .map((file) => readFileSync(file, 'utf8')).join('\n');
  assert.doesNotMatch(runtime, /\/admin\/anime\/sync|catalog-images\/sync|sync\/cast/i);
});

test('ownership migration removes legacy identifiers and synchronization state without archiving them', () => {
  const migration = read('sql_scripts/025_catalog_ownership.sql');
  assert.doesNotMatch(migration, /catalog_source_refs/);
  assert.match(migration, /ORDINAL_POSITION = 2[\s\S]*DROP COLUMN/);
  assert.match(migration, /INSERT INTO anime_community_metrics[\s\S]*AVG\(ual\.score\)[\s\S]*COUNT\(ual\.id\)/);
  assert.match(migration, /DROP TABLE IF EXISTS anime_cast_sync_state/);
  assert.match(migration, /DROP TABLE catalog_image_sync_jobs/);
});

test('retired provenance cleanup removes references and source metadata while preserving stored images', () => {
  const migration = read('sql_scripts/029_retired_catalog_provenance_cleanup.sql');
  assert.match(migration, /DROP TABLE IF EXISTS catalog_source_refs/);
  assert.match(migration, /source_url = NULL[\s\S]*source_hash = NULL[\s\S]*source_provider = 'unknown'/);
  assert.match(migration, /WHERE source_provider = 'legacy_external'/);
  assert.match(migration, /entity_type IN \('anime', 'character', 'voice_actor'\)[\s\S]*source_provider <> 'admin_upload'/);
  assert.match(migration, /DEFAULT 'unknown'/);
  assert.doesNotMatch(migration, /object_key\s*=|public_url\s*=|storage_provider\s*=/);
});

test('score ordering uses community average, rating count, then stable internal id', () => {
  const animeService = read('src/services/anime.service.ts');
  assert.match(animeService, /SCORE_SORT_SQL\} DESC, COALESCE\(acm\.rating_count, 0\) DESC, a\.id DESC/);
});

test('approval is serialized and has an explicit rollback path', () => {
  const catalogService = read('src/services/catalog.service.ts');
  assert.match(catalogService, /approveCatalogSubmission[\s\S]*beginTransaction\(\)[\s\S]*GET_LOCK[\s\S]*commit\(\)[\s\S]*rollback\(\)/);
  assert.match(catalogService, /LINK_TO_ANIME[\s\S]*linkEntityToAnime/);
});

test('admin catalog exposes protected taxonomy and full entity detail routes before mutation routes', () => {
  const routes = read('routes/admin.routes.ts');
  const taxonomyAt = routes.indexOf("router.get('/admin/catalog/taxonomy'");
  const detailAt = routes.indexOf("router.get('/admin/catalog/entities/:type/:id'");
  const createAt = routes.indexOf("router.post('/admin/catalog/entities/:type'");
  assert.ok(routes.indexOf("router.use('/admin', requireAdmin)") >= 0);
  assert.ok(taxonomyAt >= 0);
  assert.ok(detailAt >= 0 && detailAt < createAt);
});

test('catalog taxonomy is usage ordered and entity details include every anime graph section', () => {
  const catalogService = read('src/services/catalog.service.ts');
  assert.match(catalogService, /getCatalogTaxonomy[\s\S]*GROUP BY genre[\s\S]*ORDER BY usageCount DESC, value ASC/);
  assert.match(catalogService, /GROUP BY tag_name[\s\S]*ORDER BY usageCount DESC, value ASC/);
  assert.match(catalogService, /getAdminCatalogEntity[\s\S]*anime_korean_titles[\s\S]*anime_genres[\s\S]*anime_tags[\s\S]*anime_synonyms[\s\S]*anime_studios[\s\S]*anime_characters[\s\S]*anime_character_voice_actors[\s\S]*anime_relations/);
  assert.match(catalogService, /requireExistingTaxonomyValues[\s\S]*must use existing taxonomy values/);
});
