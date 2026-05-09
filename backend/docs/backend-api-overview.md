# Backend API Overview

현재 `server.ts` 기준으로 연결된 백엔드 API 전체 요약입니다.

- Base URL: `http://<host>:<port>/api`
- Health check: `GET /health`
- 인증 헤더: `Authorization: Bearer <accessToken>`
- 성공 응답 기본 형식: `{ "success": true, ... }`
- 실패 응답 기본 형식: `{ "success": false, "message": "..." }`

## Common Rules

### Auth Required
아래 API는 로그인 필요입니다.

- `/auth/me`
- `/auth/logout-all`
- `/me/profile`
- `/me/agreements`
- `/me/anime-list`
- `/me/anime-stats`
- `/me/anime-stats/recalculate`
- `/me/recommendations`
- `/friends`
- `/friends/requests`

### Cursor Pagination
무한 스크롤 API는 `limit`, `cursor`를 사용합니다.

응답 예시:

```json
{
  "success": true,
  "items": [],
  "pageInfo": {
    "hasNext": true,
    "nextCursor": "eyJ...",
    "limit": 20
  }
}
```

### Title Language
제목 관련 API는 아래 값을 사용합니다.

- `ko`
- `en`
- `ja`

## Health

### `GET /health`
서버 상태 확인용입니다.

Response example:

```json
{
  "ok": true
}
```

## Anime

### `GET /anime`
애니 목록 조회입니다.

Query:

- `sort`: `latest | score | season`
- `titleLanguage`: `ko | en | ja`
- `genre`: 선택값
- `limit`: `1~50`
- `cursor`: 이전 응답의 `pageInfo.nextCursor`

Response example:

```json
{
  "success": true,
  "items": [
    {
      "id": 123,
      "anilistId": 456,
      "title": "진격의 거인",
      "titles": {
        "korean": "진격의 거인",
        "english": "Attack on Titan",
        "native": "進撃の巨人",
        "romaji": "Shingeki no Kyojin",
        "userPreferred": "Attack on Titan"
      },
      "episodes": 25,
      "duration": 24,
      "season": "SPRING",
      "seasonYear": 2013,
      "format": "TV",
      "status": "FINISHED",
      "averageScore": 84,
      "coverImageLarge": "https://...",
      "isAdult": false,
      "createdAt": "2026-05-06 10:00:00"
    }
  ],
  "pageInfo": {
    "hasNext": true,
    "nextCursor": "eyJ...",
    "limit": 20,
    "sort": "latest",
    "titleLanguage": "ko"
  }
}
```

### `GET /anime/search`
애니 제목 검색입니다.

Query:

- `query`: 필수
- `sort`: `latest | score | season`
- `titleLanguage`: `ko | en | ja`
- `genre`: 선택값
- `limit`: `1~50`
- `cursor`: 이전 응답의 `pageInfo.nextCursor`

Response example:

```json
{
  "success": true,
  "items": [
    {
      "id": 123,
      "anilistId": 456,
      "title": "장송의 프리렌",
      "coverImageLarge": "https://...",
      "seasonYear": 2023,
      "averageScore": 91,
      "isAdult": false
    }
  ],
  "pageInfo": {
    "hasNext": false,
    "nextCursor": null,
    "limit": 20,
    "sort": "score",
    "titleLanguage": "ko"
  }
}
```

### `GET /anime/:id`
애니 상세 조회입니다.

Query:

- `titleLanguage`: `ko | en | ja`

Response example:

```json
{
  "success": true,
  "item": {
    "id": 123,
    "anilistId": 456,
    "title": "진격의 거인",
    "titles": {
      "korean": [
        {
          "title": "진격의 거인",
          "subtitle": null,
          "fullTitle": "진격의 거인",
          "isPrimary": true
        }
      ],
      "english": "Attack on Titan",
      "native": "進撃の巨人",
      "romaji": "Shingeki no Kyojin",
      "userPreferred": "Attack on Titan"
    },
    "description": "...",
    "genres": ["Action", "Drama"],
    "tags": [
      {
        "name": "Military",
        "rank": 90,
        "isSpoiler": false
      }
    ],
    "synonyms": ["AOT"]
  }
}
```

## Auth

### `GET /auth/check-username`
닉네임 중복 확인입니다.

Example request:

```http
GET /api/auth/check-username?username=test_user
```

Response example:

