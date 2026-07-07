# MyAniTrack Frontend Auth Handoff

이 문서는 프론트 로그인/회원가입 시스템 인수인계용 요약입니다. 현재 프론트는 기존 이메일 로그인과 Supabase Google OAuth를 함께 지원합니다.

## 핵심 파일

- `src/lib/auth.ts`
  - 이메일 로그인, Supabase OAuth 시작/완료, 세션 저장, `authFetch`, 로그아웃, 계정 삭제 API 호출을 담당합니다.
- `src/lib/supabase.ts`
  - Supabase client 생성과 환경변수 설정 여부 확인을 담당합니다.
- `src/contexts/AuthContext.tsx`
  - 앱 전역 로그인 상태, 부트스트랩, 로그아웃, 프로필 갱신을 관리합니다.
- `src/pages/LoginPage.tsx`
  - 이메일 로그인과 Google 로그인 진입 버튼이 있습니다.
- `src/pages/SignupPage.tsx`
  - 이메일 회원가입과 약관 동의 후 Google 회원가입 진입 버튼이 있습니다.
- `src/pages/AuthCallbackPage.tsx`
  - `/auth/callback`에서 Supabase OAuth 콜백을 완료하고 앱 세션으로 연결합니다.
- `src/types/auth.ts`
  - `StoredSession.authMode` 등 인증 관련 타입이 있습니다.

## 세션 종류

### 1. Legacy 이메일 로그인

흐름:

```txt
/api/auth/login
→ 백엔드 자체 accessToken 수신
→ accessToken은 메모리 저장
→ user, authMode='legacy', accessTokenExpiresAt은 localStorage 저장
→ refresh cookie 기반으로 /api/auth/refresh 수행
```

저장 위치:

- 메모리: 백엔드 access token
- localStorage `myanitrack.auth.session`: 유저 정보, `authMode: 'legacy'`, 만료 시간
- 백엔드 refresh cookie: refresh token

주의:

- legacy 세션만 `AuthContext`의 refresh timer를 탑니다.

### 2. Supabase Google 로그인

흐름:

```txt
Google OAuth
→ Supabase session 생성
→ /auth/callback
→ Supabase access token을 /api/auth/supabase로 전달
→ 백엔드 내부 users.id와 연결
→ user, authMode='supabase'만 localStorage 저장
→ API 요청마다 Supabase session access token 사용
```

저장 위치:

- Supabase SDK storage: Supabase session
- localStorage `myanitrack.auth.session`: 유저 정보, `authMode: 'supabase'`

주의:

- Supabase 세션은 legacy `/api/auth/refresh`를 절대 타면 안 됩니다.
- `normalizeStoredSession()`에서 `authMode`을 보존해야 합니다. 이 값이 사라지면 Google 세션이 legacy로 오해되어 끊깁니다.

## Google OAuth 시작

`signInWithGoogle(intent)`가 담당합니다.

- `intent`는 `'login' | 'signup'`
- intent는 URL query가 아니라 sessionStorage에 저장합니다.
- Supabase `redirectTo`에는 query 없는 `/auth/callback`만 넘깁니다.
- Google 계정 선택을 강제하기 위해 `prompt: 'select_account'`를 넘깁니다.

이유:

- Supabase Redirect URL allowlist가 query 포함 URL과 맞지 않으면 Site URL로 fallback할 수 있습니다.
- 이 fallback Site URL이 `localhost:3000`이면 production에서도 localhost로 튑니다.

