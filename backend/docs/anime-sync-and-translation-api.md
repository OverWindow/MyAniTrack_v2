# Anime Sync And Translation API

## Overview

This document summarizes the anime data sync APIs and the Korean title translation API currently implemented in the backend.

- Base URL: `http://localhost:4000`
- Sync and translation admin routes are defined in `backend/routes/admin.routes.ts`
- Anime sync data is fetched from AniList GraphQL
- Anime records are stored and updated through `upsertAnimeFull`

## Anime Sync APIs

### `POST /admin/anime/sync/page`

Syncs exactly one AniList page into MySQL.

Request body:

```json
{
  "page": 2,
  "perPage": 50
}
```

Response example:

```json
{
  "success": true,
  "message": "Anime page synced successfully",
  "result": {
    "page": 2,
    "lastPage": 100,
    "count": 50,
    "hasNextPage": true
  }
}
```

### `POST /admin/anime/sync/all`

Syncs multiple AniList pages continuously starting from `startPage`.

Request body:

```json
{
  "startPage": 1,
  "perPage": 50,
  "maxPages": 20
}
```

Response example:

```json
{
  "success": true,
  "message": "Anime sync completed",
  "result": {
    "processedPages": 20,
    "totalAnime": 1000,
    "nextPage": 21,
    "finished": false
  }
}
```

### `POST /admin/anime/sync/chunked`

Runs sync in page chunks. This is useful when you want to avoid one very long request.

Default behavior:

- `pagesPerChunk`: `10`
- `chunkDelayMs`: `10000`

Request body:

```json
{
  "startPage": 1,
  "perPage": 50,
  "pagesPerChunk": 10,
  "chunkDelayMs": 10000,
  "maxChunks": 3
}
```

Response example:

```json
{
  "success": true,
  "message": "Anime chunked sync completed",
  "result": {
    "startPage": 1,
    "perPage": 50,
    "pagesPerChunk": 10,
    "chunkDelayMs": 10000,
    "processedChunks": 3,
    "processedPages": 30,
    "totalAnime": 1500,
    "nextPage": 31,
    "finished": false
  }
}
```

### `POST /admin/anime/sync/season`

Syncs anime for one AniList season and year. Existing anime is updated, missing anime is inserted.

If `season` and `seasonYear` are omitted, the backend uses the current season automatically.

Allowed `season` values:

- `WINTER`
- `SPRING`
- `SUMMER`
- `FALL`

Request body:

```json
{
  "season": "SPRING",
  "seasonYear": 2026,
  "startPage": 1,
  "perPage": 50,
  "maxPages": 5
}
```

Response example:

```json
{
  "success": true,
  "message": "Season anime sync completed",
  "result": {
    "season": "SPRING",
    "seasonYear": 2026,
    "processedPages": 3,
    "totalAnime": 120,
    "nextPage": null,
    "finished": true
  }
}
```

## Sync Storage Behavior

All sync APIs eventually do the following:

1. Fetch anime data from AniList.
2. Run `upsertAnimeFull(anime)` for each anime.
3. Update the main `anime` row if the same AniList ID already exists.
4. Insert a new `anime` row if it does not exist.
5. Refresh genres and tags for that anime.

Current sync timing defaults:

- Request delay between AniList pages: `2500ms`
- Delay between chunk batches: `10000ms`

## Korean Title Translation API

### Purpose

This API translates anime titles into Korean and stores them into the `anime_korean_titles` table.

The API is designed to avoid retranslating titles that were already stored.

Selection rule:

- Only anime rows without a matching row in `anime_korean_titles` are selected.
- The source title is chosen in this order:
  - `title_english`
  - `title_romaji`
  - `title_user_preferred`
  - `title_native`

### `POST /admin/anime/korean-titles/translate`

Translates anime titles in batches and stores them.

Request headers:

```http
Content-Type: application/json
```

Request body:

```json
{
  "batchSize": 100,
  "maxBatches": 1
}
```

Parameter details:

- `batchSize`: how many untranslated anime titles to select per batch
- `maxBatches`: how many batches to process in one request

Request format summary:

- The endpoint expects a JSON object.
- Both fields are optional.
- If omitted:
  - `batchSize` defaults to `100`
  - `maxBatches` defaults to `1`

