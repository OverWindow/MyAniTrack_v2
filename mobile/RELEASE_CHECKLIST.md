# 마이애니트랙 모바일 출시 체크리스트

마지막 점검일: 2026-07-20  
대상: Android(Google Play) · iOS(App Store)  
앱 ID: `com.myanitrack.app`  
표시 이름: `마이애니트랙`

이 문서는 현재 저장소 설정을 기준으로 작성한 출시 전 확인 사항이다. 스토어 정책과 대상 API 요구사항은 바뀔 수 있으므로 제출 직전에 공식 문서를 다시 확인한다.

웹 개인정보처리방침 및 계정 삭제 URL 구현 명세는 `PLAY_STORE_POLICY_URL_FRONTEND_HANDOFF.md`를 따른다.

## 현재 출시 차단 항목

- [ ] **Android release 서명을 디버그 키에서 실제 업로드 키로 교체한다.** 현재 `android/app/build.gradle.kts`의 release 빌드가 `signingConfigs.getByName("debug")`를 사용한다. 이 상태로 스토어 출시용 파일을 만들면 안 된다.
- [ ] **Google Play App Signing의 SHA-1을 Google Cloud Android OAuth Client에 등록한다.** 현재 등록한 debug SHA-1만으로는 Play Store에서 설치한 앱의 로그인이 실패한다.
- [ ] **iOS OAuth Client ID와 reversed client ID URL Scheme을 설정한다.** 현재 `ios/Runner/Info.plist`에는 Google 로그인 URL Scheme이 없다.
- [ ] **iOS에 Sign in with Apple을 추가할지 심사 예외에 해당하는지 확인한다.** 독립 서비스가 Google 로그인을 기본 계정 로그인으로 사용하는 경우 App Store 심사 지침 4.8에 따라 동등한 로그인 선택지가 요구될 가능성이 높다. 현재 앱은 Google 전용 로그인이다.
- [ ] **앱 내부 약관·개인정보 처리방침을 실제 운영 문서로 교체하고 공개 URL을 준비한다.** 현재 문구는 간략한 인앱 초안이며 운영자 정보, 문의처, 처리 위탁/국외 이전, 보관·파기, 정책 시행일 등이 충분하지 않을 수 있다.
- [ ] **계정 삭제 API가 앱 DB뿐 아니라 Supabase Auth 사용자와 관련 파일까지 실제로 삭제하는지 운영 환경에서 검증한다.** 화면과 `DELETE /auth/me` 호출은 구현되어 있지만 서버 측 삭제 범위는 별도 확인이 필요하다.

## 1. 공통 버전과 빌드 환경

- [ ] `pubspec.yaml`의 `version`을 출시 버전으로 결정한다. 현재 값은 `0.1.0+1`이다.
- [ ] 같은 스토어에 새 빌드를 올릴 때마다 build number를 증가시킨다.
  - Android: `versionCode`가 이전 업로드보다 커야 한다.
  - iOS: `CFBundleVersion`이 이전 업로드보다 커야 한다.
- [ ] 출시 시 사용한 Flutter·Dart·Xcode·Android Gradle Plugin·Java 버전을 기록한다.
- [ ] 잠금 파일인 `pubspec.lock`을 포함하고, 의존성의 알려진 보안 문제와 라이선스를 확인한다.
- [ ] 앱 ID `com.myanitrack.app`은 최초 출시 후 바꾸지 않는다. 바꾸면 스토어와 OAuth에서 별도 앱으로 취급된다.
- [ ] 앱 이름, 아이콘, 스플래시, 저작권이 Android와 iOS에서 동일한 브랜드를 사용하도록 확인한다.
- [ ] 실제 지원 화면 크기와 한국어 긴 문자열, 큰 글자, 이미지 실패, 느린 네트워크, 빈 컬렉션을 확인한다.

권장 검증 명령:

```powershell
flutter pub get
flutter analyze --no-pub
flutter test --no-pub
```

## 2. 환경 변수와 비밀값

출시 빌드는 로컬 전용 `.env.production`을 사용한다. 이 저장소의 `.gitignore`는 `.env.*`를 제외하며 `.env.example`만 허용한다.

```dotenv
API_BASE_URL=https://api.myanitrack.com/api
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<publishable-key>
GOOGLE_WEB_CLIENT_ID=<web-client-id>.apps.googleusercontent.com
GOOGLE_IOS_CLIENT_ID=<ios-client-id>.apps.googleusercontent.com
```

