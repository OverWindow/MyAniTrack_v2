# Admin API Summary

관리자 전용 API 요약입니다.

- Base URL: `http://<host>:<port>`
- 인증: `Authorization: Bearer <admin accessToken>`
- 권한: `users.role = 'ADMIN'`
- 성공 응답 기본 형식: `{ "success": true, ... }`
- 실패 응답 기본 형식: `{ "success": false, "message": "..." }`

## Users

### `GET /admin/users`

관리자 권한으로 사용자 목록을 조회합니다. 비밀번호 해시와 Supabase 내부 사용자 ID는 응답하지 않습니다.

Query parameter:

- `page`: 페이지 번호, 기본 `1`
- `limit`: 페이지당 사용자 수, 기본 `20`, 최대 `100`
- `search`: 이메일 또는 사용자명 부분 검색, 최대 100자
- `role`: `ALL`, `USER`, `ADMIN`, 기본 `ALL` (소문자 입력도 허용)

호출 예시:

```http
GET /admin/users?page=1&limit=20&search=kim&role=USER
Authorization: Bearer <admin accessToken>
```

Response 예시:

```json
{
  "success": true,
  "items": [
    {
      "id": 42,
      "email": "user@example.com",
      "username": "anime_user",
      "role": "USER",
      "profileImageUrl": "https://...",
      "emailVerified": true,
      "emailVerifiedAt": "2026-07-01 12:00:00",
      "supabaseLinked": false,
      "animeListCount": 85,
      "completedCount": 40,
      "activeSessionCount": 2,
      "createdAt": "2026-06-01 10:00:00",
      "updatedAt": "2026-07-10 09:00:00"
    }
  ],
  "pageInfo": {
    "page": 1,
    "limit": 20,
    "totalItems": 1,
    "totalPages": 1,
    "hasPrevious": false,
    "hasNext": false
  },
  "filters": {
    "search": "kim",
    "role": "USER"
  }
}
```

사용자는 `id` 내림차순으로 반환됩니다.

### `GET /admin/users/:userId`

관리자 권한으로 특정 사용자의 계정 정보와 컬렉션 통계를 조회합니다.

`userId`는 양의 정수인 내부 `users.id`입니다.

호출 예시:

```http
GET /admin/users/42
Authorization: Bearer <admin accessToken>
```

Response 예시:

```json
{
  "success": true,
  "item": {
    "id": 42,
    "email": "user@example.com",
    "username": "anime_user",
    "role": "USER",
    "profileImageUrl": "https://...",
    "emailVerified": true,
    "emailVerifiedAt": "2026-07-01 12:00:00",
    "supabaseLinked": false,
    "animeListCount": 85,
    "completedCount": 40,
    "activeSessionCount": 2,
    "createdAt": "2026-06-01 10:00:00",
    "updatedAt": "2026-07-10 09:00:00",
    "bio": "애니메이션을 좋아합니다.",
    "collection": {
      "totalCount": 85,
      "plannedCount": 15,
      "watchingCount": 10,
      "completedCount": 40,
      "pausedCount": 5,
      "droppedCount": 15,
      "totalWatchedEpisodes": 620,
      "totalWatchMinutes": 14880,
      "averageScore": 8.25,
      "favoriteGenre": "Action",
      "favoriteReleasePeriod": "2020s",
      "statsUpdatedAt": "2026-07-10 09:00:00"
    }
  }
}
```

존재하지 않는 사용자이면 HTTP `404`와 `User not found`를 반환합니다.

## Platform Stats

### `GET /api/stats/platform`
관리자 페이지 상단 플랫폼 현황에서 사용하는 통계 API입니다.

현재 라우트는 공개 API지만, 프론트에서는 관리자 페이지에서만 주요 운영 지표로 사용합니다.

Response 예시:

```json
{
  "success": true,
  "item": {
    "registeredUserCount": 120,
    "storedAnimeCount": 8450,
    "translatedKoreanTitleCount": 5300,
    "translationProgressRate": 62.72,
    "castSyncedAnimeCount": 2100,
    "castSyncProgressRate": 24.85,
    "characterCount": 18340,
    "voiceActorCount": 4120
  }
}
```

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