Minimal request example:

```json
{}
```

Recommended request example:

```json
{
  "batchSize": 100,
  "maxBatches": 1
}
```

Example for processing multiple batches in one call:

```json
{
  "batchSize": 100,
  "maxBatches": 5
}
```

curl example:

```bash
curl -X POST http://localhost:4000/admin/anime/korean-titles/translate \
  -H "Content-Type: application/json" \
  -d '{
    "batchSize": 100,
    "maxBatches": 1
  }'
```

Response example:

```json
{
  "success": true,
  "message": "Anime Korean title translation completed",
  "result": {
    "batchSize": 100,
    "maxBatches": 1,
    "processedBatches": 1,
    "totalSaved": 100,
    "remaining": true,
    "results": [
      {
        "requestedBatchSize": 100,
        "selectedCount": 100,
        "savedCount": 100,
        "remaining": true,
        "items": [
          {
            "animeId": 1,
            "title": "한국어 제목",
            "subtitle": "",
            "isPrimary": true
          }
        ]
      }
    ]
  }
}
```

## Translation Payload Details

The backend request you send to the translation API is only:

```json
{
  "batchSize": 100,
  "maxBatches": 1
}
```

You do not send anime title data directly from the client.

The server automatically:

1. Finds untranslated anime in MySQL.
2. Builds the AI request payload internally.
3. Sends an array like this to the AI model:

```json
[
  {
    "animeId": 123,
    "sourceTitle": "Attack on Titan"
  },
  {
    "animeId": 456,
    "sourceTitle": "Kaguya-sama: Love is War"
  }
]
```

The AI is expected to return JSON in this exact shape:

```json
[
  {
    "animeId": 123,
    "title": "진격의 거인",
    "subtitle": "",
    "isPrimary": true
  },
  {
    "animeId": 456,
    "title": "카구야 님은 고백받고 싶어",
    "subtitle": "",
    "isPrimary": true
  }
]
```

Field meanings:

- `animeId`: internal `anime.id` from MySQL
- `title`: main Korean title
- `subtitle`: optional Korean subtitle, empty string if unnecessary
- `isPrimary`: whether this is the main Korean title, currently stored as `true` by default

## Translation Storage Behavior

Translated rows are stored in:

- `anime_korean_titles`

Expected schema:

```sql
CREATE TABLE anime_korean_titles (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  anime_id BIGINT NOT NULL,
  title VARCHAR(255) NOT NULL,
  subtitle VARCHAR(255) NULL,
  full_title VARCHAR(512) GENERATED ALWAYS AS (
    CASE
      WHEN subtitle IS NULL OR subtitle = '' THEN title
      ELSE CONCAT(title, ' ', subtitle)
    END
  ) STORED,
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_anime_title (anime_id, title, subtitle),
  KEY idx_title (title),
  KEY idx_full_title (full_title),
  CONSTRAINT fk_anime_korean_titles_anime
    FOREIGN KEY (anime_id) REFERENCES anime(id)
    ON DELETE CASCADE
);
```

Insert behavior:

- If a title does not exist yet for that anime, it is inserted.
- If the same unique combination already exists, it is updated through `ON DUPLICATE KEY UPDATE`.

## Translation AI Integration

The current translation implementation uses the following AI endpoint:

- `POST https://factchat-cloud.mindlogic.ai/v1/api/anthropic/messages`

Environment variables:

```env
AI_API_KEY=your_api_key
AI_MODEL=claude-sonnet-4-5-20250929
AI_API_URL=https://factchat-cloud.mindlogic.ai/v1/api/anthropic/messages
```

Fallback compatibility:

- `OPENAI_API_KEY` is also accepted if `AI_API_KEY` is not set

Current translation flow:

1. Select untranslated anime rows from MySQL.
2. Send up to `batchSize` titles to the AI API.
3. Require a strict JSON array response.
4. Validate one result per `animeId`.
5. Store translated titles into `anime_korean_titles`.
6. On the next request, already translated anime is skipped automatically.

## Implemented Admin APIs

- `POST /admin/anime/sync/page`
- `POST /admin/anime/sync/all`
- `POST /admin/anime/sync/chunked`
- `POST /admin/anime/sync/season`
- `POST /admin/anime/korean-titles/translate`