관련 env:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_AUTH_REDIRECT_ORIGIN=https://myanitrack.com
```

`VITE_AUTH_REDIRECT_ORIGIN`이 없으면 `VITE_APP_URL`, 그것도 없으면 `window.location.origin`을 사용합니다.

## OAuth 콜백

`AuthCallbackPage`가 `/auth/callback`을 처리합니다.

중요한 설계:

- `AuthProvider`는 `/auth/callback`에서는 자동 Supabase 세션 복구를 하지 않습니다.
- 콜백 페이지가 직접 `completeGoogleLogin(intent)`를 실행합니다.
- React `StrictMode`에서 effect가 두 번 돌 수 있으므로 `callbackPromiseRef`로 처리 promise를 하나만 만듭니다.
- 이전 localStorage 유저가 헤더에 잠깐 뜨지 않게 `/auth/callback`에서는 초기 `user`를 `null`로 둡니다.

콜백 내부:

```txt
Supabase getSession()
→ access token 없으면 URL code로 exchangeCodeForSession()
→ /api/auth/supabase
→ 약관 확인/저장
→ 성공 시 홈 이동
→ 약관 필요 시 /signup 이동
```

## Google 회원가입과 약관

Google OAuth는 Google 계정을 선택하는 순간 Supabase Auth 유저가 먼저 생길 수 있습니다. 그래서 프론트에서는 앱 가입 완료 조건을 별도로 처리합니다.

회원가입 페이지:

```txt
필수 약관 체크
→ pending Supabase agreements를 localStorage에 저장
→ Google OAuth 시작(intent='signup')
→ 콜백에서 /api/me/agreements에 저장
```

로그인 페이지에서 신규 Google 계정 선택:

```txt
Google OAuth 시작(intent='login')
→ /api/auth/supabase 후 약관 없음 감지
→ local/Supabase 세션 정리
→ /signup으로 이동
→ 약관 동의 후 다시 Google로 계속
```

관련 key:

- localStorage `myanitrack.pending.supabase.agreements`
- sessionStorage `myanitrack.pending.supabase.intent`

## API 요청

`authFetch()`가 인증 헤더를 붙입니다.

우선순위:

1. 메모리 legacy access token
2. Supabase session access token

legacy token으로 요청했는데 401이면 `/api/auth/refresh` 후 재시도합니다. Supabase token으로 요청했는데 401이면 legacy refresh를 시도하지 않습니다.

## 로그아웃과 계정 삭제

로그아웃:

```txt
legacy logout API 호출 시도
→ Supabase signOut best-effort
→ localStorage session 삭제
→ user null
```

계정 삭제:

```txt
DELETE /api/auth/me
→ Supabase signOut best-effort
→ localStorage session 삭제
→ user null
```

계정 삭제 UI는 설정 페이지 보안 섹션에 있으며, `계정 삭제` 문구를 입력해야 실행됩니다.

## Production 설정 체크리스트

Supabase Dashboard Auth URL 설정:

- Site URL: `https://myanitrack.com`
- Redirect URLs:
  - `https://myanitrack.com/auth/callback`
  - 개발용 `http://localhost:5173/auth/callback`

Google Cloud OAuth 설정:

- Authorized JavaScript origins:
  - `https://myanitrack.com`
  - 개발용 `http://localhost:5173`

프론트 env:

```env
VITE_API_BASE_URL=https://api.myanitrack.com
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_AUTH_REDIRECT_ORIGIN=https://myanitrack.com
```

백엔드 env:

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

프론트 `VITE_SUPABASE_URL`과 백엔드 `SUPABASE_URL`은 같은 Supabase 프로젝트여야 합니다.

## 자주 터졌던 문제

### `/auth/callback`에서 무한 "로그인 처리 중"

원인:

- React `StrictMode` effect cleanup과 1회 실행 가드가 충돌했습니다.

현재 방어:

- `callbackPromiseRef`로 promise를 하나만 만들고 cleanup이 완료 처리를 막지 않게 했습니다.

### 신규 Google 계정인데 헤더가 로그인됨으로 보임

원인:

- `/auth/callback`에서 AuthProvider가 Supabase session을 먼저 복구했습니다.

현재 방어:

- `/auth/callback`에서는 AuthProvider 자동 복구를 건너뜁니다.
- 초기 user도 null로 둡니다.

### Production인데 localhost로 redirect

원인 후보:

- Supabase Site URL이 localhost
- redirect allowlist에 production `/auth/callback` 없음
- redirectTo에 query가 붙어 allowlist와 불일치

현재 방어:

- Supabase에는 query 없는 `/auth/callback`만 넘깁니다.
- intent는 sessionStorage로 관리합니다.
- `VITE_AUTH_REDIRECT_ORIGIN`으로 production origin을 명시할 수 있습니다.

### Google 세션이 얼마 뒤 끊김

원인:

- localStorage에서 세션을 읽을 때 `authMode: 'supabase'`가 사라져 legacy refresh timer를 탔습니다.

현재 방어:

- `normalizeStoredSession()`이 `authMode`을 보존합니다.
- Supabase 세션은 legacy refresh timer를 타지 않습니다.

## 다음 개선 권장

- 백엔드 `/api/auth/supabase`에서 신규 유저 생성 시 약관 동의 payload 없으면 생성을 막는 것이 가장 안전합니다.
- 지금 프론트는 신규 Google 계정을 `/signup`으로 유도하지만, API 직접 호출까지 막으려면 백엔드 보강이 필요합니다.
- OAuth 콜백 실패 시 서버 응답 `message`를 더 세분화하면 운영 디버깅이 쉬워집니다.
