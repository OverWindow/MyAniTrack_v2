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
