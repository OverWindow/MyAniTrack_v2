# Google Play 정책 URL 프론트엔드 구현 핸드오프

마지막 작성일: 2026-07-20  
대상 웹 프로젝트: `../frontend`  
대상 앱: 마이애니트랙 (`com.myanitrack.app`)

## 1. 목표

Google Play 제출에 사용할 아래 두 공개 URL을 웹에 구현한다.

- 개인정보처리방침: `https://myanitrack.com/privacy`
- 계정 및 데이터 삭제: `https://myanitrack.com/account-deletion`

운영 웹 도메인이 `myanitrack.com`이 아니라면 실제 도메인으로 바꾼다. 두 URL은 로그인하지 않은 시크릿 창에서도 직접 열려야 하며, 모바일과 데스크톱에서 모두 읽을 수 있어야 한다.

Google Play의 계정 삭제 요구사항은 다음 두 경로를 모두 요구한다.

1. 앱 내부의 계정 삭제 경로
2. 앱을 설치하지 않아도 접근 가능한 웹 계정 삭제 요청 경로

모바일의 앱 내부 삭제는 이미 구현되어 있으므로, 이번 프론트 작업은 공개 웹 경로를 완성하는 것이 핵심이다.

공식 참고:

- 개인정보처리방침 및 앱 심사 정보: <https://support.google.com/googleplay/android-developer/answer/9859455>
- 계정 삭제 요구사항: <https://support.google.com/googleplay/android-developer/answer/13327111>
- 데이터 보안 양식: <https://support.google.com/googleplay/android-developer/answer/10787469>

## 2. 현재 웹·API 구조

### 웹

- React 19 + React Router
- 라우트 선언: `frontend/src/App.tsx`
- 약관 초안: `frontend/src/content/agreements.ts`
- 로그인 상태 및 계정 삭제: `frontend/src/contexts/AuthContext.tsx`
- 계정 삭제 API 함수: `frontend/src/lib/auth.ts`
- 기존 로그인 사용자 삭제 UI: `frontend/src/pages/SettingsPage.tsx`
- Vercel SPA rewrite가 설정되어 있어 새 공개 라우트의 직접 접근을 지원할 수 있음

### 기존 계정 삭제 API

```http
DELETE /api/auth/me
Authorization: Bearer <Supabase access token>
```

쿠키 기반 세션을 함께 사용하는 환경에서는 기존 `authFetch`가 `credentials: include`와 토큰 갱신을 처리한다. 새 fetch 래퍼를 만들지 말고 기존 `deleteMyAccount()`를 재사용한다.

성공 예시:

```json
{
  "success": true,
  "message": "Account deleted successfully",
  "deleted": true,
  "userId": 123,
  "email": "user@example.com"
}
```

주요 오류:

- `401 Unauthorized`: 로그인 만료 또는 인증 없음
- `404 User not found`: 이미 삭제되었거나 연결된 앱 사용자가 없음
- `5xx`: Supabase Auth, DB 또는 서버 오류

서버의 현재 삭제 순서는 다음과 같다.

1. 앱 사용자 조회
2. 연결된 Supabase Auth 사용자 삭제
3. `users` 행 삭제
4. 프로필 이미지 삭제 요청
5. refresh token cookie 제거

외래 키로 연결된 컬렉션, 친구 관계, 동의 기록 등 사용자 데이터가 실제 운영 DB에서 함께 삭제되는지는 출시 전에 별도로 검증해야 한다.

## 3. 추가할 파일과 라우트

권장 파일:

```text
frontend/src/pages/PrivacyPolicyPage.tsx
frontend/src/pages/AccountDeletionPage.tsx
frontend/src/content/privacyPolicy.ts
frontend/src/styles/policy-pages.css
```

`frontend/src/App.tsx`에 공개 라우트를 추가한다.

```tsx
import { AccountDeletionPage } from './pages/AccountDeletionPage'
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage'

// Routes 내부
<Route path="/privacy" element={<PrivacyPolicyPage />} />
<Route path="/account-deletion" element={<AccountDeletionPage />} />
```

