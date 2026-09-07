# Admin API Summary

관리자 전용 API 요약입니다.

- Base URL: `http://<host>:<port>`
- 인증: `Authorization: Bearer <admin accessToken>`
- 권한: `users.role = 'ADMIN'`
- 성공 응답 기본 형식: `{ "success": true, ... }`
- 실패 응답 기본 형식: `{ "success": false, "message": "..." }`

## Catalog Image Sync

애니 커버·배너, 캐릭터·성우, 프로필과 배지 이미지를 `myanitrack-assets-prod` S3로 이전하고 `https://images.myanitrack.com` CloudFront URL로 제공합니다. 기존 Supabase Storage 이미지는 그 공개 객체를 원본으로 다시 복사하며, 작업 상태는 DB에 저장되어 브라우저 종료와 서버 재시작 후에도 이어집니다.

- `POST /admin/catalog-images/sync/jobs`: `{ "scope": "all", "mode": "pending" | "refresh" }`로 작업 생성
- `GET /admin/catalog-images/sync/jobs/current`: 현재 또는 최근 작업, 전체 큐 집계와 최근 실패 조회
- `POST /admin/catalog-images/sync/jobs/:jobId/pause`: 진행 중인 작업 일시정지
- `POST /admin/catalog-images/sync/jobs/:jobId/resume`: 일시정지 작업 재개
- `POST /admin/catalog-images/sync/jobs/:jobId/retry-failed`: 해당 작업의 실패 항목으로 재시도 작업 생성

작업 시작·재개 전에는 고유한 점검 객체로 S3 Put/Head, CloudFront GET, S3 Delete를 모두 확인합니다. 이전이 끝나기 전 기존 Supabase URL은 그대로 제공하고, S3 객체의 MIME·크기·SHA-256 검증이 끝난 항목만 CloudFront URL로 전환합니다. AniList URL은 사용자 API에서 제거되어 직접 노출되지 않습니다.

필수 이미지 저장소 환경변수는 `IMAGE_STORAGE_PROVIDER=s3`, `AWS_REGION`, `AWS_S3_BUCKET`, `IMAGE_CDN_BASE_URL`입니다. AWS SDK 표준 자격 증명 체인을 사용하며, 기존 객체 복사·14일 후 삭제를 위해 기존 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` 설정도 전환 기간 동안 유지합니다.

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

`relationSyncProgressRate`는 관계가 실제로 존재하는 작품 수가 아니라, 관계가 0개인 작품을 포함해 AniList 관계 조회가 정상 완료된 작품 수를 전체 저장 작품 수로 나눈 비율입니다.

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
    "relationSyncedAnimeCount": 2000,
    "relationPendingAnimeCount": 6400,
    "relationSyncingAnimeCount": 0,
    "relationFailedAnimeCount": 50,
    "animeRelationCount": 7200,
    "relationSyncProgressRate": 23.67,
    "characterCount": 18340,
    "voiceActorCount": 4120
  }
}
```

## Anime Sync

### `POST /admin/anime/sync/full`

AniList의 전체 애니를 순서대로 조회하여 애니 기본 정보, 스튜디오, 캐릭터, 성우, 연관 작품을 통합 동기화합니다.

해당 스키마는 `sql_scripts/017_anime_relations.sql`에 정의되어 있으며, 백엔드 배포 시작 시 자동 마이그레이션으로 적용됩니다.

Body 예시:

```json
{
  "startPage": 1,
  "perPage": 50,
  "maxPages": 1,
  "language": "JAPANESE",
  "castPerPage": 25,
  "animeDelayMs": 2500
}
```

옵션:

- `startPage`: 시작 AniList 페이지, 기본 `1`
- `perPage`: 페이지당 애니 수, 기본 `50`, 최대 `50`
- `maxPages`: 이번 요청에서 처리할 최대 페이지 수. 생략하면 AniList 마지막 페이지까지 처리
- `language`: 성우 언어 `JAPANESE`, `ENGLISH`, `KOREAN`, 기본 `JAPANESE`
- `castPerPage`: 캐릭터 조회 페이지 크기, 기본 `25`, 최대 `50`
- `animeDelayMs`: 작품 사이 AniList 요청 대기 시간, 기본 `2500`, 최대 `60000`

동기화 항목:

- 애니 기본 정보, 제목, 장르, 태그 및 이미지
- 스튜디오와 애니-스튜디오 연결
- 캐릭터와 애니-캐릭터 연결
- 성우와 캐릭터-성우 연결
- 애니 간 PREQUEL, SEQUEL, SIDE_STORY 등의 방향성 관계
- 스튜디오 및 cast 동기화 상태
- 연관 작품 동기화 상태

한 작품의 애니 또는 cast 동기화가 실패해도 다음 작품을 계속 처리하며 `failures`에 실패 단계와 메시지를 반환합니다.

전체 데이터는 장시간이 걸리므로 운영 환경에서는 `maxPages: 1`로 실행한 후 응답의 `nextPage`를 다음 요청의 `startPage`로 사용하는 것을 권장합니다. `maxPages`를 생략하면 한 요청에서 전체 페이지를 처리합니다.

Response 주요 필드:

```json
{
  "success": true,
  "message": "Full anime, studio, character, and voice actor sync completed",
  "result": {
    "startPage": 1,
    "perPage": 50,
    "maxPages": 1,
    "processedPages": 1,
    "selectedAnimeCount": 50,
    "animeSyncedCount": 50,
    "castSyncedCount": 49,
    "failedAnimeCount": 1,
    "nextPage": 2,
    "finished": false,
    "language": "JAPANESE",
    "castPerPage": 25,
    "animeDelayMs": 2500,
    "failures": [
      {
        "anilistId": 12345,
        "animeId": 321,
        "stage": "cast",
        "message": "AniList request failed"
      }
    ]
  }
}
```

