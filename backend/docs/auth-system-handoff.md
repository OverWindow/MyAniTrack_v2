# Login System Handoff

이 문서는 MyAniTrack v2의 현재 로그인/회원가입 시스템을 인수인계하기 위한 요약이다.

현재 인증 방식은 두 가지를 함께 지원한다.

- 기존 이메일/비밀번호 로그인: 자체 JWT + refresh token
- Google 로그인: Supabase Auth OAuth + 기존 `users` 테이블 연결

## 목표

기존 백엔드 사용자 데이터는 유지하면서 Google/Gmail 로그인을 추가한다.

핵심 원칙은 다음과 같다.

- 서비스 내부의 기준 유저 ID는 계속 `users.id`를 사용한다.
- Supabase Auth의 user id는 `users.supabase_user_id`에 연결한다.
- 기존 이메일 계정이 Google 로그인 이메일과 같으면 새 유저를 만들지 않고 기존 계정에 Supabase 계정을 연결한다.
- 기존 계정이 없으면 Google 로그인 시 내부 `users` row를 자동 생성한다.

## 관련 파일

백엔드:

- `src/lib/auth.ts`
  - 기존 앱 JWT 생성/검증
  - refresh token 값 생성/해시
- `src/lib/supabase-auth.ts`
  - Supabase access token 검증
  - Supabase Auth admin user 삭제
- `src/services/auth.service.ts`
  - 기존 이메일 회원가입/로그인
  - Supabase user를 내부 `users`와 연결 또는 생성
  - 본인 계정 삭제
- `src/controllers/auth.controller.ts`
  - auth API controller
- `src/middleware/auth.middleware.ts`
  - 기존 앱 JWT와 Supabase access token을 모두 처리
- `src/routes/auth.routes.ts`
  - auth route 정의
- `sql_scripts/016_supabase_auth.sql`
  - Supabase Auth 연결용 users 컬럼 추가 SQL

프론트:

- `frontend/src/lib/supabase.ts`
  - Supabase client 생성
- `frontend/src/lib/auth.ts`
  - Google OAuth 시작, callback 처리, backend 연결
  - legacy/supabase auth mode 저장
- `frontend/src/contexts/AuthContext.tsx`
  - 앱 전역 로그인 상태 관리
- `frontend/src/pages/AuthCallbackPage.tsx`
  - Google OAuth callback 화면
- `frontend/src/pages/LoginPage.tsx`
  - Google 로그인 버튼
- `frontend/src/pages/SignupPage.tsx`
  - Google 회원가입 버튼 및 약관 동의 처리

## DB 변경

Supabase Auth와 내부 users 테이블을 연결하기 위해 아래 SQL이 필요하다.

```sql
ALTER TABLE users
ADD COLUMN supabase_user_id CHAR(36) NULL COMMENT 'Supabase auth.users.id',
ADD COLUMN auth_provider VARCHAR(30) NULL COMMENT 'Last linked auth provider, e.g. google';

CREATE UNIQUE INDEX uq_users_supabase_user_id
ON users (supabase_user_id);
```

현재 구현은 `users.supabase_user_id` 컬럼이 존재한다고 가정한다.

## 환경 변수

백엔드:

```env
SUPABASE_URL=https://프로젝트REF.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

`SUPABASE_SERVICE_ROLE_KEY`는 본인 계정 삭제 시 Supabase Auth user를 삭제하기 위해 필요하다.

프론트:

```env
VITE_SUPABASE_URL=https://프로젝트REF.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_API_BASE_URL=https://myanitrack.com
```

`VITE_SUPABASE_URL`은 일반적으로 서비스 도메인이 아니라 Supabase project URL을 사용한다.

## Supabase Dashboard 설정

Authentication URL Configuration:

Site URL:

```txt
https://myanitrack.com
```

Redirect URLs:

```txt
https://myanitrack.com/auth/callback
https://myanitrack.com/auth/callback?intent=login
https://myanitrack.com/auth/callback?intent=signup
http://localhost:5173/auth/callback
http://localhost:5173/auth/callback?intent=login
http://localhost:5173/auth/callback?intent=signup
```

Google Cloud Console OAuth Redirect URI:

```txt
https://프로젝트REF.supabase.co/auth/v1/callback
```

주의: production에서 `localhost:3000/#access_token=...`으로 돌아가면 Supabase의 Site URL 또는 Redirect URLs가 잘못된 상태다.

