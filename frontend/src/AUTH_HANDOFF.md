# MyAniTrack Frontend Auth Handoff

웹의 신규 회원가입은 Google OAuth만 지원합니다. 기존 사용자를 위해 이메일/비밀번호 로그인,
비밀번호 재설정, 기존 미인증 계정의 이메일 인증 기능은 유지합니다.

## 핵심 파일

- `src/lib/auth.ts`: legacy 로그인, Google OAuth 시작/완료, 인증 요청과 세션 저장
- `src/contexts/AuthContext.tsx`: 앱 전역 사용자 및 세션 상태
- `src/pages/LoginPage.tsx`: Google 계속하기와 기존 회원 이메일 로그인
- `src/pages/SignupPage.tsx`: 입력 단계 없는 Google 전용 회원가입
- `src/pages/AuthCallbackPage.tsx`: `/auth/callback`에서 Supabase session을 백엔드에 교환
- `src/pages/TermsPage.tsx`, `src/pages/PrivacyPolicyPage.tsx`: 로그인 전 접근 가능한 동의 문서

## 인증 흐름

### 기존 이메일 로그인

```txt
POST /api/auth/login
→ 자체 access token은 메모리 저장
→ user/authMode='legacy'/만료 시각은 localStorage 저장
→ HttpOnly refresh cookie로 POST /api/auth/refresh
```

일반 이메일 회원가입 API는 `410 Gone`이므로 프론트에서 호출하지 않습니다.

### Google 로그인 및 회원가입

로그인과 회원가입의 intent를 구분하지 않습니다. 어느 화면에서든 Google 계정을 선택하면 같은
흐름으로 진행되며 처음 보는 계정은 즉시 생성됩니다.

```txt
signInWithGoogle()
→ Google 계정 선택
→ Supabase session 생성
→ /auth/callback
→ completeSupabaseLogin()
→ POST /api/auth/supabase
→ 백엔드에서 계정 생성/연결 및 최신 TERMS·PRIVACY 동의 기록
→ user와 authMode='supabase' 저장
→ 홈 또는 허용된 return path로 이동
```

Google 버튼 아래에는 계속 진행 시 이용약관과 개인정보처리방침에 동의한다는 고지와 `/terms`,
`/privacy` 링크가 있습니다. 체크박스나 pending agreement localStorage는 사용하지 않습니다.

백엔드는 `/auth/v1/user` 검증 후 JWT의 `sub`/`aud=authenticated`/`amr=oauth`와 Google
provider를 모두 확인합니다. Google이 연결된 계정이어도 현재 세션이 password 또는 OTP면
거부합니다. 보호 API에서도 같은 검증을 하고 이미 `supabase_user_id`로 연결된 사용자만
인증하며, 미들웨어가 신규 계정을 만들지는 않습니다.

## 콜백과 세션 주의사항

- Supabase에는 query 없는 `/auth/callback`만 redirect URL로 전달합니다.
- Google 계정 선택을 위해 `prompt: 'select_account'`를 사용합니다.
- React StrictMode 중복 effect는 `callbackPromiseRef`로 막습니다.
- callback route에서는 `AuthProvider` 자동 복구를 건너뛰고 초기 user를 `null`로 둡니다.
- Supabase 세션은 legacy `/api/auth/refresh`를 사용하지 않습니다.
- `normalizeStoredSession()`은 `authMode: 'supabase'`를 반드시 보존해야 합니다.
- 백엔드가 Google 세션을 `401` 또는 `403`으로 거부하면 Supabase 로컬 세션과 앱 저장 세션을
  제거한 뒤 다시 Google로 로그인하도록 안내합니다.
- 인증 API의 `429`는 `Retry-After`를 분 단위 안내로 표시하고, 제한 저장소 장애 `503`은 잠시 후
  재시도하도록 표시합니다.

## 운영 설정

Supabase Redirect URLs:

```txt
https://myanitrack.com/auth/callback
http://localhost:5173/auth/callback
```

필수 프론트 환경 변수:

```env
VITE_API_BASE_URL=https://api.myanitrack.com
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_AUTH_REDIRECT_ORIGIN=https://myanitrack.com
```

프론트 `VITE_SUPABASE_URL`과 백엔드 `SUPABASE_URL`은 같은 Supabase 프로젝트여야 합니다.
Supabase Dashboard에서는 Google만 활성화하고 Email, Phone, Anonymous 및 다른 OAuth provider는
비활성화합니다. 단, Google 신규 가입에 필요하므로 전역 신규 가입 허용은 유지합니다.
