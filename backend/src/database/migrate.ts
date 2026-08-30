import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/db';

const MIGRATION_FILE_PATTERN = /^(\d{3})_([a-z0-9_]+)\.sql$/;
const MIGRATION_LOCK_NAME = 'myanitrack:schema-migrations';
const MIGRATION_DIRECTORY = path.resolve(__dirname, '../../sql_scripts');

type MigrationFile = {
  version: number;
  name: string;
  filename: string;
  sql: string;
  checksum: string;
  compatibleChecksums: ReadonlySet<string>;
};

type AppliedMigrationRow = RowDataPacket & { version: number; name: string; checksum: string };
type CountRow = RowDataPacket & { count: number | string };
type LockRow = RowDataPacket & { acquired: number | null };

type LegacyMigrationCheck = {
  version: number;
  resumable?: boolean;
  tables?: string[];
  columns?: Array<{ table: string; column: string }>;
  indexes?: Array<{ table: string; index: string }>;
  routines?: string[];
};

export type LegacyMigrationState = 'present' | 'absent' | 'partial';

function sha256(source: string) {
  return createHash('sha256').update(source).digest('hex');
}

export function calculateMigrationChecksums(source: string) {
  const normalized = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const checksum = sha256(normalized);

  // New migrations use the canonical LF checksum. The alternatives keep
  // databases created from older CRLF or raw-file checkouts compatible.
  return {
    checksum,
    compatibleChecksums: new Set([
      checksum,
      sha256(normalized.replace(/\n/g, '\r\n')),
      sha256(source),
    ]),
  };
}

const LEGACY_MIGRATION_CHECKS: LegacyMigrationCheck[] = [
  { version: 1, tables: ['anime', 'anime_genres', 'anime_tags', 'anime_synonyms', 'users', 'user_anime_lists'] },
  { version: 2, tables: ['anime_korean_titles'] },
  { version: 3, tables: ['refresh_tokens'] },
  { version: 4, columns: [{ table: 'users', column: 'anime_list_count' }] },
  { version: 5, tables: ['user_anime_stats'] },
  { version: 6, columns: [
    { table: 'user_anime_stats', column: 'top_watched_genre_top_anime' },
    { table: 'user_anime_stats', column: 'top_rated_genre_top_anime' },
  ] },
  { version: 7, tables: ['friend_requests', 'friendships'] },
  { version: 8, columns: [{ table: 'users', column: 'role' }] },
  { version: 9, tables: ['user_agreements'], columns: [
    { table: 'users', column: 'terms_agreed' },
    { table: 'users', column: 'privacy_agreed' },
    { table: 'users', column: 'agreed_at' },
  ] },
  { version: 10, tables: ['email_verification_tokens'], columns: [
    { table: 'users', column: 'email_verified' },
    { table: 'users', column: 'email_verified_at' },
  ] },
  { version: 11, tables: ['characters', 'voice_actors', 'anime_characters', 'anime_character_voice_actors', 'anime_cast_sync_state'] },
  { version: 12, tables: ['badges', 'user_badges'] },
  { version: 13, columns: [
    { table: 'anime_korean_titles', column: 'is_locked' },
    { table: 'anime_korean_titles', column: 'locked_at' },
    { table: 'anime_korean_titles', column: 'locked_by' },
    { table: 'anime_korean_titles', column: 'source' },
  ] },
  { version: 14, tables: ['user_analysis_state', 'user_voice_actor_stats'] },
  { version: 15, tables: ['studios', 'anime_studios', 'anime_studio_sync_state'] },
  { version: 16, columns: [
    { table: 'users', column: 'supabase_user_id' },
    { table: 'users', column: 'auth_provider' },
  ], indexes: [{ table: 'users', index: 'uq_users_supabase_user_id' }] },
  { version: 17, tables: ['anime_relations', 'anime_relation_sync_state'] },
  { version: 18, tables: ['anime_series', 'anime_series_members'], columns: [
    { table: 'anime_series_members', column: 'is_completion_required' },
    { table: 'anime_series_members', column: 'completion_exclusion_reason' },
  ], routines: ['rebuild_anime_series'] },
  { version: 19, resumable: true, tables: ['user_blocks', 'profile_reports'], columns: [
    { table: 'anime', column: 'app_visible' },
    { table: 'anime', column: 'visibility_reason' },
    { table: 'anime', column: 'visibility_updated_at' },
    { table: 'users', column: 'moderation_status' },
    { table: 'users', column: 'suspended_at' },
    { table: 'users', column: 'suspension_reason' },
  ] },
];

