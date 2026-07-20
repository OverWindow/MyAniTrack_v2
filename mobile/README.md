# MyAniTrack Mobile

MyAniTrack의 Android/iOS Flutter 클라이언트입니다. 웹 랜딩이나 샘플 모드 없이 Google 로그인에서 시작하며, `홈 · 컬렉션 · 검색 · 분석 · 프로필` 탭을 제공합니다.

## 구성

- `CupertinoApp.router`, `go_router`, Riverpod 기반 앱 셸과 인증 게이트
- Dio 기반 API 클라이언트와 요청 시점의 최신 Supabase access token 주입
- cursor 컬렉션, 검색 debounce/취소, 상세 및 컬렉션 편집
- 요약·취향·랭킹 분석과 섹션별 독립 로딩/오류 처리
- 사용자명·프로필 이미지 수정, 약관, 로그아웃, 계정 삭제
- warm ivory/amber 디자인 토큰과 Pretendard 폰트

관리자와 웹 전용 운영 기능은 포함하지 않습니다. 모바일에서는 친구 검색·요청, 공개 프로필, 친구 컬렉션과 분석 열람을 지원합니다.

## 실행 설정

`.env.example`을 복사해 로컬 `.env`를 만들고 다음 값을 채웁니다.

```dotenv
API_BASE_URL=https://api.myanitrack.com/api
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
GOOGLE_IOS_CLIENT_ID=your-ios-client-id.apps.googleusercontent.com
```

기존 프로젝트를 위해 `SUPABASE_ANON_KEY`도 fallback으로 지원합니다. service role key는 앱에 포함하면 안 됩니다.

```powershell
flutter pub get
flutter run --dart-define-from-file=.env
```

## OAuth와 플랫폼

- Android application ID: `com.myanitrack.app`
- iOS bundle ID: `com.myanitrack.app`
- Google 로그인은 외부 브라우저 OAuth가 아닌 네이티브 `google_sign_in`과 Supabase `signInWithIdToken`을 사용합니다.
- Android는 Google Cloud OAuth Client에 `com.myanitrack.app`과 debug/release SHA를 등록해야 합니다.
- iOS는 `GOOGLE_IOS_CLIENT_ID`와 해당 reversed client ID URL Scheme을 `Info.plist`에 등록해야 합니다.

iOS 빌드와 실기기 Google 로그인 최종 검증은 macOS/Xcode 환경에서 진행합니다.

## 검증

```powershell
flutter analyze --no-pub
flutter test --no-pub
flutter build apk --debug --no-pub
```

DTO nullable 계약과 주요 소형 화면 로그인 동작은 `test/`에서 검증합니다.
