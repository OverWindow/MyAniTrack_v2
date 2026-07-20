# Flutter App API Handoff

이 문서는 MyAniTrack Flutter 앱 개발자에게 백엔드 API 동작 방식과 연동 규칙을 전달하기 위한 인수인계 명세서다.

자세한 전체 API 레퍼런스는 `docs/backend-api-overview.md`, 로그인 구조 상세는 `docs/auth-system-handoff.md`를 함께 참고한다.

## 1. 기본 정보

Base URL:

```txt
https://myanitrack.com/api
```

개발 환경 예시:

```txt
http://localhost:<backend-port>/api
```

공통 응답:

```json
{
  "success": true
}
```

공통 에러 응답:

```json
{
  "success": false,
  "message": "Error message"
}
```

주요 상태 코드:

- `400`: 잘못된 요청 파라미터/body
- `401`: 로그인 필요, 토큰 없음, 토큰 만료
- `403`: 권한 없음, 이메일 인증/약관 동의 필요
- `404`: 대상 없음
- `409`: 중복 요청
- `500`: 서버 내부 오류

## 2. 앱 인증 전략

현재 백엔드는 두 인증 방식을 동시에 지원한다.

### 2.1 기존 이메일 로그인

백엔드 자체 JWT를 사용한다.

흐름:

1. 앱이 `POST /auth/login` 호출
2. 백엔드가 `accessToken` 반환
3. 백엔드가 `refreshToken`을 `HttpOnly Set-Cookie`로 내려줌
4. 이후 API 호출 시 `Authorization: Bearer <accessToken>` 사용
5. access token 만료 시 `POST /auth/refresh` 호출

주의:

- 로그인 응답 body에는 refresh token이 직접 포함되지 않는다.
- refresh token은 cookie로 내려오므로 Flutter에서 이메일 로그인을 지원하려면 HTTP cookie 저장소가 필요하다.
- `dio`를 쓴다면 `CookieManager` + cookie jar 구성이 필요하다.
- cookie 관리가 부담되면 앱에서는 Supabase Google 로그인을 우선 지원하는 것이 더 단순하다.

### 2.2 Supabase Google 로그인

Supabase Auth 세션을 사용한다.

흐름:

1. 앱이 Supabase Flutter SDK로 Google OAuth 시작
2. Supabase session 획득
3. 앱이 Supabase `accessToken`을 백엔드 `POST /auth/supabase`에 전달
4. 백엔드가 Supabase user를 내부 `users`와 연결하거나 신규 생성
5. 이후 모든 보호 API에 Supabase access token을 Bearer token으로 전달

중요:

- 백엔드 내부 기준 user id는 계속 `users.id`다.
- Supabase user id는 `users.supabase_user_id`에 저장된다.
- 기존 이메일 계정과 Google 이메일이 같으면 기존 계정에 Supabase 계정을 연결한다.
- 기존 계정이 없으면 Google 로그인 시 내부 user가 자동 생성된다.

## 3. Flutter Supabase 설정

권장 패키지:

```yaml
dependencies:
  supabase_flutter: ^2.0.0
```

앱 초기화 예시:

```dart
await Supabase.initialize(
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
);
```

환경값:

```txt
SUPABASE_URL=https://프로젝트REF.supabase.co
SUPABASE_ANON_KEY=...
API_BASE_URL=https://myanitrack.com/api
```

주의:

- Flutter 앱에는 Supabase `anon key`만 넣는다.
- `service role key`는 절대 앱에 넣지 않는다.
- 백엔드 `SUPABASE_URL`과 앱의 Supabase URL은 같은 프로젝트여야 한다.

## 4. 모바일 OAuth Redirect

웹은 `/auth/callback`을 사용하지만 Flutter 앱은 deep link 또는 app link가 필요하다.

예시 redirect URL:

```txt
myanitrack://auth/callback
```

Supabase Dashboard 설정:

Authentication > URL Configuration > Redirect URLs에 아래를 추가한다.