```json
{
  "success": true,
  "username": "test_user",
  "available": true
}
```

### `POST /auth/signup`
회원가입 후 이메일 인증 대기 상태를 만듭니다.

Body:

```json
{
  "email": "user@example.com",
  "username": "test_user",
  "password": "password123",
  "deviceType": "web",
  "deviceName": "Chrome"
}
```

Response example:

```json
{
  "success": true,
  "message": "Sign up successful. Email verification required.",
  "requiresEmailVerification": true,
  "user": {
    "id": 1,
    "email": "user@example.com",
    "username": "test_user",
    "role": "USER",
    "isAdmin": false,
    "emailVerified": false,
    "emailVerifiedAt": null,
    "profileImageUrl": null,
    "bio": null,
    "createdAt": "2026-05-06 12:00:00",
    "updatedAt": "2026-05-06 12:00:00"
  }
}
```

### `POST /auth/verify-email/resend`
이메일 인증 메일 재전송입니다.

Body:

```json
{
  "email": "user@example.com"
}
```

Response example:

```json
{
  "success": true,
  "message": "Verification email sent successfully",
  "email": "user@example.com",
  "requiresEmailVerification": true
}
```

### `POST /auth/verify-email/confirm`
이메일 인증 완료입니다.

Body:

```json
{
  "token": "EMAIL_TOKEN"
}
```

Response example:

```json
{
  "success": true,
  "message": "Email verified successfully",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "username": "test_user",
    "role": "USER",
    "isAdmin": false,
    "emailVerified": true,
    "emailVerifiedAt": "2026-05-06 12:10:00",
    "profileImageUrl": null,
    "bio": null,
    "createdAt": "2026-05-06 12:00:00",
    "updatedAt": "2026-05-06 12:10:00"
  }
}
```

### `POST /auth/login`
로그인입니다.

Body:

```json
{
  "email": "user@example.com",
  "password": "password123",
  "deviceType": "android",
  "deviceName": "Galaxy S24"
}
```

Response example:

```json
{
  "success": true,
  "message": "Login successful",
  "accessToken": "...",
  "refreshToken": "...",
  "accessTokenExpiresIn": 900,
  "tokenType": "Bearer",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "username": "test_user",
    "role": "USER",
    "isAdmin": false,
    "emailVerified": true,
    "emailVerifiedAt": "2026-05-06 12:10:00"
  }
}
```

### `POST /auth/refresh`
access token 재발급입니다.

Body:

```json
{
  "refreshToken": "..."
}
```

Response example:

```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "accessToken": "...",
  "refreshToken": "...",
  "accessTokenExpiresIn": 900,
  "tokenType": "Bearer",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "username": "test_user",
    "role": "USER",
    "isAdmin": false,
    "emailVerified": true,
    "emailVerifiedAt": "2026-05-06 12:10:00"
  }
}
```

### `POST /auth/password-reset/request`
비밀번호 재설정 메일 발송 요청입니다.

Body:

```json
{
  "email": "user@example.com"
}
```

Response example:

```json
{
  "success": true,
  "message": "Password reset email sent successfully",
  "email": "user@example.com",
  "sent": true
}
```

### `POST /auth/password-reset/confirm`
메일 토큰으로 비밀번호 재설정 완료입니다.

Body:

```json
{
  "token": "RESET_TOKEN",
  "newPassword": "newpassword123"
}
```

Response example:

```json
{
  "success": true,
  "message": "Password reset successful",
  "email": "user@example.com",
  "reset": true
}
```

### `POST /auth/logout`
현재 refresh token 로그아웃입니다.

Body:

```json
{
  "refreshToken": "..."
}
```

Response example:

```json
{
  "success": true,
  "message": "Logout successful"
}
```

### `GET /auth/me`
현재 로그인 유저 정보 조회입니다.

Response example:

```json
{
  "success": true,
  "user": {
    "id": 1,
    "email": "user@example.com",
    "username": "test_user",
    "role": "ADMIN",
    "isAdmin": true,
    "emailVerified": true,
    "emailVerifiedAt": "2026-05-06 12:10:00",
    "profileImageUrl": null,
    "bio": null,
    "createdAt": "2026-05-06 12:00:00",
    "updatedAt": "2026-05-06 12:10:00"
  }
}
```

### `POST /auth/logout-all`
모든 기기 로그아웃입니다.

Response example:

```json
{
  "success": true,
  "message": "Logged out from all devices"
}
```

## Agreements

### `GET /me/agreements`
현재 약관 동의 상태 조회입니다.

Response example:

```json
{
  "success": true,
  "item": {
    "termsAgreed": true,
    "privacyAgreed": true,
    "agreedAt": "2026-05-06 12:00:00",
    "termsVersion": "v1.0",
    "privacyVersion": "v1.0"
  }
}
```

### `PATCH /me/agreements`
약관 동의/해제 수정입니다.

Body:

```json
{
  "termsAgreed": true,
  "termsVersion": "v1.0",
  "privacyAgreed": true,
  "privacyVersion": "v1.0"
}
```

Response example:

```json
{
  "success": true,
  "message": "User agreements updated successfully",
  "item": {
    "termsAgreed": true,
    "privacyAgreed": true,
    "agreedAt": "2026-05-06 12:00:00",
    "termsVersion": "v1.0",
    "privacyVersion": "v1.0"
  }
}
```

## My Anime List

### `POST /me/anime-list`
내 리스트에 애니 추가입니다.

Body:

```json
{
  "animeId": 123,
  "status": "watching",
  "score": 8.5,
  "progress": 3,
  "startedAt": "2026-04-17",
  "completedAt": null,
  "notes": "재밌음"
}
```

Response example:

```json
{
  "success": true,
  "message": "Anime added to user list",
  "item": {
    "id": 1,
    "userId": 1,
    "animeId": 123,
    "status": "watching",
    "score": 8.5,
    "progress": 3,
    "startedAt": "2026-04-17",
    "completedAt": null,
    "notes": "재밌음",
    "createdAt": "2026-05-06 12:20:00",
    "updatedAt": "2026-05-06 12:20:00"
  }
}
```

### `GET /me/anime-list`
내 리스트 조회입니다.

Query:

- `sort`: `latest | added | score`
- `titleLanguage`: `ko | en | ja`
- `genre`: 선택값
- `limit`: `1~50`
- `cursor`: 이전 응답의 `pageInfo.nextCursor`

Response example:

```json
{
  "success": true,
  "items": [
    {
      "id": 1,
      "userId": 1,
      "animeId": 123,
      "status": "watching",
      "score": 8.5,
      "progress": 3,
      "createdAt": "2026-05-06 12:20:00",
      "updatedAt": "2026-05-06 12:20:00",
      "anime": {
        "id": 123,
        "title": "진격의 거인",
        "coverImageLarge": "https://...",
        "averageScore": 84,
        "isAdult": false
      }
    }
  ],
  "pageInfo": {
    "hasNext": true,
    "nextCursor": "eyJ...",
    "limit": 20,
    "sort": "latest",
    "titleLanguage": "ko"
  }
}
```

### `GET /me/anime-list/:animeId`
내 리스트에 특정 애니가 등록되어 있는지 조회합니다.

Query:

- `titleLanguage`: `ko | en | ja`

내 리스트에 등록되어 있으면 `item`에 기록이 들어옵니다.

```json
{
  "success": true,
  "item": {
    "id": 1,
    "userId": 1,
    "animeId": 123,
    "status": "watching",
    "score": 8.5,
    "progress": 3,
    "startedAt": "2026-04-17",
    "completedAt": null,
    "notes": "재밌음",
    "anime": {
      "id": 123,
      "title": "진격의 거인",
      "coverImageLarge": "https://..."
    }
  }
}
```

내 리스트에 아직 등록되어 있지 않으면 404가 아니라 아래처럼 응답합니다.

```json
{
  "success": true,
  "item": null
}
```

### `PATCH /me/anime-list/:animeId`
내 리스트 항목 수정입니다.

Body:

```json
{
  "progress": 10,
  "score": 9,
  "status": "completed",
  "completedAt": "2026-04-20"
}
```

Response example:

```json
{
  "success": true,
  "message": "User anime list updated",
  "item": {
    "id": 1,
    "userId": 1,
    "animeId": 123,
    "status": "completed",
    "score": 9,
    "progress": 10,
    "completedAt": "2026-04-20",
    "updatedAt": "2026-05-06 12:30:00"
  }
}
```

### `DELETE /me/anime-list/:animeId`
내 리스트에서 삭제입니다.

Response example:

```json
{
  "success": true,
  "message": "Anime removed from user list"
}
```

## Profile

