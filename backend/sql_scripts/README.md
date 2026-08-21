# Database migrations

The backend applies SQL migrations automatically before it starts accepting HTTP requests.
Migration history is stored in the `schema_migrations` table.

## Adding a migration

1. Create the next contiguous file using `NNN_snake_case.sql`.
2. Put only forward changes in the file. Do not edit a migration that has already been deployed.
3. Run `npm test` and `npm run typecheck` from `backend`.
4. Use `npm run migrate` only when a manual migration run is intentionally required.

The next migration after the current set is `020_description.sql`.

## Deployment behavior

- The server obtains a MySQL advisory lock so only one instance migrates at a time.
- A fresh database runs all migrations beginning with `001`.
- An existing legacy database without migration history records migrations whose schema objects are already present as its baseline and applies migrations whose objects are entirely absent.
- A partially applied legacy migration stops startup so conflicting DDL is never retried automatically.
- Pending files are applied in version order and recorded with their SHA-256 checksum.
- A failed migration or a changed checksum stops server startup.
- `USE` statements in migration files are ignored; the configured `DB_NAME` is always used.
- Stored procedures may use MySQL `DELIMITER` directives.