### `POST /admin/anime/sync/relations`

로컬에 저장된 애니의 연관 작품만 AniList에서 다시 가져옵니다. 요청의 `mode`로 미동기화 작품부터 처리할지, 전체 작품을 처음부터 처리할지 선택할 수 있습니다.

Body 예시 — 미동기화 작품부터 처리:

```json
{
  "mode": "missing",
  "limit": 500,
  "batchSize": 50,
  "retryFailed": true,
  "afterAnimeId": 0,
  "delayMs": 2500
}
```

Body 예시 — 전체 작품을 처음부터 재동기화:

```json
{
  "mode": "all",
  "limit": 500,
  "batchSize": 50,
  "afterAnimeId": 0,
  "delayMs": 2500
}
```

옵션:

- `mode`: `missing | all`, 기본값 `missing`
  - `missing`: 동기화 상태가 없거나 `pending`인 작품을 처리하며, `retryFailed: true`이면 `failed`도 포함
  - `all`: 상태와 관계없이 모든 로컬 애니를 내부 `anime.id` 순서로 처리
- `limit`: 한 요청에서 처리할 최대 작품 수, 기본값 `500`, 최대 `5000`
- `batchSize`: AniList 한 요청에 묶을 작품 수, 기본값 `50`, 최대 `50`
- `retryFailed`: 실패 작품 포함 여부, 기본값 `true`; `missing` 모드에만 적용
- `afterAnimeId`: 이 내부 `anime.id`보다 큰 작품부터 처리, 기본값 `0`
- `delayMs`: AniList 묶음 요청 사이 대기 시간, 기본값 `2500`, 최대 `60000`

Response 예시:

```json
{
  "success": true,
  "message": "Anime relations sync completed",
  "result": {
    "mode": "missing",
    "retryFailed": true,
    "afterAnimeId": 0,
    "nextAfterAnimeId": 820,
    "limit": 500,
    "batchSize": 50,
    "delayMs": 2500,
    "selectedAnimeCount": 500,
    "processedAnimeCount": 500,
    "syncedAnimeCount": 497,
    "failedAnimeCount": 3,
    "hasMore": true,
    "failures": []
  }
}
```

`hasMore`가 `true`이면 다음 요청의 `afterAnimeId`에 `nextAfterAnimeId`를 전달합니다. 전체 구간 처리 후 실패 건을 다시 시도하려면 `mode: missing`, `afterAnimeId: 0`, `retryFailed: true`로 호출합니다.

### `POST /admin/anime/series/rebuild`

동기화된 `anime_relations`를 기준으로 시리즈 그룹과 멤버를 다시 계산합니다. 관리자 권한이 필요합니다.

Body:

```json
{
  "scope": "all"
}
```

- `scope`: `mainline | franchise | all`, 기본값 `all`
  - `mainline`: `PREQUEL`, `SEQUEL` 관계만 재계산
  - `franchise`: 외전, 스핀오프, 총집편 등을 포함해 재계산
  - `all`: `mainline`과 `franchise`를 순서대로 모두 재계산

Response example:

```json
{
  "success": true,
  "message": "Anime series rebuild completed",
  "result": {
    "scope": "all",
    "rebuiltScopes": ["mainline", "franchise"],
    "durationMs": 842,
    "summaries": [
      {
        "scope": "mainline",
        "seriesCount": 410,
        "memberCount": 1030,
        "updatedAt": "2026-07-16 12:30:00"
      },
      {
        "scope": "franchise",
        "seriesCount": 350,
        "memberCount": 1410,
        "updatedAt": "2026-07-16 12:30:01"
      }
    ]
  }
}
```

동시에 다른 시리즈 재계산이 실행 중이면 HTTP `409`와 `Anime series rebuild is already running`을 반환합니다. relation 동기화를 여러 청크로 실행할 때는 마지막 청크가 끝난 후 한 번 호출하는 것을 권장합니다.

재계산 시 각 멤버의 완주 필수 여부도 함께 갱신됩니다. `MUSIC`, `SUMMARY`/`COMPILATION` 관계의 대상 작품, `NOT_YET_RELEASED`, `CANCELLED` 작품은 시리즈 구성에는 남아 있지만 사용자 시리즈 완주 계산에서는 제외됩니다. 관련 컬럼과 프로시저는 `sql_scripts/018_anime_series.sql`에 정의되어 있으며, 백엔드 배포 시작 시 자동 마이그레이션으로 적용됩니다.

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
여러 페이지의 애니 기본 정보와 스튜디오를 연속 동기화합니다. 캐릭터·성우까지 함께 동기화하려면 `/admin/anime/sync/full`을 사용합니다.

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
특정 시즌 애니의 기본 정보, 스튜디오, 캐릭터, 성우, 연관 작품을 통합 동기화합니다. `syncCast`의 기본값은 `true`이며, 연관 작품은 `syncCast` 값과 관계없이 항상 동기화됩니다.

Body 예시:

```json
{
  "season": "SPRING",
  "seasonYear": 2026,
  "startPage": 1,
  "perPage": 50,
  "maxPages": 1,
  "syncCast": true,
  "language": "JAPANESE",
  "castPerPage": 25,
  "animeDelayMs": 2500
}
```

`syncCast: false`로 호출하면 캐릭터·성우를 제외하고 기존처럼 애니와 스튜디오만 동기화합니다. 응답에는 `animeSyncedCount`, `castSyncedCount`, `failedAnimeCount`, `failures`, `nextPage`가 포함됩니다.

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

이미지 URL은 `{IMAGE_CDN_BASE_URL}/badges/...` 형태로 저장됩니다. 기존 URL은 S3 객체 검증이 끝날 때까지 유지됩니다.

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