export function splitSqlStatements(source: string) {
  const statements: string[] = [];
  let delimiter = ';';
  let buffer: string[] = [];

  const flush = () => {
    const statement = buffer.join('\n').trim();
    buffer = [];
    if (statement && !/^USE\s+[`\w-]+$/i.test(statement)) statements.push(statement);
  };

  for (const rawLine of source.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const delimiterMatch = rawLine.trim().match(/^DELIMITER\s+(\S+)$/i);

    if (delimiterMatch) {
      if (buffer.some((line) => line.trim())) {
        throw new Error('DELIMITER cannot change in the middle of a SQL statement');
      }
      delimiter = delimiterMatch[1];
      continue;
    }

    buffer.push(rawLine);
    const trimmed = rawLine.trimEnd();
    if (trimmed.endsWith(delimiter)) {
      buffer[buffer.length - 1] = trimmed.slice(0, -delimiter.length);
      flush();
    }
  }

  if (buffer.some((line) => line.trim())) throw new Error('SQL migration has an unterminated statement');
  return statements;
}

async function loadMigrationFiles() {
  const entries = await fs.readdir(MIGRATION_DIRECTORY, { withFileTypes: true });
  const filenames = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.sql'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
  const migrations: MigrationFile[] = [];
  const seenVersions = new Set<number>();

  for (const filename of filenames) {
    const match = filename.match(MIGRATION_FILE_PATTERN);
    if (!match) throw new Error(`Invalid migration filename: ${filename}. Expected NNN_snake_case.sql`);

    const version = Number(match[1]);
    if (seenVersions.has(version)) throw new Error(`Duplicate migration version: ${match[1]}`);
    seenVersions.add(version);

    const sql = await fs.readFile(path.join(MIGRATION_DIRECTORY, filename), 'utf8');
    const { checksum, compatibleChecksums } = calculateMigrationChecksums(sql);
    migrations.push({
      version,
      name: match[2],
      filename,
      sql,
      checksum,
      compatibleChecksums,
    });
  }

  if (migrations.length === 0) throw new Error('No SQL migration files were found');
  if (migrations[0].version !== 1) {
    throw new Error(`Migration versions must start at 001, found ${migrations[0].filename}`);
  }

  for (let index = 1; index < migrations.length; index += 1) {
    if (migrations[index].version !== migrations[index - 1].version + 1) {
      throw new Error(`Migration versions must be contiguous: ${migrations[index - 1].filename} -> ${migrations[index].filename}`);
    }
  }

  return migrations;
}

async function createMigrationTable(connection: PoolConnection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INT UNSIGNED NOT NULL,
      name VARCHAR(255) NOT NULL,
      checksum CHAR(64) NOT NULL,
      execution_ms INT UNSIGNED NOT NULL DEFAULT 0,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (version),
      UNIQUE KEY uq_schema_migrations_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function objectExists(
  connection: PoolConnection,
  informationSchemaTable: 'TABLES' | 'COLUMNS' | 'STATISTICS' | 'ROUTINES',
  conditions: Array<{ field: string; value: string }>
) {
  const schemaField = informationSchemaTable === 'ROUTINES' ? 'ROUTINE_SCHEMA' : 'TABLE_SCHEMA';
  const where = conditions.map(({ field }) => `${field} = ?`).join(' AND ');
  const [rows] = await connection.query<CountRow[]>(
    `SELECT COUNT(*) AS count FROM information_schema.${informationSchemaTable} WHERE ${schemaField} = DATABASE() AND ${where}`,
    conditions.map(({ value }) => value)
  );
  return Number(rows[0]?.count ?? 0) > 0;
}

export function classifyLegacyMigrationState(objectStates: boolean[]): LegacyMigrationState {
  if (objectStates.every(Boolean)) return 'present';
  if (objectStates.every((exists) => !exists)) return 'absent';
  return 'partial';
}

async function inspectLegacyMigrationState(connection: PoolConnection, check: LegacyMigrationCheck) {
  const objectStates: boolean[] = [];

  for (const table of check.tables ?? []) {
    objectStates.push(await objectExists(connection, 'TABLES', [{ field: 'TABLE_NAME', value: table }]));
  }
  for (const { table, column } of check.columns ?? []) {
    objectStates.push(await objectExists(connection, 'COLUMNS', [
      { field: 'TABLE_NAME', value: table },
      { field: 'COLUMN_NAME', value: column },
    ]));
  }
  for (const { table, index } of check.indexes ?? []) {
    objectStates.push(await objectExists(connection, 'STATISTICS', [
      { field: 'TABLE_NAME', value: table },
      { field: 'INDEX_NAME', value: index },
    ]));
  }
  for (const routine of check.routines ?? []) {
    objectStates.push(await objectExists(connection, 'ROUTINES', [
      { field: 'ROUTINE_NAME', value: routine },
      { field: 'ROUTINE_TYPE', value: 'PROCEDURE' },
    ]));
  }

  return classifyLegacyMigrationState(objectStates);
}

async function baselineLegacyDatabase(connection: PoolConnection, migrations: MigrationFile[]) {
  const [historyRows] = await connection.query<CountRow[]>('SELECT COUNT(*) AS count FROM schema_migrations');
  if (Number(historyRows[0]?.count ?? 0) > 0) return;
  if (!await objectExists(connection, 'TABLES', [{ field: 'TABLE_NAME', value: 'anime' }])) return;

  const inspectedMigrations: Array<{ migration: MigrationFile; state: LegacyMigrationState }> = [];

  for (const check of LEGACY_MIGRATION_CHECKS) {
    const migration = migrations.find((item) => item.version === check.version);
    if (!migration) {
      throw new Error(`Legacy baseline migration ${String(check.version).padStart(3, '0')} is missing`);
    }

    const state = await inspectLegacyMigrationState(connection, check);
    if (state === 'partial' && !check.resumable) {
      throw new Error(
        `Existing database only partially matches ${migration.filename}. `
        + 'Repair the partial schema before deploying.'
      );
    }

    inspectedMigrations.push({ migration, state: state === 'partial' ? 'absent' : state });
  }

  for (const { migration, state } of inspectedMigrations) {
    if (state === 'present') {
      await connection.query(
        'INSERT INTO schema_migrations (version, name, checksum, execution_ms) VALUES (?, ?, ?, 0)',
        [migration.version, migration.name, migration.checksum]
      );
      console.log(`[db:migrate] baselined ${migration.filename}`);
    } else {
      console.log(`[db:migrate] pending legacy migration ${migration.filename}`);
    }
  }
}

async function readAppliedMigrations(connection: PoolConnection) {
  const [rows] = await connection.query<AppliedMigrationRow[]>(
    'SELECT version, name, checksum FROM schema_migrations ORDER BY version'
  );
  return new Map(rows.map((row) => [Number(row.version), row]));
}

async function applyMigration(connection: PoolConnection, migration: MigrationFile) {
  const startedAt = Date.now();
  for (const statement of splitSqlStatements(migration.sql)) await connection.query(statement);

  const executionMs = Date.now() - startedAt;
  await connection.query(
    'INSERT INTO schema_migrations (version, name, checksum, execution_ms) VALUES (?, ?, ?, ?)',
    [migration.version, migration.name, migration.checksum, executionMs]
  );
  console.log(`[db:migrate] applied ${migration.filename} (${executionMs}ms)`);
}

export async function runMigrations() {
  const migrations = await loadMigrationFiles();
  const connection = await pool.getConnection();
  let lockAcquired = false;

  try {
    const [lockRows] = await connection.query<LockRow[]>('SELECT GET_LOCK(?, 60) AS acquired', [MIGRATION_LOCK_NAME]);
    lockAcquired = lockRows[0]?.acquired === 1;
    if (!lockAcquired) throw new Error('Could not acquire the database migration lock');

    await createMigrationTable(connection);
    await baselineLegacyDatabase(connection, migrations);
    const applied = await readAppliedMigrations(connection);

    for (const migration of migrations) {
      const existing = applied.get(migration.version);
      if (existing) {
        if (existing.name !== migration.name || !migration.compatibleChecksums.has(existing.checksum)) {
          throw new Error(`Applied migration ${migration.version} differs from ${migration.filename}. Never edit an applied migration.`);
        }
        continue;
      }
      await applyMigration(connection, migration);
    }

    console.log(`[db:migrate] schema is current (${migrations.length} migrations)`);
  } finally {
    if (lockAcquired) {
      await connection.query('SELECT RELEASE_LOCK(?)', [MIGRATION_LOCK_NAME]).catch(() => undefined);
    }
    connection.release();
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => pool.end())
    .catch(async (error) => {
      console.error('[db:migrate] failed', error);
      await pool.end().catch(() => undefined);
      process.exitCode = 1;
    });
}