```txt
myanitrack://auth/callback
https://myanitrack.com/auth/callback
http://localhost:5173/auth/callback
```

Google Cloud Console OAuth redirect URI는 앱 deep link가 아니라 Supabase callback이다.

```txt
https://프로젝트REF.supabase.co/auth/v1/callback
```

Flutter 쪽에서는 Android intent filter, iOS URL scheme 또는 universal link 설정이 필요하다.

## 5. Google 로그인 구현 흐름

의사 코드:

```dart
final supabase = Supabase.instance.client;

await supabase.auth.signInWithOAuth(
  OAuthProvider.google,
  redirectTo: 'myanitrack://auth/callback',
);
```

앱이 callback을 받은 뒤 session을 확인한다.

```dart
final session = Supabase.instance.client.auth.currentSession;
final accessToken = session?.accessToken;

if (accessToken == null) {
  throw Exception('Supabase session not found');
}
```

백엔드에 Supabase login 연결:

```dart
final response = await http.post(
  Uri.parse('$apiBaseUrl/auth/supabase'),
  headers: {
    'Authorization': 'Bearer $accessToken',
  },
);
```

성공 응답:

```json
{
  "success": true,
  "message": "Supabase login successful",
  "tokenType": "Bearer",
  "authProvider": "supabase",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "username": "user",
    "role": "USER",
    "isAdmin": false,
    "emailVerified": true
  }
}
```

이 응답의 `user.id`가 앱에서 사용하는 내부 user id다.

## 6. API 요청 인증 헤더

Supabase 로그인 사용 시:

```dart
final session = Supabase.instance.client.auth.currentSession;
final token = session?.accessToken;

final response = await http.get(
  Uri.parse('$apiBaseUrl/auth/me'),
  headers: {
    'Authorization': 'Bearer $token',
  },
);
```

기존 이메일 로그인 사용 시:

```dart
final response = await http.get(
  Uri.parse('$apiBaseUrl/auth/me'),
  headers: {
    'Authorization': 'Bearer $appAccessToken',
  },
);
```

백엔드 `requireAuth`는 두 token을 모두 처리한다.

처리 순서:

1. 백엔드 자체 JWT로 검증
2. 실패하면 Supabase access token으로 검증
3. Supabase 검증 성공 시 내부 user를 찾거나 자동 생성

## 7. 로그인 전 샘플 화면

로그인하지 않은 사용자에게 컬렉션/분석 화면을 보여줄 때는 샘플 API를 사용한다.

대표 API:

```txt
GET /sample/overview
```

전체 URL:

```txt
GET https://myanitrack.com/api/sample/overview
```

응답에는 아래 데이터가 한 번에 들어온다.

- `user`
- `collection`
- `stats`
- `genreBubble`
- `yearlyScores`
- `formatDistribution`
- `studios`

앱 추천 사용:

- 비로그인 홈/온보딩: `/sample/overview`
- 로그인 후 내 화면: `/me/anime-list`, `/me/anime-stats/*`

개별 샘플 API:

```txt
GET /sample/anime-list
GET /sample/anime-stats
GET /sample/anime-stats/genre-bubble
GET /sample/anime-stats/yearly-scores
GET /sample/anime-stats/format-distribution
GET /sample/anime-stats/studios
```

주의:

- 샘플 user id는 `0`이다.
- 실제 DB 유저가 아니다.
- 샘플 이미지 URL은 `null`일 수 있으므로 앱에서 fallback 이미지를 준비한다.

## 8. 약관 동의

Google 로그인 후 백엔드는 내부 user를 자동 생성할 수 있다.

앱은 로그인 완료 후 약관 상태를 확인해야 한다.

```txt
GET /me/agreements
```

필수 약관 동의 저장:

```txt
PATCH /me/agreements
```

Body:

```json
{
  "termsAgreed": true,
  "termsVersion": "v1.0",
  "privacyAgreed": true,
  "privacyVersion": "v1.0"
}
```