두 페이지는 인증 여부와 무관하게 렌더링되어야 한다. 인증 로딩이나 사용자 API 실패 때문에 정책 본문이 가려지면 안 된다.

친구 플로팅 버튼은 정책 페이지에서 숨기는 것을 권장한다.

```tsx
const isPolicyRoute = ['/privacy', '/account-deletion'].includes(location.pathname)
const shouldShowFloatingCta =
  !backgroundLocation &&
  !isPolicyRoute &&
  !['/login', '/signup'].includes(location.pathname)
```

## 4. 공통 페이지 요구사항

두 페이지 모두 다음을 충족한다.

- 비로그인 직접 접근 가능
- URL 새로고침 시 HTTP 200과 정상 화면 제공
- 앱 이름 `마이애니트랙`과 운영 주체 표시
- 문의 이메일 또는 문의 폼 링크 표시
- 시행일과 문서 버전 표시
- 서로를 오가는 링크 제공
- 로그인, 회원가입, 설정 화면에서 쉽게 접근 가능
- 모바일 360px 너비에서 가로 스크롤이 생기지 않음
- 제목 계층을 `h1 → h2 → h3` 순서로 사용
- 링크와 버튼에 키보드 포커스 표시
- 본문 색상 대비와 글자 크기 준수
- `document.title`과 meta description 설정
- 삭제 페이지에 `noindex`를 적용할지는 선택 사항이지만 `robots.txt`로 접근을 막으면 안 됨

권장 제목:

```text
개인정보처리방침 | 마이애니트랙
계정 및 데이터 삭제 | 마이애니트랙
```

정책 URL은 로그인 모달이나 일시적인 팝업이 아니라 독립 페이지여야 한다.

## 5. 개인정보처리방침 페이지

### 5.1 페이지 상단

다음 정보를 바로 확인할 수 있게 한다.

- 제목: `마이애니트랙 개인정보처리방침`
- 적용 대상: 웹 및 모바일 앱
- 문서 버전: 예: `v1.0`
- 시행일: 실제 출시일
- 최종 변경일
- 개인정보 관련 문의 이메일
- 계정 삭제 페이지 링크

### 5.2 필수 본문 구조

아래 내용을 실제 운영 상황에 맞게 확정해서 작성한다. 대괄호 항목은 출시 전에 운영자가 반드시 채워야 한다.

#### 1) 개인정보처리자

- 서비스명: 마이애니트랙
- 운영자 또는 법인명: `[운영자 입력]`
- 개인정보 문의 이메일: `[운영 이메일 입력]`
- 사업장 주소 또는 법적으로 필요한 사업자 정보: `[해당 시 입력]`

#### 2) 수집하는 정보

앱의 실제 처리 기준으로 최소 다음 항목을 검토한다.

- 계정 정보
  - Google/Supabase 계정 이메일
  - Supabase 사용자 식별자
  - 앱 내부 사용자 ID
- 프로필 정보
  - 사용자명
  - 소개
  - 사용자가 올린 프로필 이미지
- 서비스 이용 정보
  - 애니메이션 컬렉션
  - 감상 상태, 진도, 점수, 날짜, 메모
  - 최애 작품과 배지 진행 상태
  - 친구 관계와 친구 요청
  - 분석 결과를 만들기 위한 파생 통계
- 동의 기록
  - 약관 및 개인정보처리방침 동의 여부, 버전, 시각
- 보안·운영 정보
  - 로그인 세션과 refresh token
  - 서버가 실제로 보관하는 접속 로그, IP, 오류 로그가 있다면 그 항목과 기간

앱은 Google 로그인을 사용하므로, 실제로 비밀번호를 자체 DB에 저장하지 않는다면 기존 문구의 `비밀번호(암호화 저장)` 표현은 제거한다.

#### 3) 수집 및 이용 목적

- 회원 식별과 로그인
- 컬렉션, 평점, 진도 저장
- 개인 통계, 추천, Viewing DNA 및 랭킹 제공
- 친구 검색, 요청, 공개 프로필 및 공개 컬렉션 제공
- 프로필 이미지 제공
- 고객 문의와 장애 대응
- 부정 이용 방지와 보안

