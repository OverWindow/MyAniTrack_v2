# Backend API Overview

현재 `server.ts` 기준으로 연결된 백엔드 API 전체 요약입니다.

관리자 전용 API만 따로 볼 때는 `docs/admin-api-summary.md`를 참고하세요.

- Base URL: `http://<host>:<port>/api`
- Health check: `GET /health`
- 인증 헤더: `Authorization: Bearer <accessToken>`
- refresh token: `HttpOnly` cookie `refreshToken`
- refresh/logout 호출 시 프론트는 `credentials: "include"` 필요
- 성공 응답 기본 형식: `{ "success": true, ... }`
- 실패 응답 기본 형식: `{ "success": false, "message": "..." }`

인증 쿠키/CORS 설정:

- 개발 기본 허용 origin: `http://localhost:5173`
- 운영 허용 origin: `FRONT_DOMAIN1`, `FRONT_DOMAIN2`, `FRONT_DOMAIN3`
- 운영에서 프론트/백엔드가 cross-site이면 `AUTH_REFRESH_COOKIE_SAME_SITE=none` 설정 필요
- `SameSite=None` 또는 `NODE_ENV=production`에서는 refresh cookie에 `Secure`가 적용됨

## Common Rules

### Auth Required
아래 API는 로그인 필요입니다.

- `/auth/me`
- `/auth/logout-all`
- `/me/profile`
- `/me/agreements`
- `/me/anime-list`
- `/me/anime-list/smart-rating/candidates`
- `/me/anime-list/smart-rating/estimate`
- `/me/anime/search`
- `/me/anime-stats`
- `/me/anime-stats/recalculate`
- `/me/badges`
- `/me/badges/recalculate`
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

## Guest Sample

로그인하지 않은 사용자에게 컬렉션/분석 화면을 미리 보여주기 위한 공개 샘플 API입니다.

특징:

- 인증이 필요 없습니다.
- DB를 조회하지 않는 정적 샘플 데이터입니다.
- 실제 `/me/anime-list`, `/me/anime-stats` 계열과 비슷한 응답 구조를 사용합니다.
- 로그인 전 홈, 랜딩, 온보딩, 데모 카드에서 사용하면 됩니다.

### `GET /sample/overview`
로그인 전 화면에 필요한 샘플 컬렉션과 분석 데이터를 한 번에 가져옵니다.

Response shape:

```json
{
  "success": true,
  "item": {
    "user": {
      "id": 0,
      "username": "sample_viewer",
      "profileImageUrl": null,
      "bio": "Guest sample profile for previewing MyAniTrack collection and analytics.",
      "createdAt": "2026-07-07T00:00:00.000Z"
    },
    "collection": {
      "user": {},
      "items": [
        {
          "id": 1,
          "userId": 0,
          "animeId": 101,
          "status": "completed",
          "score": 9.4,
          "progress": 25,
          "anime": {
            "id": 101,
            "anilistId": 16498,
            "title": "진격의 거인",
            "format": "TV",
            "seasonYear": 2013,
            "averageScore": 84,
            "coverImageLarge": null
          }
        }
      ],
      "pageInfo": {
        "hasNext": false,
        "nextCursor": null,
        "limit": 6,
        "sort": "latest",
        "titleLanguage": "ko",
        "genre": null,
        "year": null,
        "score": null
      }
    },
    "stats": {},
    "genreBubble": {},
    "yearlyScores": {},
    "formatDistribution": {},
    "studios": {}
  }
}
```

주의: 위 예시는 길이를 줄인 축약 예시입니다. 실제 `/api/sample/overview`의 `item.collection.items`에는 샘플 애니가 여러 개 들어갑니다.

Frontend usage:

```ts
const response = await fetch(`${apiBaseUrl}/api/sample/overview`);
const data = await response.json();
```

### `GET /sample/anime-list`
샘플 컬렉션 목록만 조회합니다. 기존 `/me/anime-list`와 비슷하게 `items`, `pageInfo`를 반환합니다.

Query:

- `sort`: `latest | added | score | scoreAsc`, 기본값 `latest`
- `titleLanguage`: `ko | en | ja`, 기본값 `ko`
- `genre`: 선택값
- `year`: 선택값
- `score`: 선택값, `1~10`
- `limit`: `1~50`, 기본값 `20`

Example:

```http
GET /api/sample/anime-list?sort=score&titleLanguage=ko&limit=6
```

Response example:

```json
{
  "success": true,
  "user": {
    "id": 0,
    "username": "sample_viewer",
    "profileImageUrl": null
  },
  "items": [
    {
      "id": 1,
      "userId": 0,
      "animeId": 101,
      "status": "completed",
      "score": 9.4,
      "progress": 25,
      "startedAt": "2024-01-05",
      "completedAt": "2024-01-28",
      "notes": "Dense political drama with a memorable final arc.",
      "anime": {
        "id": 101,
        "anilistId": 16498,
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
        "meanScore": 84,
        "popularity": 860000,
        "coverImageLarge": null,
        "isAdult": false
      }
    }
  ],
  "pageInfo": {
    "hasNext": false,
    "nextCursor": null,
    "limit": 6,
    "sort": "score",
    "titleLanguage": "ko",
    "genre": null,
    "year": null,
    "score": null
  }
}
```

### `GET /sample/anime-stats`
샘플 사용자의 전체 애니 통계를 반환합니다. `/me/anime-stats`의 `item` 구조와 비슷합니다.

```http
GET /api/sample/anime-stats
```

Response includes:

- `totalCount`
- `completedCount`
- `watchingCount`
- `totalWatchedEpisodes`
- `totalWatchMinutes`
- `avgScore`
- `favoriteGenre`
- `genreDistribution`
- `genreWatchMinutes`
- `genreAvgScore`
- `releaseYearDistribution`
- `scoreDistribution`
- `topWatchedGenreTopAnime`
- `topRatedGenreTopAnime`

### `GET /sample/anime-stats/genre-bubble`
샘플 장르 버블 차트 데이터를 반환합니다.

```http
GET /api/sample/anime-stats/genre-bubble
```

Response shape:

```json
{
  "success": true,
  "item": {
    "userId": 0,
    "status": "completed",
    "weighting": "fractional",
    "communityScore": "average",
    "minCount": 1,
    "topLimit": 3,
    "items": [
      {
        "genre": "Drama",
        "animeCount": 4,
        "percentage": 22.22,
        "watchMinutes": 2251,
        "watchHours": 37.52,
        "averageScore": 8.98,
        "communityAverageScore": 8.1,
        "preferenceScore": 35.9,
        "topAnime": []
      }
    ],
    "summary": {
      "genreCount": 8,
      "topGenre": "Drama",
      "totalGenreCount": 18
    }
  }
}
```

### `GET /sample/anime-stats/yearly-scores`
샘플 연도별 평균 평점 분석을 반환합니다.

Query:

- `status`: `all | completed`, 기본값 `completed`
- `minRatedAnimeCount`: `1~100`, 기본값 `3`

Example:

```http
GET /api/sample/anime-stats/yearly-scores?status=completed&minRatedAnimeCount=1
```

### `GET /sample/anime-stats/format-distribution`
샘플 포맷별 분포 데이터를 반환합니다. 원그래프/도넛 차트에서 바로 사용할 수 있습니다.

Query:

- `status`: `all | completed`, 기본값 `completed`
- `minCount`: `1~100`, 기본값 `1`

Example:

```http
GET /api/sample/anime-stats/format-distribution?status=completed&minCount=1
```

Response includes:

- `totalAnimeCount`
- `totalWatchMinutes`
- `totalWatchHours`
- `items[].format`
- `items[].label`
- `items[].animeCount`
- `items[].percentage`
- `items[].averageScore`
- `items[].watchHours`
- `summary.topFormat`

### `GET /sample/anime-stats/studios`
샘플 스튜디오 랭킹 데이터를 반환합니다.

Query:

- `limit`: `1~50`, 기본값 `20`

Example:

```http
GET /api/sample/anime-stats/studios?limit=10
```

Response shape:

```json
{
  "success": true,
  "items": [
    {
      "studioId": 1,
      "name": "WIT Studio",
      "animeCount": 1,
      "completedCount": 1,
      "ratedAnimeCount": 1,
      "averageScore": 9.4,
      "watchedEpisodes": 25,
      "watchMinutes": 600,
      "watchHours": 10,
      "topAnime": []
    }
  ],
  "pageInfo": {
    "hasNext": false,
    "nextCursor": null,
    "limit": 10,
    "sort": "averageScore",
    "status": "all",
    "mainOnly": true,
    "minAnimeCount": 1,
    "minRatedAnimeCount": 1
  }
}
```

Frontend notes:

- 로그인 전에는 `/api/sample/overview` 하나로 홈 프리뷰를 구성하는 것을 추천합니다.
- 로그인 후에는 기존 `/api/me/anime-list`, `/api/me/anime-stats/*`를 사용하면 됩니다.
- 샘플 응답의 `user.id`는 `0`이며 실제 DB 유저가 아닙니다.
- `coverImageLarge`, `bannerImage`는 샘플에서 `null`일 수 있으므로 프론트 fallback 이미지를 준비하세요.

## Anime

### `GET /anime`
애니 목록 조회입니다.

Query:

- `sort`: `latest | score | season | popularity`
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
- `sort`: `latest | score | season | popularity`
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