앱 권장 흐름:

1. Google 로그인 완료
2. `POST /auth/supabase`
3. `GET /me/agreements`
4. 필수 약관이 false면 약관 화면 표시
5. 동의 후 `PATCH /me/agreements`
6. 메인 화면 진입

## 9. Auth API

### `POST /auth/supabase`

Supabase access token을 백엔드 내부 user와 연결한다.

Headers:

```txt
Authorization: Bearer <supabase_access_token>
```

성공 시 내부 user profile 반환.

### `GET /auth/me`

현재 로그인한 user profile 조회.

Headers:

```txt
Authorization: Bearer <access_token>
```

### `DELETE /auth/me`

본인 계정 삭제.

동작:

1. Supabase 연결 계정이면 Supabase Auth user 삭제
2. 내부 `users` row 삭제
3. FK cascade로 컬렉션/통계/토큰 등 삭제
4. 프로필 이미지는 best-effort 삭제

앱 처리:

```dart
await http.delete(
  Uri.parse('$apiBaseUrl/auth/me'),
  headers: {'Authorization': 'Bearer $token'},
);

await Supabase.instance.client.auth.signOut();
```

### `POST /auth/logout`

기존 이메일 로그인 refresh cookie 로그아웃.

Supabase 로그인은 앱에서 `supabase.auth.signOut()`도 호출한다.

### `POST /auth/logout-all`

기존 백엔드 refresh token 전체 무효화.

Supabase 세션 전체 로그아웃과는 별개다.

## 10. 컬렉션 API

### 내 컬렉션 조회

```txt
GET /me/anime-list
```

Query:

- `sort`: `latest | added | score | scoreAsc`
- `titleLanguage`: `ko | en | ja`
- `genre`: optional
- `year`: optional
- `score`: optional, `1~10`
- `query`: optional, 100자 이하. 한국어·영문·로마자·일본어·선호 제목 검색
- `limit`: `1~50`
- `cursor`: optional

`cursor`는 정렬·장르·연도·평점·검색어와 결합된다. 다른 `query`의 cursor를 재사용하면 `400`을 반환한다.

응답:

```json
{
  "success": true,
  "totalCount": 148,
  "items": [
    {
      "id": 1,
      "userId": 1,
      "animeId": 123,
      "status": "completed",
      "score": 9,
      "progress": 12,
      "anime": {
        "id": 123,
        "title": "장송의 프리렌",
        "coverImageLarge": "https://...",
        "seasonYear": 2023,
        "format": "TV",
        "averageScore": 88
      }
    }
  ],
  "pageInfo": {
    "hasNext": true,
    "nextCursor": "...",
    "limit": 20
  }
}
```

`totalCount`는 현재 필터·검색어를 적용하기 전의 사용자 전체 컬렉션 작품 수다.

### 컬렉션 추가

```txt
POST /me/anime-list
```

Body:

```json
{
  "animeId": 123,
  "status": "completed",
  "score": 8.5,
  "progress": 12,
  "startedAt": "2026-07-01",
  "completedAt": "2026-07-08",
  "notes": "Good"
}
```

### 컬렉션 수정

```txt
PATCH /me/anime-list/:animeId
```

Body는 변경할 필드만 보낸다.

```json
{
  "status": "watching",
  "score": 9,
  "progress": 8
}
```

### 컬렉션 삭제

```txt
DELETE /me/anime-list/:animeId
```

## 11. 애니 검색/상세 API

### 전체 애니 목록

```txt
GET /anime
```

Query:

- `sort`: `latest | score | season | popularity`
- `titleLanguage`: `ko | en | ja`
- `genre`: optional
- `limit`: `1~50`
- `cursor`: optional

### 애니 검색

```txt
GET /anime/search?query=프리렌
```

### 내 컬렉션 포함 검색

로그인 필요.

```txt
GET /me/anime/search?query=프리렌
```

각 결과에 `myCollection`이 붙는다.