#### 4) 공개 범위

다음 항목이 다른 사용자에게 노출될 수 있음을 분명히 설명한다.

- 사용자명, 소개, 프로필 이미지
- 친구 상태
- 공개 컬렉션과 점수
- 배지와 최애 작품
- 사용자 기록을 기반으로 한 공개 분석

실제 공개/비공개 설정 기능이 없다면 사용자가 공개 범위를 선택할 수 있다고 쓰면 안 된다.

#### 5) 보관 및 파기

- 원칙적으로 계정 삭제 시 계정과 연결된 개인정보를 삭제
- 법적 의무, 보안, 분쟁 처리 때문에 일부 데이터를 보관한다면 정확한 항목, 근거, 기간을 명시
- 운영 백업에서 삭제 데이터가 사라지는 최대 기간: `[운영 백업 정책 입력]`
- 서버 로그 보관 기간: `[운영 로그 정책 입력]`
- 프로필 이미지 저장소 삭제 방식과 최대 처리 시간

`즉시 모두 삭제`처럼 실제 시스템이 보장하지 못하는 문구는 사용하지 않는다.

#### 6) 처리 위탁 및 국외 이전

실제로 사용하는 공급자를 확인한 후 표로 작성한다.

```text
공급자 | 처리 목적 | 처리 항목 | 처리 국가/지역 | 보관 기간
Google | Google 로그인 | 이메일, 계정 식별 정보 | [확인] | 공급자 정책 및 서비스 이용 기간
Supabase | 인증·세션·프로필 이미지 저장 | 계정 식별자, 토큰, 프로필 이미지 | [프로젝트 리전 확인] | 계정 삭제 또는 계약 종료 시까지
[웹 호스팅사] | 웹 서비스 제공 | 접속 로그 등 | [확인] | [확인]
[백엔드/DB 호스팅사] | API와 DB 운영 | 서비스 데이터 | [확인] | [확인]
```

공급자명과 리전은 추측해서 공개하지 말고 운영 콘솔에서 확인한다.

AniList 등 애니 정보 공급자에게 사용자 개인정보를 전송하지 않는다면 개인정보 처리 위탁 목록이 아니라 `외부 콘텐츠 출처` 항목으로 구분한다.

#### 7) 제3자 제공

- 실제 제3자 제공 여부
- 제공하는 경우 수신자, 항목, 목적, 기간
- 서비스 제공을 위한 처리 위탁과 법률상 제3자 제공을 혼동하지 않음

#### 8) 이용자의 권리

- 프로필에서 정보 조회·수정
- 앱 또는 웹에서 계정 삭제
- 개인정보 관련 문의
- 동의 철회가 서비스 이용에 미치는 영향

계정 삭제 URL을 명시한다.

```text
https://myanitrack.com/account-deletion
```

#### 9) 보안 조치

- HTTPS 전송
- 인증 토큰 기반 보호 API
- 접근 권한 제한
- 비밀키를 클라이언트에 포함하지 않음
- 보안 로그 및 사고 대응 절차

실제로 적용하지 않은 암호화나 인증 제도를 적용한다고 주장하지 않는다.

#### 10) 아동의 개인정보

Play Console의 실제 대상 연령 선택과 일치하도록 작성한다. 아동 대상 서비스가 아니라면 그 사실과 발견 시 처리 절차를 명시한다.

#### 11) 정책 변경

- 변경 공지 방법
- 중대한 변경 시 사전 안내 여부
- 과거 버전 확인 방법

### 5.3 기존 약관 데이터 정리

`frontend/src/content/agreements.ts`의 개인정보 문구는 회원가입 동의용 요약으로 유지할 수 있지만, 공개 `/privacy` 문서와 내용이 충돌하면 안 된다.

권장 구조:

- 공개 정책의 단일 원본을 `privacyPolicy.ts`에 둔다.
- 회원가입과 설정 화면도 같은 원본 또는 같은 버전 상수를 참조한다.
- `AGREEMENT_VERSION`과 공개 정책 버전을 동일하게 관리한다.