- [ ] 모든 URL이 개발·로컬 서버가 아닌 운영 HTTPS 주소인지 확인한다.
- [ ] `SUPABASE_PUBLISHABLE_KEY`와 Google Client ID는 클라이언트 식별용 공개값이지만 운영/개발 프로젝트 값은 분리한다.
- [ ] 아래 값은 Flutter 앱, `.env.production`, Git 이력에 절대 넣지 않는다.
  - Supabase service role/secret key
  - Google OAuth Client Secret
  - 데이터베이스 비밀번호
  - Android keystore 파일과 비밀번호
  - App Store Connect/Google Play API 개인 키
- [ ] `--dart-define-from-file`의 값은 빌드 결과물에 포함될 수 있다고 간주한다. 비밀값 보호 수단으로 사용하지 않는다.
- [ ] 토큰, 이메일, 인증 헤더, 프로필 데이터가 운영 로그나 크래시 리포트에 기록되지 않는지 확인한다.

## 3. Google · Supabase 인증

현재 로그인 흐름은 다음과 같다.

```text
네이티브 Google 로그인
  → Google ID Token
  → Supabase signInWithIdToken
  → Supabase Access/Refresh Token
  → 자체 백엔드의 Supabase JWT 검증
  → 자체 사용자/프로필 연결
```

- [ ] Google Cloud, Supabase Google Provider, Android/iOS 앱이 모두 같은 운영 OAuth 구성을 사용한다.
- [ ] Supabase에는 기존 **Web OAuth Client ID와 Client Secret**을 유지한다.
- [ ] 앱의 `GOOGLE_WEB_CLIENT_ID`는 같은 Web Client ID이며 `serverClientId`로 사용한다.
- [ ] Google OAuth 동의 화면을 Production으로 전환하고 앱 이름, 지원 이메일, 홈페이지, 개인정보 처리방침, 서비스 약관 도메인을 검증한다.
- [ ] 필요한 범위만 요청한다. 현재 로그인 외에 Gmail/Drive 같은 추가 scope는 요청하지 않는다.
- [ ] 신규 사용자, 기존 사용자, 취소, 로그아웃 후 재로그인, 토큰 갱신, 401, 계정 삭제 후 재가입을 운영과 동일한 설정으로 시험한다.
- [ ] Google 설정 변경은 전파에 수분에서 수 시간이 걸릴 수 있으므로 제출 직전에 변경하지 않는다.

## 4. Android 출시

### 4.1 서명 키

- [ ] 안전한 위치에 Android 업로드 keystore를 생성한다. 저장소 안에는 두지 않는다.
- [ ] `key.properties` 또는 CI secret으로 alias와 비밀번호를 주입하고 release signing config가 업로드 키를 사용하도록 수정한다.
- [ ] keystore와 비밀번호를 암호화된 별도 장소에 백업한다. 업로드 키 분실 시 복구 절차가 필요하고, 앱 서명 키 정책은 더 엄격하다.
- [ ] Google Play App Signing을 활성화한다.
- [ ] 로컬 release APK/AAB를 설치할 때의 인증서와 Play 배포본의 인증서가 다를 수 있음을 고려한다.

인증서 확인 예시:

```powershell
keytool -list -v -keystore C:\secure\myanitrack-upload.jks -alias <alias>
```

### 4.2 Android Google OAuth

Google Cloud → Google Auth Platform → Clients에서 동일 패키지명에 인증서별 Android Client를 등록한다.

- [ ] 패키지명: `com.myanitrack.app`
- [ ] 개발용 debug SHA-1
- [ ] 로컬 release/업로드 키 SHA-1
- [ ] **Play Console → 설정 → 앱 무결성 → 앱 서명 키 인증서 SHA-1**

Play Store에서 내려받은 앱은 Play 앱 서명 키로 서명되므로 마지막 항목이 특히 중요하다. SHA-1이 서로 다르면 각각 별도 Android OAuth Client를 만든다. Android Client ID나 Client Secret을 Dart 코드에 추가할 필요는 없다.

### 4.3 Play Console