### `GET /users/:userId/profile`
다른 유저 공개 프로필 조회입니다.

Response example:

```json
{
  "success": true,
  "user": {
    "id": 12,
    "username": "mika",
    "profileImageUrl": "https://...",
    "bio": "anime lover",
    "animeListCount": 84,
    "createdAt": "2026-05-01 10:00:00",
    "updatedAt": "2026-05-05 12:00:00"
  }
}
```

### `PATCH /me/profile`
내 프로필 수정입니다.

Content-Type:

```http
multipart/form-data
```

Response example:

```json
{
  "success": true,
  "message": "Profile updated successfully",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "username": "new_name",
    "profileImageUrl": "https://...",
    "bio": null,
    "createdAt": "2026-05-01 10:00:00",
    "updatedAt": "2026-05-06 12:40:00"
  }
}
```

## User Public List / Stats

### `GET /users/:userId/anime-list`
다른 유저 애니 리스트 조회입니다.

Response example:

```json
{
  "success": true,
  "user": {
    "id": 12,
    "username": "mika",
    "profileImageUrl": "https://...",
    "bio": "anime lover",
    "animeListCount": 84
  },
  "items": [
    {
      "id": 11,
      "animeId": 123,
      "status": "completed",
      "score": 9,
      "anime": {
        "id": 123,
        "title": "장송의 프리렌",
        "coverImageLarge": "https://..."
      }
    }
  ],
  "pageInfo": {
    "hasNext": false,
    "nextCursor": null,
    "limit": 20,
    "sort": "score",
    "titleLanguage": "ko"
  }
}
```

### `GET /users/:userId/anime-stats`
다른 유저 애니 통계 조회입니다.

Response example:

```json
{
  "success": true,
  "user": {
    "id": 12,
    "username": "mika",
    "profileImageUrl": "https://...",
    "bio": "anime lover",
    "animeListCount": 84
  },
  "item": {
    "userId": 12,
    "totalCount": 42,
    "completedCount": 20,
    "watchingCount": 8,
    "avgScore": 8.4,
    "favoriteGenre": "Drama",
    "favoriteReleasePeriod": "2020s",
    "preferenceSummary": "This user has 42 anime records and prefers Drama."
  }
}
```

## Recommendation / Stats

### `GET /me/anime-stats`
내 애니 통계 조회입니다.

Response example:

```json
{
  "success": true,
  "item": {
    "userId": 1,
    "totalCount": 42,
    "completedCount": 20,
    "watchingCount": 8,
    "droppedCount": 3,
    "totalWatchedEpisodes": 560,
    "totalWatchMinutes": 13440,
    "avgScore": 8.4,
    "favoriteGenre": "Drama",
    "favoriteReleasePeriod": "2020s",
    "genreDistribution": {
      "Drama": 12,
      "Action": 9
    },
    "topWatchedGenreTopAnime": [
      {
        "animeId": 101,
        "title": "장송의 프리렌",
        "coverImageLarge": "https://...",
        "score": 9.5,
        "genre": "Drama"
      }
    ],
    "topRatedGenreTopAnime": [
      {
        "animeId": 205,
        "title": "바이올렛 에버가든",
        "coverImageLarge": "https://...",
        "score": 10,
        "genre": "Drama"
      }
    ],
    "updatedAt": "2026-05-06 13:00:00"
  }
}
```

### `POST /me/anime-stats/recalculate`
내 애니 통계 강제 재계산입니다.

Response example:

```json
{
  "success": true,
  "message": "User anime stats recalculated",
  "item": {
    "userId": 1,
    "totalCount": 42,
    "avgScore": 8.4,
    "favoriteGenre": "Drama",
    "updatedAt": "2026-05-06 13:01:00"
  }
}
```

### `GET /me/recommendations`
추천 애니 조회입니다.

Query:

- `titleLanguage`: `ko | en | ja`
- `limit`: `1~50`

Response example:

```json
{
  "success": true,
  "stats": {
    "favoriteGenre": "Drama",
    "favoriteReleasePeriod": "2020s",
    "avgScore": 8.4,
    "preferenceSummary": "This user has 42 anime records and prefers Drama."
  },
  "items": [
    {
      "id": 123,
      "anilistId": 456,
      "title": "장송의 프리렌",
      "coverImageLarge": "https://...",
      "genres": ["Adventure", "Drama", "Fantasy"],
      "recommendationScore": 42.7
    }
  ]
}
```