정책이 변경되어 재동의가 필요한 경우 서버의 동의 버전 정책도 함께 갱신한다.

## 6. 계정 및 데이터 삭제 페이지

### 6.1 비로그인 상태

로그인하지 않아도 다음 정보를 읽을 수 있어야 한다.

- 삭제 대상 서비스가 `마이애니트랙`임을 명시
- 삭제되는 데이터 종류
- 삭제 후 복구할 수 없다는 경고
- 실제 삭제 절차
- 삭제되지 않고 보관될 수 있는 데이터와 기간이 있다면 설명
- `로그인하여 계정 삭제` 버튼
- 로그인할 수 없는 사용자를 위한 문의 이메일 또는 검증 가능한 삭제 요청 폼
- 개인정보처리방침 링크

권장 동작:

```text
로그인하여 계정 삭제
→ /login?returnTo=%2Faccount-deletion
→ 로그인 성공
→ /account-deletion 복귀
```

현재 로그인 흐름이 `returnTo`를 지원하지 않으면 React Router의 location state 또는 제한된 내부 경로만 허용하는 query parameter로 구현한다. 외부 URL로 리다이렉트할 수 없도록 open redirect를 방지한다.

문의 이메일 fallback 예시:

```text
로그인할 수 없다면 [운영 이메일]로 가입 이메일과 함께 삭제 요청을 보내주세요.
계정 소유 확인 후 삭제를 진행합니다.
```

이메일만으로 삭제할 때는 요청자의 계정 소유 확인 절차가 반드시 필요하다. 인증되지 않은 이메일 주소만으로 계정을 삭제하면 안 된다.

### 6.2 로그인 상태

로그인 사용자는 웹에서 실제 삭제를 끝까지 완료할 수 있어야 한다.

표시 항목:

- 현재 로그인한 사용자명
- 마스킹한 이메일
- 삭제 데이터 목록
- 복구 불가 경고
- 확인 입력 필드
- `계정 영구 삭제` 버튼

확인 입력 권장값:

```text
계정 삭제
```

입력값이 정확히 일치하기 전에는 최종 버튼을 비활성화한다.

삭제 전 확인 모달에는 다음 내용을 표시한다.

- 컬렉션, 평점, 분석, 프로필, 친구 관계가 삭제됨
- 삭제 후 복구할 수 없음
- 다른 기기의 세션도 더 이상 사용할 수 없음

### 6.3 삭제 요청 상태

다음 상태를 분리한다.

```ts
type DeletionState =
  | 'idle'
  | 'confirming'
  | 'submitting'
  | 'success'
  | 'error'
```

- `submitting`: 버튼 비활성화, 중복 호출 금지
- `success`: 성공 화면으로 전환하고 뒤로가기로 보호 화면에 복귀하지 않게 `replace` 사용
- `error`: 오류 메시지와 재시도 제공
- `401`: 로그인 만료 안내 후 로그인 경로 제공
- `404`: 서버 응답을 확인해 이미 삭제된 계정이면 성공과 동일하게 처리할지 제품 정책 결정
- 네트워크 오류: 계정 삭제 완료 여부를 단정하지 말고 재로그인 또는 지원 문의 안내

성공 화면에는 API가 반환한 이메일이나 사용자 ID를 그대로 표시하지 않는다.

### 6.4 인증 컨텍스트 수정 필수

현재 `AuthContext.tsx`는 삭제 API가 실패해도 `finally`에서 로컬 세션과 Supabase 세션을 제거한다.

현재 형태:

```tsx
async deleteAccount() {
  try {
    await deleteMyAccount()
  } finally {
    await logoutSupabaseSession().catch(() => {})
    clearStoredSession()
    setUser(null)
  }
}
```

이 구조에서는 서버 삭제 실패 후 사용자가 로그아웃되어 즉시 재시도하기 어렵다. 삭제 성공 후에만 로컬 세션을 제거하도록 바꾼다.

권장 형태:

```tsx
async deleteAccount() {
  await deleteMyAccount()
  await logoutSupabaseSession().catch(() => {})
  clearStoredSession()
  setUser(null)
}
```