- [ ] 스토어 등록정보의 앱 이름, 짧은/긴 설명, 아이콘, 휴대전화 스크린샷, 문의 이메일, 개인정보 처리방침 URL을 준비한다.
- [ ] 앱 액세스 항목에 로그인 필요 여부와 심사자가 기능을 확인할 방법을 정확히 작성한다.
- [ ] 데이터 보안 양식에 이메일, 사용자 ID, 프로필 이미지, 컬렉션/평점, 진단 데이터의 수집·공유·암호화·삭제 여부를 실제 구현과 동일하게 신고한다.
- [ ] 콘텐츠 등급, 대상 연령층, 광고 포함 여부를 실제 동작대로 작성한다.
- [ ] 사진 선택은 프로필 이미지 선택 목적에만 사용하고 불필요한 광범위 사진 권한을 요청하지 않는다.
- [ ] Play Console의 pre-launch report와 내부 테스트 트랙에서 로그인, API, 계정 삭제를 확인한다.
- [ ] 제출일의 대상 API 요구사항을 확인한다. 2026-08-31부터 일반 모바일 신규 앱/업데이트에는 Android 16(API 36) 이상이 요구될 예정이다.
- [ ] native symbol/debug symbol, mapping 파일이 생성되는 구성이라면 Play Console에 함께 업로드한다.

출시 파일 생성:

```powershell
flutter build appbundle --release --dart-define-from-file=.env.production
```

생성된 `build/app/outputs/bundle/release/app-release.aab`의 서명, 버전, 패키지명을 확인한 후 내부 테스트 트랙부터 배포한다. APK가 아니라 AAB를 기본 출시 산출물로 사용한다.

## 5. iOS 출시

최종 작업과 검증에는 macOS, Xcode, Apple Developer Program 계정이 필요하다.

### 5.1 Apple 서명과 프로젝트

- [ ] Xcode의 Runner target에서 Team과 Signing을 설정한다.
- [ ] Bundle ID가 `com.myanitrack.app`인지 확인하고 App Store Connect에도 같은 ID로 앱을 생성한다.
- [ ] Distribution 인증서와 App Store provisioning profile이 Archive에 적용되는지 확인한다.
- [ ] iOS Deployment Target 13.0이 실제 지원 정책과 사용하는 SDK 요구사항에 맞는지 확인한다.
- [ ] iPhone 방향 설정에 현재 가로 방향이 포함되어 있다. 앱이 세로 전용이라면 `Info.plist`에서 landscape 지원을 제거한 뒤 전체 화면을 재검증한다.

### 5.2 iOS Google 로그인

- [ ] Google Cloud에서 application type `iOS` OAuth Client를 만든다.
- [ ] Bundle ID를 `com.myanitrack.app`으로 입력한다.
- [ ] 발급된 iOS Client ID를 `GOOGLE_IOS_CLIENT_ID`에 넣는다.
- [ ] `ios/Runner/Info.plist`의 `CFBundleURLTypes`에 reversed client ID를 등록한다.

예시 구조:

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleTypeRole</key>
    <string>Editor</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>com.googleusercontent.apps.발급받은-iOS-client-id-앞부분</string>
    </array>
  </dict>
