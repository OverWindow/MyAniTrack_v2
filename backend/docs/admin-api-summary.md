# Admin API Summary

관리자 전용 API 요약입니다.

- Base URL: `http://<host>:<port>`
- 인증: `Authorization: Bearer <admin accessToken>`
- 권한: `users.role = 'ADMIN'`
- 성공 응답 기본 형식: `{ "success": true, ... }`
- 실패 응답 기본 형식: `{ "success": false, "message": "..." }`

## Anime Sync

### `POST /admin/anime/sync/page`
AniList 애니 데이터를 한 페이지 동기화합니다.

Body 예시:

```json
{
  "page": 1,
  "perPage": 50
}
```

Response 예시:

```json
{
  "success": true,
  "message": "Anime page synced successfully",
  "result": {
    "page": 1,
    "lastPage": 100,
    "count": 50,
    "hasNextPage": true
  }
}
```

### `POST /admin/anime/sync/all`
여러 페이지를 연속 동기화합니다.

Body 예시:

```json
{
  "startPage": 1,
  "maxPages": 20,
  "perPage": 50
}
```

### `POST /admin/anime/sync/chunked`
청크 단위로 애니 동기화를 실행합니다.

Body 예시:

```json
{
  "startPage": 1,
  "chunkSize": 10,
  "maxChunks": 3,
  "perPage": 50
}
```

### `POST /admin/anime/sync/season`
특정 시즌 애니를 동기화합니다.

Body 예시:

```json
{
  "season": "SPRING",
  "seasonYear": 2026,
  "perPage": 50
}
```

## Korean Titles

### `POST /admin/anime/korean-titles/translate`
자동 한국어 제목 번역 배치를 실행합니다.

Body 예시:

```json
{
  "batchSize": 100,
  "maxBatches": 1
}
```

주의:

- `anime_korean_titles.is_locked = true`인 애니 제목은 자동 번역/저장 대상에서 제외됩니다.
- 자동 저장되는 제목은 `source = 'AUTO'`로 기록됩니다.

### `PATCH /admin/anime/:animeId/korean-title`
관리자가 특정 애니의 대표 한국어 제목을 직접 수정합니다.

Body:

```json
{
  "title": "장송의 프리렌",
  "subtitle": ""
}
```

동작:

- 새 제목을 대표 제목으로 저장합니다.
- `is_locked = true`
- `locked_at = CURRENT_TIMESTAMP`
- `locked_by = 관리자 user id`
- `source = 'MANUAL'`
- 기존 대표 한국어 제목은 대표 상태가 해제됩니다.
- 잠금 처리된 제목은 관리자가 다시 수정하지 않는 한 자동 번역 로직으로 변경되지 않습니다.

Response 예시:

```json
{
  "success": true,
  "message": "Anime Korean title updated and locked",
  "item": {
    "animeId": 123,
    "title": "장송의 프리렌",
    "subtitle": null,
    "fullTitle": "장송의 프리렌",
    "isPrimary": true,
    "isLocked": true,
    "source": "MANUAL"
  }
}
```

## Badges

### `POST /api/admin/badges/recalculate-all`
모든 사용자의 배지 상태를 새로고침합니다.

이 API는 `server.ts`에서 `/api` prefix가 붙는 라우트에 연결되어 있으므로 경로가 `/api/admin/badges/recalculate-all`입니다.

동작:

- 기본 배지 3개를 `badges` 테이블에 upsert합니다.
- 기준은 `user_anime_stats.completedCount`입니다.
- `COMPLETED_COUNT >= 100`: `ANIME_TOTAL_100`
- `COMPLETED_COUNT >= 200`: `ANIME_TOTAL_200`
- `COMPLETED_COUNT >= 300`: `ANIME_TOTAL_300`
- 조건을 만족하면 `user_badges`에 추가합니다.
- 더 이상 조건을 만족하지 않는 기존 획득 배지는 제거합니다.

기본 배지 이미지:

- `badges/watch-badge100.png`
- `badges/watch-badge200.png`
- `badges/watch-badge300.png`

이미지 URL은 `{SUPABASE_URL}/storage/v1/object/public/{SUPABASE_STORAGE_BUCKET}/badges/...` 형태로 저장됩니다.

Response 예시:

```json
{
  "success": true,
  "message": "All user badges recalculated",
  "processedUserCount": 42,
  "newlyEarnedCount": 7,
  "revokedCount": 2
}
```

## Status Codes

- `400`: 요청 값 오류
- `401`: access token 없음 또는 만료
- `403`: 관리자 권한 없음
- `404`: 대상 리소스 없음
- `500`: 서버 내부 오류