API가 성공했지만 로컬 Supabase 로그아웃이 실패한 경우에도 로컬 세션은 반드시 지운다. 이를 명확히 하려면 다음 구조도 가능하다.

```tsx
async deleteAccount() {
  await deleteMyAccount()

  try {
    await logoutSupabaseSession()
  } finally {
    clearStoredSession()
    setUser(null)
  }
}
```

중요한 기준은 `deleteMyAccount()` 실패 시에는 세션을 유지하고, 성공 시에는 로컬 정리를 반드시 수행하는 것이다.

### 6.5 컴포넌트 의사 코드

```tsx
export function AccountDeletionPage() {
  const navigate = useNavigate()
  const { isAuthenticated, user, deleteAccount } = useAuth()
  const [confirmation, setConfirmation] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    if (confirmation !== '계정 삭제' || isSubmitting) return

    setIsSubmitting(true)
    setError(null)

    try {
      await deleteAccount()
      navigate('/account-deletion?status=deleted', { replace: true })
    } catch (requestError) {
      setError(toUserFacingDeletionError(requestError))
      setIsSubmitting(false)
    }
  }

  if (!isAuthenticated) {
    return <LoggedOutDeletionGuide />
  }

  return (
    <main>
      <h1>마이애니트랙 계정 및 데이터 삭제</h1>
      <p>{user?.username} 계정의 모든 기록을 삭제합니다.</p>
      <DeletionDataList />
      <label htmlFor="delete-confirmation">계속하려면 “계정 삭제”를 입력하세요.</label>
      <input
        id="delete-confirmation"
        value={confirmation}
        onChange={(event) => setConfirmation(event.target.value)}
        autoComplete="off"
      />
      {error && <p role="alert">{error}</p>}
      <button
        type="button"
        disabled={confirmation !== '계정 삭제' || isSubmitting}
        onClick={handleDelete}
      >
        {isSubmitting ? '삭제하는 중…' : '계정 영구 삭제'}
      </button>
    </main>
  )
}
```

## 7. 앱과 웹의 링크 연결

웹 구현 완료 후 모바일의 약관·개인정보 화면에도 공개 URL 링크를 추가하는 것을 권장한다.

최소 링크 위치:

- 로그인 화면 하단 개인정보처리방침
- 회원가입 동의 화면
- 프로필 → 약관 및 개인정보
- 프로필 → 계정 삭제 안내

Google Play Console에는 아래 URL을 입력한다.

```text
Privacy policy URL:
https://myanitrack.com/privacy

Account deletion URL:
https://myanitrack.com/account-deletion
```

## 8. 스타일 요구사항

기존 마이애니트랙 디자인 토큰을 재사용한다.

- 페이지 배경: 기존 warm ivory 계열
- 본문 최대 폭: 약 `760px`
- 본문 좌우 여백: 모바일 `20px`, 데스크톱 `24~32px`
- 본문 줄 높이: `1.6~1.8`
- 섹션 간격: `32~48px`
- 위험 버튼: 기존 error/destructive 색상
- 정책 표는 작은 화면에서 행형 카드 또는 안전한 가로 스크롤 사용
- 장문의 문서이므로 상단 목차와 anchor navigation 제공 권장

정책 본문은 이미지나 PDF로만 제공하지 않고 HTML 텍스트로 렌더링한다.

## 9. 접근성·보안 요구사항

- 삭제 확인 모달에 `role="dialog"`, `aria-modal="true"`, 명확한 제목 연결
- 오류 메시지에 `role="alert"`
- 삭제 중 버튼 비활성화와 진행 상태 전달
- 색상만으로 위험 상태를 전달하지 않음
- 이메일은 화면에서 마스킹
- access token, refresh token, 내부 user ID를 DOM이나 로그에 노출하지 않음
- 삭제 요청 payload에 user ID나 이메일을 받지 않음
- 서버는 반드시 인증 토큰의 사용자만 삭제
- 외부 `returnTo` URL을 허용하지 않음
- 삭제 API 호출 결과를 analytics에 개인정보와 함께 기록하지 않음