</array>
```

Web Client ID를 뒤집는 것이 아니라 **iOS Client ID의 reversed client ID**를 사용한다.

### 5.3 App Store 심사와 개인정보

- [ ] Google 전용 로그인이 Apple 지침 4.8의 예외에 해당하지 않는다면 Sign in with Apple을 동등한 선택지로 구현한다.
- [ ] Sign in with Apple을 도입하면 Supabase의 Apple Provider, Apple Service/App ID, nonce 처리, 기존 Google 계정과의 중복 계정 정책도 함께 설계한다.
- [ ] 계정 생성이 가능하므로 앱 안에서 계정 삭제가 끝까지 작동해야 한다. 단순 이메일 접수만으로 끝내지 않는다.
- [ ] 개인정보 처리방침 URL을 App Store Connect와 앱 내부에서 쉽게 접근 가능하게 제공한다.
- [ ] App Privacy 답변을 이메일, 사용자명, 프로필 사진, 사용 기록, 진단 데이터의 실제 처리와 맞춘다.
- [ ] 사진 보관함 접근 문구가 실제 목적과 일치하는지 확인한다. 현재 문구는 `프로필 사진을 선택하기 위해 사진 보관함 접근이 필요합니다.`이다.
- [ ] 포함한 SDK의 Privacy Manifest와 Required Reason API 신고 상태를 Xcode Archive 검증 경고에서 확인한다.
- [ ] App Review Notes에 Google 로그인 절차, 주요 화면 위치, 계정 삭제 경로를 적고 심사자가 접근 가능한 방법을 제공한다.
- [ ] TestFlight 내부 테스트에서 실제 기기 로그인, 프로필 사진, 백그라운드/복귀, 세션 복원, 계정 삭제를 확인한다.

빌드 검증:

```bash
flutter analyze --no-pub
flutter test --no-pub
flutter build ios --release --no-codesign --dart-define-from-file=.env.production
```

그 다음 Xcode에서 `Runner.xcworkspace`를 열어 실제 배포 서명으로 Archive하고 Validate App을 통과시킨다.

## 6. 백엔드와 운영 환경

- [ ] 운영 API가 유효한 TLS 인증서를 사용하고 HTTP로 리다이렉트하지 않는지 확인한다.
- [ ] 백엔드가 Supabase JWT의 서명뿐 아니라 issuer, audience, 만료를 검증하는지 확인한다.
- [ ] `/auth/supabase`, `/auth/me`, `/me/agreements`, 컬렉션, 분석, 프로필 multipart API를 release 앱으로 점검한다.
- [ ] `DELETE /auth/me`가 컬렉션, 분석 원본 데이터, 프로필 이미지와 인증 사용자를 정책대로 삭제하고 재시도에도 안전한지 확인한다.
- [ ] 탈퇴 후 refresh token과 기존 access token이 더 이상 사용할 수 없는지 확인한다.
- [ ] 약관/개인정보 처리방침 버전과 서버의 동의 기록이 실제 공개 문서 버전과 일치하는지 확인한다.
- [ ] API timeout, 401/403, 409, 429, 5xx에서 사용자 메시지와 재시도가 정상인지 확인한다.
- [ ] 서버 시간대, DB 백업, 장애 알림, rate limit, 로그 보존 기간과 개인정보 마스킹 정책을 준비한다.
- [ ] 운영 DB 마이그레이션과 롤백 절차를 배포 전에 시험한다.

## 7. 최종 실기기 회귀 테스트

Android 내부 테스트와 iOS TestFlight에 올린 **스토어 서명 빌드**로 각각 확인한다.

- [ ] 신규 Google 계정 로그인과 기존 계정 로그인
- [ ] 앱 종료·재시작 후 세션 복원
- [ ] 필수 약관 게이트와 동의 저장
- [ ] 홈 프로필·최애 애니·배지 독립 로딩과 재시도
- [ ] 컬렉션 전체 개수, 검색, 필터, 정렬, 무한 스크롤
- [ ] 작품 검색, 추가, 수정, nullable 값 삭제, 중복 등록 오류
- [ ] 상세 이미지와 복수 일본어 성우 표시
- [ ] 분석 각 탭의 lazy load, 빈 데이터, 부분 장애
- [ ] 프로필 이미지 선택·변경·삭제
- [ ] 로그아웃 후 보호 API 접근 차단
- [ ] 계정 영구 삭제 후 데이터·세션 제거
- [ ] Wi-Fi/모바일 데이터 전환, 느린 네트워크, 오프라인 복구
- [ ] 작은 Android(360×800), iPhone(390×844), 큰 iPhone(430×932)
- [ ] 접근성 글자 크기, VoiceOver/TalkBack, 최소 44px 터치 영역

## 8. 배포 순서

1. 출시 차단 항목을 모두 해결한다.
2. 운영 백엔드와 OAuth 설정을 먼저 배포하고 staging에서 검증한다.
3. 정적 분석과 전체 테스트를 통과시킨다.
4. Android AAB와 iOS Archive를 동일 버전으로 생성한다.
5. Play 내부 테스트와 TestFlight 내부 테스트를 진행한다.
6. 스토어 서명 인증서 SHA로 Google 로그인을 다시 확인한다.
7. 스토어 개인정보/데이터 안전성 답변과 실제 앱 동작을 대조한다.
8. 단계적 출시를 사용하고 인증 실패율, 401/5xx, 크래시를 모니터링한다.
9. 문제 발생 시 되돌릴 서버 버전과 이전 앱 버전을 보존한다.

## 공식 참고 문서

- [Flutter Android 출시 가이드](https://docs.flutter.dev/deployment/android)
- [Flutter iOS 출시 가이드](https://docs.flutter.dev/deployment/ios)
- [Google OAuth Client 관리](https://support.google.com/cloud/answer/15549257)
- [Google Play 대상 API 요구사항](https://support.google.com/googleplay/android-developer/answer/11926878)
- [Google Play 앱 생성 및 App Signing](https://support.google.com/googleplay/android-developer/answer/9859152)
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)