## 기존 이메일 로그인 흐름

1. 프론트가 `POST /api/auth/login` 호출
2. 백엔드가 email/password 검증
3. 백엔드가 자체 access token과 refresh token 발급
4. refresh token은 httpOnly cookie에도 저장
5. 프론트는 access token 만료 시간을 localStorage session에 저장
6. API 호출 시 `Authorization: Bearer <app_access_token>` 사용
7. access token 만료 시 `/api/auth/refresh`로 갱신

응답 형태:

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
    "username": "user",
    "role": "USER"
  }
}
```

## Google 로그인 흐름

1. 프론트가 `supabase.auth.signInWithOAuth({ provider: 'google' })` 호출
2. Google 로그인 완료 후 Supabase가 `/auth/callback`으로 redirect
3. 프론트 callback page가 Supabase session/access token 확보
4. 프론트가 `POST /api/auth/supabase` 호출
5. 백엔드가 Supabase access token으로 `/auth/v1/user` 조회
6. 백엔드가 내부 `users`를 찾거나 생성
7. 프론트는 `authMode: 'supabase'`로 session 저장
8. 이후 API 호출 시 Supabase access token을 `Authorization` header에 넣음

프론트 요청:

```ts
await fetch('/api/auth/supabase', {
  method: 'POST',
  credentials: 'include',
  headers: {
    Authorization: `Bearer ${supabaseAccessToken}`,
  },
});
```

## Supabase user 연결 규칙

백엔드 `findOrCreateUserFromSupabaseToken()`의 처리 순서:

1. Supabase access token 검증
2. Google provider 또는 Supabase email confirmed 확인
3. `users.supabase_user_id = supabaseUser.id`인 내부 유저 조회
4. 있으면 해당 유저 반환
5. 없으면 `users.email = supabaseUser.email`인 기존 유저 조회
6. 있으면 기존 유저에 `supabase_user_id`, `auth_provider` 연결
7. 없으면 신규 `users` row 생성

신규 생성 시:

- `email`: Supabase email
- `username`: Google metadata name 또는 email prefix 기반 자동 생성
- `password_hash`: `SUPABASE_AUTH:<supabase user id>`
- `role`: `USER`
- `email_verified`: `TRUE`
- `supabase_user_id`: Supabase Auth user id
- `auth_provider`: 주로 `google`

## 인증 미들웨어

`requireAuth`는 Bearer token 하나로 두 방식을 모두 처리한다.

처리 순서:

1. 기존 앱 JWT로 검증 시도
2. 성공하면 `req.authUser` 설정
3. 실패하면 같은 token을 Supabase access token으로 검증 시도
4. Supabase 검증 성공 시 내부 user를 찾거나 자동 생성
5. 성공하면 `req.authUser` 설정

따라서 보호된 API는 기존처럼 `requireAuth`만 붙이면 된다.

```ts
router.get('/me/anime-list', requireAuth, getMyAnimeList);
```

## 약관 동의 흐름

Google 회원가입 버튼은 가입 전에 약관 동의 payload를 localStorage에 임시 저장한다.

Callback 완료 후:

1. `/api/auth/supabase`로 내부 유저 연결/생성
2. 저장된 약관 동의 payload가 있으면 `/api/me/agreements`에 PATCH
3. payload가 없으면 `/api/me/agreements` 조회
4. 필수 약관 미동의면 Supabase session 로그아웃 후 약관 동의 화면으로 유도

기존 로그인 화면에서 처음 보는 Google 계정으로 로그인하면 내부 유저는 생성되지만, 약관 동의가 없으면 프론트가 회원가입/약관 동의 흐름으로 돌려보낸다.

## 로그인 전 샘플 화면

로그인하지 않은 사용자에게 컬렉션/분석 화면을 미리 보여주기 위해 공개 샘플 API를 제공한다.

대표 API:

```txt
GET /api/sample/overview
```

개별 API:

```txt
GET /api/sample/anime-list
GET /api/sample/anime-stats
GET /api/sample/anime-stats/genre-bubble
GET /api/sample/anime-stats/yearly-scores
GET /api/sample/anime-stats/format-distribution
GET /api/sample/anime-stats/studios
```

특징:

- 인증이 필요 없다.
- 실제 DB 유저를 만들지 않는다.
- `user.id`는 샘플 전용 `0`이다.
- 응답 구조는 실제 `/me/anime-list`, `/me/anime-stats/*` 계열과 비슷하게 맞춰져 있다.
- 프론트는 로그인 전에는 `/api/sample/*`, 로그인 후에는 `/api/me/*` API로 전환하면 된다.

상세 응답 구조와 쿼리 파라미터는 `docs/backend-api-overview.md`의 `Guest Sample` 섹션을 참고한다.

## 본인 계정 삭제

API:

```txt
DELETE /api/auth/me
```

인증:

```txt
Authorization: Bearer <app_access_token 또는 supabase_access_token>
```

동작:

1. 현재 내부 user 조회
2. `supabase_user_id`가 있으면 Supabase Auth user 삭제
3. 내부 `users` row 삭제
4. FK cascade로 refresh token, 컬렉션, 분석 데이터 등 삭제
5. 프로필 이미지는 Supabase Storage에서 best-effort 삭제

프론트 예시:

```ts
await fetch('/api/auth/me', {
  method: 'DELETE',
  headers: {
    Authorization: `Bearer ${session.access_token}`,
  },
});

await supabase.auth.signOut();
```

## 주요 API

```txt
POST   /api/auth/signup
POST   /api/auth/login
POST   /api/auth/supabase
POST   /api/auth/refresh
POST   /api/auth/logout
POST   /api/auth/logout-all
GET    /api/auth/me
DELETE /api/auth/me
GET    /api/me/agreements
PATCH  /api/me/agreements
```

## 운영 체크리스트

- `SUPABASE_URL`과 `VITE_SUPABASE_URL`이 같은 Supabase project를 가리키는지 확인
- `SUPABASE_ANON_KEY`가 백엔드와 프론트에 올바르게 들어갔는지 확인
- `SUPABASE_SERVICE_ROLE_KEY`는 백엔드에만 설정하고 프론트에 절대 노출하지 말 것
- Supabase Site URL은 production 도메인으로 설정
- Redirect URLs에 production과 localhost callback을 모두 등록
- Google Cloud OAuth redirect URI는 Supabase callback URL로 설정
- `users.supabase_user_id`, `users.auth_provider` 컬럼과 unique index 적용 확인

## 자주 나는 문제

### Google 로그인 후 localhost로 이동함

원인:

- Supabase Site URL이 `http://localhost:3000` 같은 개발 주소로 되어 있음
- production callback URL이 Redirect URLs에 등록되지 않음

해결:

- Site URL을 `https://myanitrack.com`으로 변경
- Redirect URLs에 `https://myanitrack.com/auth/callback` 추가

### 프론트에 "인증 정보가 올바르지 않거나 만료되었어요"가 표시됨

가능한 원인:

- Supabase token이 다른 project의 token임
- 백엔드 `SUPABASE_URL`과 프론트 `VITE_SUPABASE_URL`이 다름
- 내부 DB에 `supabase_user_id` 컬럼이 없음
- 신규 user insert 중 DB 제약 조건 실패

확인:

- 백엔드 로그의 Supabase/DB 에러 확인
- `/api/auth/supabase` 응답의 `message` 확인

### Supabase Custom Domain을 쓰고 싶음

가능하지만 유료 add-on이다.

비용을 피하려면:

```env
VITE_SUPABASE_URL=https://프로젝트REF.supabase.co
VITE_API_BASE_URL=https://myanitrack.com
```

이 구조를 유지한다.

## 보안 주의

- OAuth callback URL에 `access_token`, `refresh_token`, `provider_token`이 노출될 수 있으므로 로그나 채팅에 붙여넣지 않는다.
- 노출된 token은 즉시 로그아웃/세션 폐기 처리한다.
- `SUPABASE_SERVICE_ROLE_KEY`는 서버 전용이다.
- 프론트에는 `VITE_SUPABASE_ANON_KEY`만 사용한다.