```json
{
  "myCollection": {
    "exists": true,
    "status": "completed",
    "score": 9.5,
    "progress": 28
  }
}
```

### 애니 상세

```txt
GET /anime/:id
```

### 애니 캐스트

```txt
GET /anime/:id/cast?role=MAIN&voiceLanguage=Japanese&limit=20
```

## 12. 분석 API

모든 `/me/anime-stats/*` API는 로그인 필요.

### 전체 통계

```txt
GET /me/anime-stats
```

주요 필드:

- `totalCount`
- `completedCount`
- `watchingCount`
- `totalWatchedEpisodes`
- `totalWatchMinutes`
- `avgScore`
- `favoriteGenre`
- `genreDistribution`
- `scoreDistribution`
- `topWatchedGenreTopAnime`
- `topRatedGenreTopAnime`

### 장르 버블 차트

```txt
GET /me/anime-stats/genre-bubble
```

Query:

- `titleLanguage`: `ko | en | ja`
- `minCount`: default `5`
- `weighting`: `full | fractional`
- `status`: `all | completed`
- `communityScore`: `average | mean`
- `topLimit`: `1~10`

### 연도별 평균 평점

```txt
GET /me/anime-stats/yearly-scores?status=completed&minRatedAnimeCount=3
```

작품 3개 이상인 연도만 보여주고 싶으면 `minRatedAnimeCount=3`을 사용한다.

### 포맷별 분포

```txt
GET /me/anime-stats/format-distribution?status=completed&minCount=1
```

원그래프/도넛 차트용.

주요 필드:

- `items[].format`
- `items[].label`
- `items[].animeCount`
- `items[].percentage`
- `items[].averageScore`
- `summary.topFormat`

### 스튜디오 랭킹

```txt
GET /me/anime-stats/studios
```

Query:

- `sort`: `count | score | watchTime`
- `status`: `all | completed`
- `mainOnly`: `true | false`
- `minAnimeCount`: default `1`
- `minRatedAnimeCount`: default `1`
- `limit`: `1~50`
- `cursor`: optional

### 특정 스튜디오 작품 목록

```txt
GET /me/anime-stats/studios/:studioId/anime
```

## 13. 성우 분석 API

### 성우 랭킹

```txt
GET /me/voice-actors/ranking
```

Query:

- `sort`: `count | score`
- `limit`: `1~50`
- `cursor`: optional
- `minAnimeCount`: default `1`
- `minRatedAnimeCount`: default `1`

### 특정 성우의 내 컬렉션 출연작

```txt
GET /me/voice-actors/:voiceActorId/anime
```

Query:

- `titleLanguage`: `ko | en | ja`
- `limit`: `1~50`
- `cursor`: optional

## 14. 공개 사용자 API

로그인 없이 다른 유저 공개 데이터를 볼 수 있다.

```txt
GET /users/:userId/profile
GET /users/:userId/anime-list
GET /users/:userId/anime-stats
GET /users/:userId/anime-stats/genre-bubble
GET /users/:userId/anime-stats/yearly-scores
GET /users/:userId/anime-stats/format-distribution
GET /users/:userId/anime-stats/studios
GET /users/:userId/badges
GET /users/:userId/voice-actors/ranking
GET /users/:userId/voice-actors/:voiceActorId/anime
```

공개 API는 응답에 `user` 공개 프로필이 포함되는 경우가 많다.

## 15. 플랫폼 공개 통계

```txt
GET /stats/platform
GET /stats/platform/popular-anime?limit=10
```

로그인 전 앱 홈에서 서비스 규모와 인기 애니를 보여줄 때 사용할 수 있다.

## 16. 이미지 처리

이미지 필드는 대부분 nullable이다.

대표 필드:

- `profileImageUrl`
- `coverImageLarge`
- `coverImageExtraLarge`
- `bannerImage`
- `image.large`
- `image.medium`

앱은 모든 이미지에 fallback UI를 준비해야 한다.