### `GET /me/anime/search`
내 컬렉션 정보가 포함된 애니 목록/검색입니다. 로그인 필요입니다.

기본 조건과 페이지네이션은 `GET /anime` / `GET /anime/search`와 동일하며, 각 결과에 `myCollection`이 추가됩니다. `query`가 있으면 검색으로 동작하고, 없으면 일반 애니 목록으로 동작합니다.

Query:

- `query`: 선택값
- `sort`: `latest | score | season | popularity`
- `titleLanguage`: `ko | en | ja`
- `genre`: 선택값
- `limit`: `1~50`
- `cursor`: 이전 응답의 `pageInfo.nextCursor`

Example request:

```http
GET /api/me/anime/search?query=프리렌&sort=score&titleLanguage=ko&limit=20
```

검색어 없이 목록으로 호출할 수도 있습니다.

```http
GET /api/me/anime/search?sort=score&titleLanguage=ko&limit=24
```

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
      "isAdult": false,
      "myCollection": {
        "exists": true,
        "status": "completed",
        "score": 9.5,
        "progress": 28
      }
    },
    {
      "id": 124,
      "anilistId": 457,
      "title": "프리렌 스페셜",
      "coverImageLarge": "https://...",
      "seasonYear": 2024,
      "averageScore": 82,
      "isAdult": false,
      "myCollection": {
        "exists": false,
        "status": null,
        "score": null,
        "progress": null
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

### `GET /anime/:id/cast`
특정 애니의 캐릭터와 해당 캐릭터의 성우 정보를 role 기준으로 조회합니다.

이 API는 캐릭터 이미지와 성우 이미지가 모두 있는 데이터만 반환합니다. 캐릭터/성우 데이터는 먼저 관리자 캐스트 동기화 API로 수집되어 있어야 합니다.

Query:

- `role`: `MAIN | SUPPORT | BACKGROUND`, 기본값 `MAIN`
- `limit`: `1~100`, 기본값 `50`
- `voiceLanguage`: 선택값. 예: `Japanese`, `Korean`, `English`. 저장된 `anime_character_voice_actors.language_v2`와 정확히 일치하는 성우만 조회합니다.

참고:

- AniList 원본 role `SUPPORTING`은 프론트 요청에서는 `SUPPORT`로 사용합니다.
- `role=SUPPORTING`을 보내도 서버가 `SUPPORT`로 처리합니다.
- `id`는 AniList id가 아니라 내부 `anime.id`입니다.

Example request:

```http
GET /api/anime/123/cast?role=MAIN&limit=20
```

Response example:

```json
{
  "success": true,
  "animeId": 123,
  "role": "MAIN",
  "storedRole": "MAIN",
  "voiceLanguage": null,
  "requiresImages": true,
  "items": [
    {
      "id": 10,
      "anilistId": 1001,
      "role": "MAIN",
      "requestedRole": "MAIN",
      "edgeName": null,
      "sortOrder": 1,
      "name": {
        "full": "Frieren",
        "native": "フリーレン",
        "userPreferred": "Frieren"
      },
      "image": {
        "large": "https://...",
        "medium": "https://..."
      },
      "gender": "Female",
      "age": null,
      "description": "...",
      "siteUrl": "https://anilist.co/character/...",
      "voiceActors": [
        {
          "id": 20,
          "anilistId": 2001,
          "languageV2": "Japanese",
          "sortOrder": 1,
          "name": {
            "full": "Atsumi Tanezaki",
            "native": "種﨑敦美",
            "userPreferred": "Atsumi Tanezaki"
          },
          "image": {
            "large": "https://...",
            "medium": "https://..."
          },
          "description": "...",
          "siteUrl": "https://anilist.co/staff/..."
        }
      ]
    }
  ]
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

`refreshToken`은 `HttpOnly` cookie로 설정됩니다.

```http
Set-Cookie: refreshToken=...; HttpOnly; SameSite=Lax; Path=/api/auth; Max-Age=2592000
```

```json
{
  "success": true,
  "message": "Login successful",
  "accessToken": "...",
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

`refreshToken`은 request body가 아니라 `HttpOnly` cookie에서 읽습니다. 프론트는 `credentials: "include"`로 호출해야 합니다.

Response example:

refresh token rotation으로 새 `refreshToken` cookie가 다시 설정됩니다.

```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "accessToken": "...",
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
현재 refresh token 로그아웃입니다. `refreshToken`은 `HttpOnly` cookie에서 읽고, 응답에서 cookie를 만료합니다.

Response example:

```http
Set-Cookie: refreshToken=; HttpOnly; SameSite=Lax; Path=/api/auth; Max-Age=0
```

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

응답에서 현재 브라우저의 `refreshToken` cookie도 만료합니다.

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

- `sort`: `latest | added | score | scoreAsc`
- `titleLanguage`: `ko | en | ja`
- `genre`: 선택값
- `year`: 선택값, 애니 방영 연도(`seasonYear`) 필터. 예: `2023`
- `score`: 선택값, 내 평점 점수대 필터 `1~10`. 예: `8`은 `8 <= score < 9`, `10`은 `score = 10`
- `limit`: `1~50`
- `cursor`: 이전 응답의 `pageInfo.nextCursor`

Example:

```http
GET /api/me/anime-list?year=2023&score=8&sort=score&titleLanguage=ko&limit=20
```

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
    "titleLanguage": "ko",
    "genre": null,
    "year": null,
    "score": null
  }
}
```

### `GET /me/anime-list/smart-rating/candidates`
스마트 평점 모달에서 비교할 기존 평가 작품 후보를 가져옵니다.

내 컬렉션에서 `score`가 있는 작품만 사용하며, `targetAnimeId`는 제외합니다. 후보는 매 요청마다 랜덤이고, 가능한 한 서로 다른 평점의 작품을 최대 5개까지 반환합니다.

Query:

- `targetAnimeId`: 필수, 새로 평점을 매기려는 애니 ID
- `titleLanguage`: `ko | en | ja`, 기본값 `ko`
- `limit`: `1~5`, 기본값 `5`

Example:

```http
GET /api/me/anime-list/smart-rating/candidates?targetAnimeId=123&titleLanguage=ko&limit=5
```

Response example:

```json
{
  "success": true,
  "targetAnimeId": 123,
  "items": [
    {
      "animeId": 10,
      "score": 10,
      "anime": {
        "id": 10,
        "anilistId": 154587,
        "title": "장송의 프리렌",
        "titles": {
          "korean": "장송의 프리렌",
          "english": "Frieren: Beyond Journey's End",
          "native": "葬送のフリーレン",
          "romaji": "Sousou no Frieren",
          "userPreferred": "Sousou no Frieren"
        },
        "coverImageLarge": "https://...",
        "coverImageExtraLarge": "https://..."
      }
    },
    {
      "animeId": 20,
      "score": 8,
      "anime": {
        "id": 20,
        "anilistId": 16498,
        "title": "진격의 거인",
        "titles": {
          "korean": "진격의 거인",
          "english": "Attack on Titan",
          "native": "進撃の巨人",
          "romaji": "Shingeki no Kyojin",
          "userPreferred": "Shingeki no Kyojin"
        },
        "coverImageLarge": "https://...",
        "coverImageExtraLarge": "https://..."
      }
    }
  ]
}
```

Error examples:

- `400`: 평가된 작품이 하나도 없거나 요청 값이 잘못된 경우
- `404`: `targetAnimeId` 애니가 없는 경우

### `POST /me/anime-list/smart-rating/estimate`
스마트 평점 모달에서 사용자의 비교 결과를 받아 추천 평점을 계산합니다.

프론트는 후보마다 새 작품이 기존 작품보다 어떤지 선택하게 하면 됩니다.

- `better`: 새 작품이 기존 작품보다 더 재밌음
- `similar`: 새 작품이 기존 작품과 비슷함
- `worse`: 새 작품이 기존 작품보다 별로임

Body:

```json
{
  "targetAnimeId": 123,
  "comparisons": [
    {
      "animeId": 10,
      "relation": "worse"
    },
    {
      "animeId": 20,
      "relation": "better"
    },
    {
      "animeId": 30,
      "relation": "similar"
    }
  ]
}
```

Response example:

```json
{
  "success": true,
  "targetAnimeId": 123,
  "estimatedScore": 9,
  "confidence": "medium",
  "range": {
    "min": 8,
    "max": 10
  },
  "comparisons": [
    {
      "animeId": 10,
      "relation": "worse",
      "score": 10
    },
    {
      "animeId": 20,
      "relation": "better",
      "score": 8
    }
  ],
  "reason": "8점 작품보다는 좋고 10점 작품보다는 낮게 평가되어 9점으로 추정했습니다."
}
```

계산된 점수는 저장하지 않습니다. 모달 마지막 단계에서 사용자가 적용을 누르면 기존 컬렉션 API로 저장하면 됩니다.

이미 컬렉션에 있는 애니:

```http
PATCH /api/me/anime-list/:animeId
```

```json
{
  "score": 8.5
}
```

컬렉션에 없는 애니:

```http
POST /api/me/anime-list
```

```json
{
  "animeId": 123,
  "status": "completed",
  "score": 8.5
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

Query:

- `sort`: `latest | added | score | scoreAsc`
- `titleLanguage`: `ko | en | ja`
- `genre`: 선택값
- `year`: 선택값, 애니 방영 연도(`seasonYear`) 필터. 예: `2023`
- `score`: 선택값, 사용자 평점 점수대 필터 `1~10`. 예: `8`은 `8 <= score < 9`, `10`은 `score = 10`
- `limit`: `1~50`
- `cursor`: 이전 응답의 `pageInfo.nextCursor`

Example:

```http
GET /api/users/12/anime-list?year=2023&score=8&sort=score&titleLanguage=ko&limit=20
```

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
    "titleLanguage": "ko",
    "genre": null,
    "year": null,
    "score": null
  }
}
```

### `GET /users/:userId/anime-stats`
다른 유저 애니 통계 조회입니다.

`item` 구조는 `GET /me/anime-stats`의 `item`과 동일합니다. 타 사용자 API는 공개 프로필 정보인 `user`만 추가로 포함합니다.

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
    "genreWatchMinutes": {
      "Drama": 2400,
      "Action": 1800
    },
    "genreAvgScore": {
      "Drama": 8.8,
      "Action": 7.9
    },
    "releaseYearDistribution": {
      "2020s": 18,
      "2010s": 12
    },
    "avgReleaseYear": 2019.4,
    "scoreDistribution": {
      "10": 3,
      "9": 8,
      "8": 12
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
    "preferenceSummary": "This user has 42 anime records and prefers Drama.",
    "recommendationContext": "Top genres => Drama:12, Action:9 | Preferred release years => 2020s:18, 2010s:12 | Average score => 8.4 | Watch minutes => 13440",
    "updatedAt": "2026-05-06 13:00:00"
  }
}
```

## Genre Preference Bubble Chart

사용자가 본 애니를 장르 단위 버블로 집계합니다. 버블 하나는 작품 하나가 아니라 **장르 하나**입니다.

차트 매핑:

- X축: `communityAverageScore`
- Y축: `myAverageScore`
- 버블 크기: `bubbleSize`
- 색상/group: `genre`
- 선호 차이: `preferenceScore = myAverageScore - communityAverageScore`

### `GET /me/anime-stats/genre-bubble`
내 장르 취향 bubble chart 데이터를 조회합니다.

인증 필요.

Query:

- `minCount`: 최소 작품 수, `1~100`, 기본값 `5`
- `weighting`: `full | fractional`, 기본값 `fractional`
- `status`: `completed | all`, 기본값 `completed`
- `communityScore`: `average | mean`, 기본값 `average`
- `titleLanguage`: `ko | en | ja`, 기본값 `ko`
- `topLimit`: 장르별 top rated anime 개수, `1~10`, 기본값 `3`

Example request:

```http
GET /api/me/anime-stats/genre-bubble?minCount=5&weighting=fractional&status=completed&communityScore=average&titleLanguage=ko
```

Response example:

```json
{
  "success": true,
  "item": {
    "userId": 1,
    "weighting": "fractional",
    "communityScore": "average",
    "status": "completed",
    "minCount": 5,
    "titleLanguage": "ko",
    "items": [
      {
        "genre": "Fantasy",
        "animeCount": 34,
        "weightedAnimeCount": 21.75,
        "myAverageScore": 9.2,
        "communityAverageScore": 8.0,
        "preferenceScore": 1.2,
        "totalWatchMinutes": 54720,
        "totalWatchHours": 912,
        "averageReleaseYear": 2018.4,
        "bubbleSize": 4.66,
        "topRatedAnime": [
          {
            "animeId": 123,
            "anilistId": 456,
            "title": "장송의 프리렌",
            "score": 10,
            "communityScore": 9.1,
            "coverImageLarge": "https://..."
          }
        ]
      }
    ],
    "axis": {
      "x": {
        "field": "communityAverageScore",
        "min": 7.1,
        "max": 9.3
      },
      "y": {
        "field": "myAverageScore",
        "min": 6.8,
        "max": 9.8
      }
    },
    "summary": {
      "genreCount": 12,
      "sourceAnimeCount": 88,
      "displayedTopAnimeCount": 30
    }
  }
}
```

### `GET /users/:userId/anime-stats/genre-bubble`
타 사용자 장르 취향 bubble chart 데이터를 조회합니다.

Query와 `item` 구조는 `/me/anime-stats/genre-bubble`과 같습니다. 응답에 공개 프로필 `user`가 추가됩니다.

Frontend notes:

- `items[].genre`별로 고유 색상을 지정합니다.
- `x = communityAverageScore`, `y = myAverageScore`, `z = bubbleSize`로 차트에 매핑합니다.
- 툴팁에는 `genre`, `myAverageScore`, `communityAverageScore`, `preferenceScore`, `animeCount`, `totalWatchHours`, `topRatedAnime[0]`를 우선 표시합니다.
- `axis.x/y.min/max`는 실제 데이터 범위입니다. 프론트에서 padding을 조금 더해 축을 잡으면 버블이 넓게 퍼집니다.
- `weighting=fractional`은 여러 장르를 가진 작품을 장르 수로 나누어 반영합니다. 취향 분석 기본값으로 추천합니다.

## Voice Actor Analysis

유저 컬렉션과 캐릭터/성우 동기화 데이터를 기반으로 성우 취향을 분석합니다.

분석 결과는 `user_voice_actor_stats` 스냅샷 테이블에 저장됩니다. 유저의 애니 컬렉션이 추가/수정/삭제되면 dirty 처리되고, 다음 랭킹 조회 시 자동 재계산됩니다.

### `GET /voice-actors/:voiceActorId`
성우 상세 페이지용 공개 API입니다. 성우 ID를 넘기면 성우 정보와 해당 성우가 맡은 캐릭터, 그리고 그 캐릭터가 등장한 작품을 함께 반환합니다.

인증이 필요 없습니다.

Query:

- `titleLanguage`: `ko | en | ja`, 기본값 `ko`
- `limit`: `1~50`, 기본값 `20`
- `cursor`: 다음 페이지 cursor

Example request:

```http
GET /api/voice-actors/12?titleLanguage=ko&limit=20
```

Response example:

```json
{
  "success": true,
  "item": {
    "voiceActor": {
      "id": 12,
      "anilistId": 95001,
      "name": {
        "full": "Kana Hanazawa",
        "native": "花澤香菜",
        "userPreferred": "Kana Hanazawa"
      },
      "image": {
        "large": "https://...",
        "medium": "https://..."
      },
      "languageV2": "Japanese",
      "description": "...",
      "siteUrl": "https://anilist.co/staff/..."
    },
    "summary": {
      "animeCount": 42,
      "characterCount": 45,
      "creditCount": 48
    },
    "items": [
      {
        "character": {
          "id": 77,
          "anilistId": 1001,
          "role": "MAIN",
          "edgeName": null,
          "sortOrder": 1,
          "name": {
            "full": "Character Name",
            "native": "キャラクター",
            "userPreferred": "Character Name"
          },
          "image": {
            "large": "https://...",
            "medium": "https://..."
          },
          "gender": "Female",
          "age": null,
          "description": "...",
          "siteUrl": "https://anilist.co/character/..."
        },
        "anime": {
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
          "coverImageExtraLarge": "https://...",
          "bannerImage": "https://...",
          "season": "FALL",
          "seasonYear": 2023,
          "format": "TV",
          "status": "FINISHED",
          "averageScore": 88,
          "meanScore": 88,
          "popularity": 250000,
          "favourites": 20000,
          "siteUrl": "https://anilist.co/anime/456",
          "isAdult": false
        },
        "voiceActing": {
          "languageV2": "Japanese",
          "sortOrder": 1
        }
      }
    ],
    "pageInfo": {
      "limit": 20,
      "titleLanguage": "ko",
      "hasNext": true,
      "nextCursor": "..."
    }
  }
}
```

Frontend usage:

- 성우 상세 상단에는 `item.voiceActor`와 `item.summary`를 사용합니다.
- 캐릭터/작품 리스트는 `item.items`를 사용합니다.
- `pageInfo.hasNext`와 `pageInfo.nextCursor`로 더보기 처리합니다.
- 이미지 필드는 nullable이므로 fallback UI가 필요합니다.

### `GET /me/voice-actors/ranking`
내가 많이 본 성우 또는 평점 기준으로 좋아하는 성우 랭킹을 조회합니다.

인증 필요.

Query:

- `sort`: `count | score`, 기본값 `count`
- `limit`: `1~50`, 기본값 `20`
- `cursor`: 다음 페이지 cursor
- `minAnimeCount`: 최소 출연 작품 수, 기본값 `1`
- `minRatedAnimeCount`: `sort=score`에서 최소 평점 작품 수, 기본값 `1`

Example requests:

```http
GET /api/me/voice-actors/ranking?sort=count&limit=20
GET /api/me/voice-actors/ranking?sort=score&minRatedAnimeCount=3&limit=20
```

Response example:

```json
{
  "success": true,
  "userId": 1,
  "items": [
    {
      "voiceActor": {
        "id": 12,
        "anilistId": 95001,
        "name": {
          "full": "Kana Hanazawa",
          "native": "花澤香菜",
          "userPreferred": "Kana Hanazawa"
        },
        "image": {
          "large": "https://...",
          "medium": "https://..."
        },
        "languageV2": "Japanese"
      },
      "animeCount": 34,
      "characterCount": 41,
      "ratedAnimeCount": 29,
      "scoreSum": 247,
      "averageScore": 8.52,
      "statsVersion": 3,
      "lastCalculatedAt": "2026-06-30 10:00:00"
    }
  ],
  "pageInfo": {
    "limit": 20,
    "sort": "score",
    "minAnimeCount": 1,
    "minRatedAnimeCount": 3,
    "hasNext": true,
    "nextCursor": "..."
  },
  "analysis": {
    "dirty": false,
    "version": 3,
    "calculatedAt": "2026-06-30 10:00:00"
  }
}
```

### `GET /users/:userId/voice-actors/ranking`
타 사용자의 성우 랭킹을 조회합니다.

Query와 응답 구조는 `/me/voice-actors/ranking`과 같습니다.

### `GET /me/voice-actors/:voiceActorId/anime`
특정 성우가 내 컬렉션의 어떤 애니에서 어떤 캐릭터를 맡았는지 cursor 기반으로 조회합니다.

인증 필요.

Query:

- `limit`: `1~50`, 기본값 `20`
- `cursor`: 다음 페이지 cursor
- `titleLanguage`: `ko | en | ja`, 기본값 `ko`

Example request:

```http
GET /api/me/voice-actors/12/anime?titleLanguage=ko&limit=20
```

Response example:

```json
{
  "success": true,
  "userId": 1,
  "voiceActor": {
    "id": 12,
    "anilistId": 95001,
    "name": {
      "full": "Kana Hanazawa",
      "native": "花澤香菜",
      "userPreferred": "Kana Hanazawa"
    },
    "image": {
      "large": "https://...",
      "medium": "https://..."
    },
    "languageV2": "Japanese",
    "description": "...",
    "siteUrl": "https://anilist.co/staff/..."
  },
  "items": [
    {
      "anime": {
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
        "coverImageExtraLarge": "https://...",
        "bannerImage": "https://...",
        "seasonYear": 2023,
        "format": "TV",
        "status": "FINISHED",
        "averageScore": 88
      },
      "userList": {
        "status": "completed",
        "score": 9,
        "progress": 28,
        "updatedAt": "2026-06-30 10:00:00"
      },
      "characters": [
        {
          "id": 77,
          "anilistId": 1001,
          "role": "MAIN",
          "sortOrder": 1,
          "name": {
            "full": "Frieren",
            "native": "フリーレン",
            "userPreferred": "Frieren"
          },
          "image": {
            "large": "https://...",
            "medium": "https://..."
          }
        }
      ]
    }
  ],
  "pageInfo": {
    "limit": 20,
    "titleLanguage": "ko",
    "hasNext": true,
    "nextCursor": "..."
  }
}
```

### `GET /users/:userId/voice-actors/:voiceActorId/anime`
타 사용자 컬렉션 기준으로 특정 성우가 나온 애니/캐릭터 목록을 조회합니다.

Query와 응답 구조는 `/me/voice-actors/:voiceActorId/anime`과 같습니다.

Frontend usage:

1. 분석 페이지 진입 시 `sort=count`, `sort=score` 랭킹을 각각 호출합니다.
2. 성우 카드를 클릭했을 때만 `/voice-actors/:voiceActorId/anime`을 호출합니다.
3. 상세 목록은 `pageInfo.nextCursor`로 더보기 처리합니다.

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

### `GET /me/badges`
내 배지 목록 조회입니다. 호출 시 현재 애니 통계를 기준으로 배지 획득 여부를 자동 계산합니다.

기본 제공 배지:

- `ANIME_TOTAL_100`: 시청 완료 애니 100편
- `ANIME_TOTAL_200`: 시청 완료 애니 200편
- `ANIME_TOTAL_300`: 시청 완료 애니 300편

기본 배지 이미지는 Supabase Storage의 `myanitrack_v2/badges` 폴더 파일을 사용합니다.

Response example:

```json
{
  "success": true,
  "items": [
    {
      "id": 1,
      "code": "ANIME_TOTAL_100",
      "name": "100편 시청",
      "description": "애니를 100개 이상 보았을 때 획득합니다.",
      "imageUrl": "https://.../storage/v1/object/public/myanitrack_v2/badges/watch-badge100.png",
      "category": "WATCH",
      "conditionType": "COMPLETED_COUNT",
      "conditionValue": "100",
      "rarity": "COMMON",
      "hidden": false,
      "earned": true,
      "earnedAt": "2026-06-28 12:00:00",
      "progressSnapshot": {
        "conditionType": "COMPLETED_COUNT",
        "conditionValue": "100",
        "currentValue": 120,
        "targetValue": 100
      },
      "progress": {
        "current": 120,
        "target": 100,
        "percent": 100,
        "isComplete": true
      }
    },
    {
      "id": 2,
      "code": "ANIME_TOTAL_200",
      "name": "200편 시청",
      "description": "애니를 200개 이상 보았을 때 획득합니다.",
      "imageUrl": "https://.../storage/v1/object/public/myanitrack_v2/badges/watch-badge200.png",
      "category": "WATCH",
      "conditionType": "COMPLETED_COUNT",
      "conditionValue": "200",
      "rarity": "RARE",
      "hidden": false,
      "earned": false,
      "earnedAt": null,
      "progressSnapshot": null,
      "progress": {
        "current": 120,
        "target": 200,
        "percent": 60,
        "isComplete": false
      }
    }
  ],
  "newlyEarned": [],
  "earnedCount": 1,
  "totalCount": 3
}
```

### `POST /me/badges/recalculate`
내 배지를 강제 재계산합니다. 보통은 `GET /me/badges`가 자동 계산하므로 프론트에서 필수로 호출할 필요는 없습니다.

Response example:

```json
{
  "success": true,
  "message": "User badges recalculated",
  "newlyEarned": [
    {
      "code": "ANIME_TOTAL_100",
      "name": "100편 시청",
      "earned": true,
      "progress": {
        "current": 100,
        "target": 100,
        "percent": 100,
        "isComplete": true
      }
    }
  ],
  "items": [],
  "earnedCount": 1,
  "totalCount": 3
}
```

### `GET /users/:userId/badges`
다른 유저의 공개 획득 배지 목록 조회입니다. 획득하지 않은 배지와 `hidden = true` 배지는 노출하지 않습니다.

Response example:

```json
{
  "success": true,
  "user": {
    "id": 12,
    "username": "mika",
    "profileImageUrl": "https://...",
    "bio": "anime lover",
    "animeListCount": 120
  },
  "items": [
    {
      "id": 1,
      "code": "ANIME_TOTAL_100",
      "name": "100편 시청",
      "description": "애니를 100개 이상 보았을 때 획득합니다.",
      "imageUrl": "https://.../storage/v1/object/public/myanitrack_v2/badges/watch-badge100.png",
      "category": "WATCH",
      "conditionType": "COMPLETED_COUNT",
      "conditionValue": "100",
      "rarity": "COMMON",
      "hidden": false,
      "earned": true,
      "earnedAt": "2026-06-28 12:00:00",
      "progressSnapshot": {
        "currentValue": 120,
        "targetValue": 100
      },
      "progress": {
        "current": 120,
        "target": 100,
        "percent": 100,
        "isComplete": true
      }
    }
  ],
  "earnedCount": 1
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
    "translatedKoreanTitleCount": 5300,
    "translationProgressRate": 62.72,
    "castSyncedAnimeCount": 2100,
    "castSyncProgressRate": 24.85,
    "characterCount": 18340,
    "voiceActorCount": 4120
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

### `POST /admin/anime/:animeId/sync/cast`
특정 애니의 캐릭터/성우 정보를 AniList에서 동기화합니다.

`animeId`는 내부 `anime.id`입니다.

Body:

```json
{
  "language": "JAPANESE",
  "perPage": 25
}
```

Response example:

```json
{
  "success": true,
  "message": "Anime cast synced successfully",
  "result": {
    "animeId": 123,
    "anilistId": 21858,
    "language": "JAPANESE",
    "processedPages": 2,
    "characterEdgeCount": 41,
    "characterCount": 41,
    "voiceActorCount": 38,
    "characterVoiceActorLinkCount": 38
  }
}
```

### `POST /admin/anime/sync/cast/batch`
동기화 기록이 없거나 실패한 애니의 캐릭터/성우 정보를 순차 동기화합니다.

Body:

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

### `POST /admin/anime/sync/cast/chunked`
캐릭터/성우 배치를 여러 청크로 순차 처리합니다. 100개를 초과하는 동기화 작업은 이 API를 사용합니다.

Body:

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

Response example:

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

Response example:

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

### `PATCH /admin/anime/:animeId/korean-title`
관리자가 특정 애니의 대표 한국어 제목을 직접 수정합니다.

관리자가 수정한 제목은 자동 변경 방지를 위해 `isLocked: true`, `source: "MANUAL"`로 저장됩니다. 기존 대표 한국어 제목은 대표 상태가 해제되고, 새 제목이 대표 제목이 됩니다.

Body:

```json
{
  "title": "장송의 프리렌",
  "subtitle": ""
}
```

Response example:

```json
{
  "success": true,
  "message": "Anime Korean title updated and locked",
  "item": {
    "id": 10,
    "animeId": 123,
    "title": "장송의 프리렌",
    "subtitle": null,
    "fullTitle": "장송의 프리렌",
    "isPrimary": true,
    "isLocked": true,
    "lockedAt": "2026-05-16 10:00:00",
    "lockedBy": 1,
    "source": "MANUAL",
    "createdAt": "2026-05-16 10:00:00",
    "updatedAt": "2026-05-16 10:00:00"
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
