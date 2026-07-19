# MyAniTrack Mobile

MyAniTrack의 Android/iOS Flutter 클라이언트입니다. 웹 랜딩이나 샘플 모드 없이 Google 로그인에서 시작하며, 로그인 후 `컬렉션 · 검색 · 분석 · 프로필` 네 개 탭을 제공합니다.

## 구성

- `CupertinoApp.router`, `go_router`, Riverpod 기반 앱 셸과 인증 게이트
- Dio 기반 API 클라이언트와 요청 시점의 최신 Supabase access token 주입
- cursor 컬렉션, 검색 debounce/취소, 상세 및 컬렉션 편집
- 요약·취향·랭킹 분석과 섹션별 독립 로딩/오류 처리
- 사용자명·프로필 이미지 수정, 약관, 로그아웃, 계정 삭제
- warm ivory/amber 디자인 토큰과 Pretendard 폰트

관리자, 친구, 공개 프로필, 배지와 웹 전용 고급 기능은 포함하지 않습니다.

## 실행 설정

`.env.example`을 복사해 로컬 `.env`를 만들고 다음 값을 채웁니다.

```dotenv
API_BASE_URL=https://api.myanitrack.com/api
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
```

기존 프로젝트를 위해 `SUPABASE_ANON_KEY`도 fallback으로 지원합니다. service role key는 앱에 포함하면 안 됩니다.

```powershell
flutter pub get
flutter run --dart-define-from-file=.env
```

## OAuth와 플랫폼

- Android application ID: `com.myanitrack.app`
- iOS bundle ID: `com.myanitrack.app`
- OAuth callback: `myanitrack://auth/callback`

Supabase의 redirect allow list와 Google provider 설정에도 동일한 callback을 등록해야 합니다. iOS 빌드와 실기기 OAuth 최종 검증은 macOS/Xcode 환경에서 진행합니다.

## 검증

```powershell
flutter analyze --no-pub
flutter test --no-pub
flutter build apk --debug --no-pub
```

DTO nullable 계약과 주요 소형 화면 로그인 동작은 `test/`에서 검증합니다.
