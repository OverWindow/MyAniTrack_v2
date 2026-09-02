# Login System Handoff

이 문서는 MyAniTrack v2의 현재 로그인/회원가입 시스템을 인수인계하기 위한 요약이다.

현재 인증 방식은 두 가지를 함께 지원한다.

- 기존 이메일/비밀번호 로그인: 자체 JWT + refresh token
- 신규 가입 및 Google 로그인: Supabase Google OAuth + 기존 `users` 테이블 연결

일반 이메일 회원가입은 종료되었으며 `POST /api/auth/signup`은 항상 `410 Gone`을 반환한다.

## 목표

기존 백엔드 사용자 데이터는 유지하면서 Google/Gmail 로그인을 추가한다.

핵심 원칙은 다음과 같다.

- 서비스 내부의 기준 유저 ID는 계속 `users.id`를 사용한다.
- Supabase Auth의 user id는 `users.supabase_user_id`에 연결한다.
- 기존 이메일 계정이 Google 로그인 이메일과 같으면 새 유저를 만들지 않고 기존 계정에 Supabase 계정을 연결한다.
- 기존 계정이 없으면 Google 로그인 시 내부 `users` row를 자동 생성한다.
- Google 인증 성공 시 현재 이용약관과 개인정보처리방침 동의를 같은 트랜잭션에서 기록한다.
- 보호 API 인증 미들웨어는 미연결 Supabase 사용자를 생성하거나 이메일로 연결하지 않는다.

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
- `src/middleware/rate-limit.middleware.ts`, `src/services/auth-rate-limit.service.ts`
  - MySQL 기반 인증 요청 제한, HMAC 제한 키, 만료 행 정리
- `src/routes/auth.routes.ts`
  - auth route 정의
- `sql_scripts/016_supabase_auth.sql`
  - Supabase Auth 연결용 users 컬럼 추가 SQL
- `sql_scripts/021_auth_rate_limits.sql`
  - 다중 인스턴스에서 공유하는 인증 요청 제한 테이블

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

현재 구현은 `users.supabase_user_id` 컬럼과 `auth_rate_limits` 테이블이 존재한다고 가정한다.
서버 시작 시 마이그레이션이 자동 적용된다.

## 환경 변수

백엔드:

```env
SUPABASE_URL=https://프로젝트REF.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
TRUST_PROXY_HOPS=1
AUTH_LOGIN_WINDOW_SECONDS=900
AUTH_LOGIN_IP_MAX=30
AUTH_LOGIN_IDENTITY_MAX=10
AUTH_SUPABASE_WINDOW_SECONDS=300
AUTH_SUPABASE_IP_MAX=30
```

`SUPABASE_SERVICE_ROLE_KEY`는 본인 계정 삭제 시 Supabase Auth user를 삭제하기 위해 필요하다.
Railway production은 앱 앞의 신뢰할 프록시가 한 단계이므로 `TRUST_PROXY_HOPS=1`을 명시한다.
개발 환경에서는 proxy trust가 비활성화된다. 실제 배포 토폴로지가 바뀌면 hop 수를 먼저 확인한 뒤
이 값을 조정해야 하며, 임의로 크게 설정하면 위조된 `X-Forwarded-For`가 제한 키에 사용될 수 있다.

프론트:

```env
VITE_SUPABASE_URL=https://프로젝트REF.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_API_BASE_URL=https://myanitrack.com
```

`VITE_SUPABASE_URL`은 일반적으로 서비스 도메인이 아니라 Supabase project URL을 사용한다.

## Supabase Dashboard 설정

Authentication > Providers에서 다음과 같이 설정한다.

- Google만 활성화한다.
- Email, Phone, Anonymous와 Google 이외의 모든 OAuth provider를 비활성화한다.
- 전역 신규 가입 허용은 끄지 않는다. Google 신규 회원 생성에 필요하다.

Dashboard 설정은 방어 계층 중 하나이며, 백엔드는 설정과 별개로 매 요청의 `sub`, `aud`, `amr`,
Google provider를 다시 검증한다.

Authentication URL Configuration:

Site URL:

```txt
https://myanitrack.com
```

Redirect URLs:

```txt
https://myanitrack.com/auth/callback
http://localhost:5173/auth/callback
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
5. 백엔드가 같은 Supabase access token으로 `/auth/v1/user`를 조회해 토큰을 검증
6. JWT의 `sub`가 반환된 user id와 같고 `aud=authenticated`, `amr`에 `oauth`가 있는지 확인
7. `app_metadata.providers`에 Google이 있는지 확인하고 내부 `users`를 찾거나 생성
8. 현재 이용약관과 개인정보처리방침 동의를 원자적으로 기록
9. 프론트는 `authMode: 'supabase'`로 session 저장
10. 이후 API 호출 시 Supabase access token을 `Authorization` header에 넣음

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

백엔드 Google OAuth 교환의 처리 순서:

1. `/auth/v1/user`로 Supabase access token 검증
2. JWT `sub`/`aud`와 현재 인증 방식 `amr=oauth` 확인
3. Google provider 포함 여부와 email confirmed 확인
4. `users.supabase_user_id = supabaseUser.id`인 내부 유저 조회
5. 있으면 해당 유저 반환
6. 없으면 `users.email = supabaseUser.email`인 기존 유저 조회
7. 있으면 기존 유저에 `supabase_user_id`, `auth_provider` 연결
8. 없으면 신규 `users` row 생성
9. 신규·기존 모두 현재 `TERMS`, `PRIVACY` 동의를 보완하되 이미 최신이면 이력을 추가하지 않음

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
4. `/auth/v1/user`, JWT `sub`/`aud`/`amr`, Google provider를 동일하게 검증
5. 검증 성공 시 `supabase_user_id`로 이미 연결된 내부 user만 조회
6. 성공하면 `req.authUser` 설정

따라서 보호된 API는 기존처럼 `requireAuth`만 붙이면 된다.

```ts
router.get('/me/anime-list', requireAuth, getMyAnimeList);
```

## 인증 요청 제한

인증 제한 상태는 프로세스 메모리가 아니라 MySQL `auth_rate_limits`에 저장된다. 각 요청은
트랜잭션 안에서 해당 행을 `SELECT ... FOR UPDATE`로 잠근 뒤 증가하므로 서버 재시작과 다중
인스턴스에서도 같은 제한을 공유한다.

기본값:

- 이메일 로그인 IP: 15분당 30회
- 이메일 로그인 IP + 정규화 이메일: 15분당 10회
- `POST /auth/supabase` IP: 5분당 30회
- 인증 메일/비밀번호 재설정 요청: 기존 15분·일일 정책을 같은 MySQL 저장소에서 적용

IP와 이메일 원문은 저장하지 않는다. `AUTH_TOKEN_SECRET`을 키로 하고 scope를 분리한
HMAC-SHA256 해시만 저장한다. 초과 시 `429`와 초 단위 `Retry-After`, 저장소 장애 시
fail-closed `503 Authentication temporarily unavailable`을 반환한다. 1,000번째 제한 요청마다
48시간보다 오래된 행을 최대 1,000개씩 best-effort로 정리한다.

## 약관 동의 흐름

로그인·회원가입 화면의 Google 버튼 옆에는 계속 진행 시 이용약관과 개인정보처리방침에
동의한다는 고지와 공개 문서 링크가 표시된다. OAuth callback은 `/api/auth/supabase`를 한 번
호출하며, 백엔드는 사용자 생성 또는 기존 계정 연결과 현재 버전 동의 기록을 한 트랜잭션에서
처리한다. 브라우저에 pending agreement payload를 저장하거나 별도 동의 화면으로 되돌리지 않는다.

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
POST   /api/auth/signup       # 410 Gone, 신규 이메일 가입 차단
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
- Supabase는 Google만 켜고 Email, Phone, Anonymous, 다른 OAuth provider는 끄되 전역 가입은 유지
- Railway에 `TRUST_PROXY_HOPS=1`과 인증 제한 환경변수 적용
- `auth_rate_limits` 마이그레이션 적용 및 MySQL 계정의 INSERT/SELECT/UPDATE/DELETE 권한 확인
- 웹 OAuth와 모바일 `signInWithIdToken(provider: google)` 세션 모두 `amr=oauth`로 통과하는지 실기기 확인

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
- password/OTP 세션이거나 JWT의 `sub`, `aud`, `amr`가 정책과 맞지 않음

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
- `AUTH_TOKEN_SECRET`을 교체하면 기존 자체 JWT뿐 아니라 rate-limit 키 공간도 바뀌므로 계획된 세션 폐기와 함께 진행한다.
