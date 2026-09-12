import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { calculateMigrationChecksums, classifyLegacyMigrationState, splitSqlStatements } from './migrate';

test('migration checksums are independent of line endings', () => {
  const lfSql = 'CREATE TABLE example (id INT);\nINSERT INTO example VALUES (1);';
  const crlfSql = lfSql.replace(/\n/g, '\r\n');
  const lfChecksums = calculateMigrationChecksums(lfSql);
  const crlfChecksums = calculateMigrationChecksums(crlfSql);

  assert.equal(lfChecksums.checksum, crlfChecksums.checksum);
  assert.deepEqual(
    [...lfChecksums.compatibleChecksums].sort(),
    [...crlfChecksums.compatibleChecksums].sort()
  );
});

test('migration checksums still detect SQL content changes', () => {
  const original = calculateMigrationChecksums('SELECT 1;');
  const changed = calculateMigrationChecksums('SELECT 2;');

  assert.notEqual(original.checksum, changed.checksum);
  assert.equal(original.compatibleChecksums.has(changed.checksum), false);
});

test('provider-neutral migrations accept only their pinned deployed checksums', () => {
  const cases = [
    [1, '001_table_creation.sql', 'b141e340c94015cf2f61967abd00c29a2275d6a6dac6e61cbecb0f43e3295fe0'],
    [11, '011_character_voice_actor.sql', 'ffcee5a0598af97cdb21966379f531aada602c3ae7d8295b1acd758431aead3a'],
    [15, '015_anime_studios.sql', '7a8d76b4634ac2fb5d21477e8bddd7676c9dc12e2e1a0aec1850aa8e942458ed'],
    [17, '017_anime_relations.sql', '741cb3708fec086d7bee0de1ccd893512f658712e1c0ae9fc02a904b84cfc4df'],
    [18, '018_anime_series.sql', 'fff5fc5a7822b70bfb95a290c3f303297eb45470af0edb3b4e243e1003bdfb51'],
    [23, '023_catalog_image_sync.sql', 'b50607aaaf9a0dc8d80afc3fb4af257fd338db10e9a746ec4c41e1f6340b33da'],
    [24, '024_s3_image_storage.sql', 'd0ad28e39791824d942574261c0333dde1f3eaca2de6e8fc4af24c651f28fdcd'],
    [25, '025_catalog_ownership.sql', '61e2ee48343fd0df7a5757d0bd466cbd9aa741a9e8902fe64396ff89e2c29c60'],
  ] as const;

  for (const [version, filename, deployedChecksum] of cases) {
    const migration = readFileSync(join(process.cwd(), 'sql_scripts', filename), 'utf8');
    const checksums = calculateMigrationChecksums(migration, version);
    assert.equal(checksums.compatibleChecksums.has(deployedChecksum), true, filename);
    assert.equal(
      calculateMigrationChecksums(`${migration}\nSELECT 1;`, version).compatibleChecksums.has(deployedChecksum),
      false,
      `${filename} accepted a deployed checksum after an unpinned edit`
    );
    assert.equal(checksums.compatibleChecksums.has('0'.repeat(64)), false, filename);
  }
});

test('legacy migration state distinguishes present, absent, and partial schemas', () => {
  assert.equal(classifyLegacyMigrationState([true, true]), 'present');
  assert.equal(classifyLegacyMigrationState([false, false]), 'absent');
  assert.equal(classifyLegacyMigrationState([true, false]), 'partial');
});

test('splitSqlStatements ignores USE and splits ordinary statements', () => {
  const statements = splitSqlStatements(`
USE myanitrack_v2;
CREATE TABLE example (id INT PRIMARY KEY);
INSERT INTO example (id) VALUES (1);
`);

  assert.deepEqual(statements, [
    'CREATE TABLE example (id INT PRIMARY KEY)',
    'INSERT INTO example (id) VALUES (1)',
  ]);
});

test('splitSqlStatements preserves procedure statements with a custom delimiter', () => {
  const statements = splitSqlStatements(`
DELIMITER $$
CREATE PROCEDURE example_procedure()
BEGIN
  INSERT INTO example (id) VALUES (1);
  INSERT INTO example (id) VALUES (2);
END$$
DELIMITER ;
CALL example_procedure();
`);

  assert.equal(statements.length, 2);
  assert.match(statements[0], /^CREATE PROCEDURE example_procedure/);
  assert.match(statements[0], /VALUES \(1\);/);
  assert.match(statements[0], /VALUES \(2\);/);
  assert.equal(statements[1], 'CALL example_procedure()');
});

test('all repository migrations are numbered contiguously and parse successfully', () => {
  const migrationDirectory = join(process.cwd(), 'sql_scripts');
  const filenames = readdirSync(migrationDirectory)
    .filter((filename) => filename.endsWith('.sql'))
    .sort();

  assert.ok(filenames.length > 0);
  filenames.forEach((filename, index) => {
    const match = filename.match(/^(\d{3})_[a-z0-9_]+\.sql$/);
    assert.ok(match, `invalid migration filename: ${filename}`);
    assert.equal(Number(match[1]), index + 1, `migration sequence is not contiguous at ${filename}`);
    assert.ok(splitSqlStatements(readFileSync(join(migrationDirectory, filename), 'utf8')).length > 0);
  });
});