### `POST /admin/anime/:animeId/sync/cast`
특정 애니의 캐릭터/성우 정보를 AniList에서 가져와 동기화합니다.

`animeId`는 AniList id가 아니라 내부 `anime.id`입니다.

Body 예시:

```json
{
  "language": "JAPANESE",
  "perPage": 25
}
```

동작:

- `characters`는 `anilist_id` 기준으로 upsert합니다.
- `voice_actors`는 `anilist_id` 기준으로 upsert합니다.
- 해당 애니의 `anime_characters`, `anime_character_voice_actors` 연결은 최신 AniList 결과 기준으로 재구성합니다.
- `anime_cast_sync_state`에 `syncing`, `success`, `failed` 상태와 실패 메시지를 저장합니다.

Response 예시:

```json
{
  "success": true,
  "message": "Anime cast synced successfully",
  "result": {
    "animeId": 123,
    "anilistId": 21858,
    "language": "JAPANESE",
    "perPage": 25,
    "processedPages": 2,
    "sourceUpdatedAt": "2026-06-28 10:00:00",
    "characterEdgeCount": 41,
    "characterCount": 41,
    "voiceActorCount": 38,
    "characterVoiceActorLinkCount": 38
  }
}
```

### `POST /admin/anime/sync/cast/batch`
여러 애니의 캐릭터/성우 정보를 순차 동기화합니다.

Body 예시:

```json
{
  "limit": 10,
  "language": "JAPANESE",
  "perPage": 25,
  "onlyMissing": true,
  "retryFailed": true,
  "delayMs": 2500
}
```

옵션:

- `limit`: 1~100, 기본 10
- `language`: `JAPANESE`, `ENGLISH`, `KOREAN`, 기본 `JAPANESE`
- `perPage`: 1~50, 기본 25
- `onlyMissing`: 기본 `true`; 동기화 기록이 없거나 pending/failed인 애니만 처리
- `retryFailed`: 기본 `true`; failed 상태를 다시 시도
- `delayMs`: 애니별 요청 간 대기 시간, 기본 2500ms

### `POST /admin/anime/sync/cast/chunked`
캐릭터/성우 배치를 여러 청크로 순차 처리합니다.

기존 `cast/batch`는 한 번에 최대 100개까지만 처리합니다. 이 API는 내부적으로 `cast/batch`를 여러 번 호출해 100개 초과 작업을 안전하게 나눠 처리합니다.

Body 예시:

```json
{
  "totalLimit": 500,
  "chunkSize": 100,
  "maxChunks": 5,
  "chunkDelayMs": 10000,
  "language": "JAPANESE",
  "perPage": 25,
  "onlyMissing": true,
  "retryFailed": true,
  "delayMs": 2500
}
```

옵션:

- `totalLimit`: 전체 처리 목표 개수, 1~5000, 생략 가능
- `chunkSize`: 청크당 처리 개수, 1~100, 기본 100
- `maxChunks`: 최대 청크 수, 1~100, 생략 가능
- `chunkDelayMs`: 청크 사이 대기 시간, 기본 10000ms
- `delayMs`: 청크 내부에서 애니별 대기 시간, 기본 2500ms
- `language`, `perPage`, `onlyMissing`, `retryFailed`: `cast/batch`와 동일

Response 예시:

```json
{
  "success": true,
  "message": "Anime cast chunked sync completed",
  "result": {
    "totalLimit": 500,
    "chunkSize": 100,
    "maxChunks": 5,
    "processedChunks": 5,
    "selectedAnimeCount": 500,
    "processedAnimeCount": 497,
    "failedAnimeCount": 3,
    "finished": false,
    "nextChunkAvailable": false
  }
}
```

### `GET /admin/anime/:animeId/sync/cast`
특정 애니의 캐릭터/성우 동기화 상태를 조회합니다.

Response 예시:

```json
{
  "success": true,
  "item": {
    "animeId": 123,
    "lastSyncedAt": "2026-06-28 10:10:00",
    "sourceUpdatedAt": "2026-06-28 10:00:00",
    "status": "success",
    "errorMessage": null
  }
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