## 10. 테스트 시나리오

### 공개 URL

- 로그아웃 시 `/privacy` 직접 접근
- 로그아웃 시 `/account-deletion` 직접 접근
- 각 URL에서 새로고침
- 시크릿 모드와 모바일 브라우저 접근
- 운영 URL이 200을 반환하고 인증 화면으로 강제 이동하지 않음
- 개인정보처리방침과 삭제 페이지가 서로 연결됨

### 계정 삭제

- 비로그인 사용자의 삭제 안내와 로그인 이동
- 로그인 후 원래 삭제 페이지 복귀
- 확인 문구 불일치 시 버튼 비활성화
- 중복 클릭 시 API 한 번만 호출
- 취소 시 데이터와 세션 유지
- 성공 시 서버 계정, Supabase Auth, 컬렉션, 친구 관계, 프로필 이미지 삭제 확인
- 성공 후 보호 페이지 접근 차단
- 성공 후 기존 access/refresh token 재사용 차단
- API 401, 404, 500, 네트워크 단절 오류 처리
- API 실패 시 기존 로그인 세션 유지 및 재시도 가능
- 삭제 후 동일 Google 계정 재가입 정책 확인

### 개인정보처리방침

- 인앱 동의 문서와 공개 문서 버전 일치
- 실제 수집 데이터와 문서 일치
- Supabase/Google/호스팅 공급자 및 리전 확인
- 운영자·문의처·시행일 placeholder가 남아 있지 않음
- Play Console 데이터 보안 양식과 문서 내용 일치

### 자동 검증 권장

```tsx
describe('public policy routes', () => {
  it('renders privacy policy without authentication')
  it('renders account deletion guidance without authentication')
  it('keeps the session when deletion API fails')
  it('clears the session after successful deletion')
  it('prevents duplicate deletion requests')
})
```

## 11. 완료 조건

다음 조건을 모두 만족해야 프론트 작업 완료로 본다.

- [ ] `/privacy`가 운영 환경에서 비로그인 접근 가능
- [ ] `/account-deletion`이 운영 환경에서 비로그인 접근 가능
- [ ] 개인정보처리방침의 모든 운영자 placeholder 제거
- [ ] 실제 공급자, 리전, 보관 기간 확인
- [ ] 로그인 사용자가 웹에서 계정을 끝까지 삭제 가능
- [ ] 로그인 불가 사용자를 위한 검증 가능한 삭제 요청 경로 제공
- [ ] 삭제 API 실패 시 세션 유지
- [ ] 삭제 API 성공 시 로컬/Supabase 세션 정리
- [ ] 설정·로그인·회원가입 화면에 공개 정책 링크 연결
- [ ] 직접 URL 새로고침과 Vercel 배포 확인
- [ ] 모바일 360px 및 데스크톱 레이아웃 확인
- [ ] 접근성 키보드 탐색 및 스크린리더 기본 검증
- [ ] Play Console의 Privacy policy URL과 Account deletion URL 입력
- [ ] Play Console 데이터 보안 양식과 문서 내용 대조

## 12. 출시 전 운영 확인

프론트 구현만으로 계정 삭제 정책 준수가 끝나는 것은 아니다. 출시 전에 다음 서버 동작을 운영 환경에서 확인한다.

- `DELETE /api/auth/me`가 Supabase Auth 사용자를 삭제하는지
- DB 외래 키 cascade가 사용자 관련 데이터를 빠짐없이 삭제하는지
- 프로필 이미지 삭제 실패를 재처리하거나 모니터링할 수 있는지
- 삭제된 refresh/access token이 다시 인증되지 않는지
- 백업과 로그에 남는 데이터의 보관 기간이 정책 문구와 일치하는지
- 고객지원 삭제 요청의 본인 확인 및 처리 기록 절차가 있는지

이 문서는 구현 명세이며 법률 자문을 대체하지 않는다. 공개 전 최종 개인정보처리방침은 실제 운영 주체와 데이터 흐름을 기준으로 검토해야 한다.