## Friends

### `POST /friends/requests`
친구 요청 보내기입니다.

Body:

```json
{
  "username": "mika"
}
```

Response example:

```json
{
  "success": true,
  "message": "Friend request sent",
  "item": {
    "id": 5,
    "status": "pending",
    "receiver": {
      "id": 12,
      "username": "mika",
      "profileImageUrl": "https://...",
      "bio": "anime lover",
      "animeListCount": 84
    }
  }
}
```

### `GET /friends/requests`
친구 요청 목록 조회입니다.

Response example:

```json
{
  "success": true,
  "incoming": [
    {
      "id": 7,
      "requesterId": 15,
      "receiverId": 3,
      "status": "pending",
      "createdAt": "2026-05-05 14:20:00",
      "respondedAt": null,
      "user": {
        "id": 15,
        "username": "rin",
        "profileImageUrl": "https://...",
        "bio": "drama fan",
        "animeListCount": 52
      }
    }
  ],
  "outgoing": []
}
```

### `PATCH /friends/requests/:requestId`
친구 요청 처리입니다.

Body:

```json
{
  "action": "accept"
}
```

Response example:

```json
{
  "success": true,
  "message": "Friend request accepted successfully",
  "item": {
    "id": 7,
    "requesterId": 15,
    "receiverId": 3,
    "status": "accepted",
    "user": {
      "id": 15,
      "username": "rin",
      "profileImageUrl": "https://...",
      "bio": "drama fan",
      "animeListCount": 52
    }
  }
}
```

### `GET /friends`
친구 목록 조회입니다.

Response example:

```json
{
  "success": true,
  "items": [
    {
      "id": 11,
      "createdAt": "2026-05-05 16:10:00",
      "user": {
        "id": 15,
        "username": "rin",
        "profileImageUrl": "https://...",
        "bio": "drama fan",
        "animeListCount": 52
      }
    }
  ]
}
```

### `DELETE /friends/:friendUserId`
친구 삭제입니다.

Response example:

```json
{
  "success": true,
  "message": "Friend removed successfully"
}
```

## Platform Stats

### `GET /stats/platform`
공개 플랫폼 통계 조회입니다.

Response example:

```json
{
  "success": true,
  "item": {
    "registeredUserCount": 120,
    "storedAnimeCount": 8450,
    "translatedKoreanTitleCount": 5300
  }
}
```

### `GET /stats/platform/popular-anime`
인기 애니 목록 조회입니다. 인증 없이 호출할 수 있습니다.

Query:

- `limit`: `1~50`, 기본값 `10`

Example request:

```http
GET /api/stats/platform/popular-anime?limit=6
```

Response example:

```json
{
  "success": true,
  "limit": 6,
  "items": [
    {
      "id": 123,
      "anilistId": 456,
      "title": "장송의 프리렌",
      "titles": {
        "korean": "장송의 프리렌",
        "english": "Frieren: Beyond Journey's End",
        "native": "葬送のフリーレン",
        "romaji": "Sousou no Frieren",
        "userPreferred": "Frieren: Beyond Journey's End"
      },
      "coverImageLarge": "https://...",
      "popularity": 250000
    }
  ]
}
```

## Admin

관리자 전용이며 `ADMIN` access token이 필요합니다.

### `POST /admin/anime/sync/page`
한 페이지 동기화입니다.

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
여러 페이지 연속 동기화입니다.

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
청크 단위 동기화입니다.

Response example:

```json
{
  "success": true,
  "message": "Anime chunked sync completed",
  "result": {
    "processedChunks": 3,
    "processedPages": 30,
    "totalAnime": 1500,
    "nextPage": 31,
    "finished": false
  }
}
```

### `POST /admin/anime/sync/season`
특정 시즌 동기화입니다.

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

### `POST /admin/anime/korean-titles/translate`
한국어 제목 번역 배치 실행입니다.

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
    "remaining": true
  }
}
```

## Error Guide

자주 쓰이는 상태 코드:

- `400`: 잘못된 파라미터, 잘못된 cursor, 잘못된 action
- `401`: 인증 실패 또는 토큰 만료
- `403`: 이메일 인증 필요, 관리자 권한 없음
- `404`: 대상 없음
- `409`: 중복 요청, 이미 존재하는 상태
- `500`: 서버 내부 오류