## 17. 페이지네이션

무한 스크롤 API는 cursor 기반이다.

요청:

```txt
GET /me/anime-list?limit=20&cursor=<nextCursor>
```

응답:

```json
{
  "pageInfo": {
    "hasNext": true,
    "nextCursor": "..."
  }
}
```

앱 규칙:

- `hasNext = true`이고 `nextCursor != null`이면 다음 페이지 호출
- 다음 요청에는 같은 필터/sort와 cursor를 같이 보낸다
- 필터가 바뀌면 cursor를 버리고 첫 페이지부터 다시 호출한다

## 18. 날짜/점수/상태 값

날짜:

- 요청 날짜는 `YYYY-MM-DD`
- 응답 timestamp는 DB datetime 문자열 또는 ISO 문자열이 섞일 수 있으므로 앱에서 tolerant parsing 필요

컬렉션 상태:

```txt
planned
watching
completed
paused
dropped
```

점수:

- `score`: `0~10`, 소수 가능
- 분석 평균 점수는 보통 `0~10` scale
- AniList community score는 원본에 따라 `averageScore: 84`처럼 `0~100` 값일 수 있음

## 19. Flutter API Client 권장 구조

추천 레이어:

```txt
ApiClient
AuthRepository
AnimeRepository
CollectionRepository
StatsRepository
SampleRepository
ProfileRepository
```

`ApiClient` 책임:

- base URL 관리
- Supabase access token 또는 app JWT 주입
- JSON decode
- 공통 에러 매핑
- cursor pagination helper

간단한 요청 wrapper 예시:

```dart
Future<Map<String, dynamic>> getJson(String path) async {
  final session = Supabase.instance.client.auth.currentSession;
  final token = session?.accessToken;

  final response = await http.get(
    Uri.parse('$apiBaseUrl$path'),
    headers: {
      if (token != null) 'Authorization': 'Bearer $token',
      'Accept': 'application/json',
    },
  );

  final json = jsonDecode(response.body) as Map<String, dynamic>;

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw ApiException(
      statusCode: response.statusCode,
      message: json['message']?.toString() ?? 'Request failed',
    );
  }

  return json;
}
```

## 20. 앱 화면별 추천 API

### 로그인 전 홈

```txt
GET /sample/overview
GET /stats/platform
GET /stats/platform/popular-anime?limit=10
```

### 로그인 직후

```txt
POST /auth/supabase
GET /auth/me
GET /me/agreements
```

### 내 컬렉션

```txt
GET /me/anime-list
POST /me/anime-list
PATCH /me/anime-list/:animeId
DELETE /me/anime-list/:animeId
```

### 분석 탭

```txt
GET /me/anime-stats
GET /me/anime-stats/genre-bubble
GET /me/anime-stats/yearly-scores
GET /me/anime-stats/format-distribution
GET /me/anime-stats/studios
GET /me/voice-actors/ranking
```

### 프로필/설정

```txt
GET /auth/me
PATCH /me/profile
GET /me/agreements
PATCH /me/agreements
DELETE /auth/me
```

## 21. 구현 시 주의사항

- Supabase access token은 만료될 수 있으므로 요청 직전에 현재 session에서 꺼낸다.
- `provider_token`을 백엔드에 보내지 않는다. 백엔드에는 Supabase `access_token`만 보낸다.
- 로그에 token을 출력하지 않는다.
- `SUPABASE_SERVICE_ROLE_KEY`는 앱에 절대 포함하지 않는다.
- 이미지 nullable 처리 필수.
- cursor pagination에서 필터 변경 시 cursor 초기화 필수.
- 로그인 전 샘플 user id `0`을 실제 user id로 저장하지 않는다.
- 이메일 로그인 refresh cookie를 Flutter에서 쓰려면 cookie jar가 필요하다.
- Google 로그인만 우선 지원하면 Supabase SDK가 session refresh를 맡으므로 앱 구현이 더 단순하다.

