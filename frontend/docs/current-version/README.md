# MyAniTrack 웹 프론트 현행 기능 문서

- 기준일: 2026-08-21
- 대상: `frontend` React 웹 앱과 화면에서 직접 사용하는 API
- 원칙: 이 문서는 변경 후 코드의 사용자 흐름, 상태, 데이터 이동, 캐시, 권한과 실패 처리를 설명한다.

## 실행 구조

Vite가 `src/main.tsx`를 시작점으로 React 앱을 마운트한다. Provider 순서는 `BrowserRouter → ToastProvider → AuthProvider → FriendsProvider → App`이며, 라우팅되는 모든 페이지가 인증·친구·전역 오류 알림을 공유한다. API 주소는 `VITE_API_BASE_URL`에서 읽고 인증 요청은 공통 `authFetch`를 통과한다.

## 문서 색인

1. [앱 셸과 라우팅](./01-app-shell-routing.md)
2. [인증과 계정](./02-auth-account.md)
3. [탐색과 작품 상세](./03-explore-anime.md)
4. [컬렉션과 시리즈](./04-collection-series.md)
5. [친구와 공개 페이지](./05-social-public-pages.md)
6. [분석과 추천](./06-analysis-recommendation.md)
7. [관리자와 콘텐츠 안전](./07-admin-content-safety.md)
8. [데이터·캐시·오류 처리](./08-data-cache-errors.md)
9. [UI·반응형·접근성](./09-ui-accessibility.md)

## 주요 라우트

| 영역 | 라우트 |
| --- | --- |
| 홈·탐색 | `/`, `/explore`, `/anime/:id`, `/voice-actors/:voiceActorId` |
| 인증 | `/login`, `/signup`, `/auth/callback`, `/verify-email/*`, `/password-reset*` |
| 내 정보 | `/profile`, `/profile/edit`, `/collection`, `/analysis`, `/friends`, `/settings` |
| 공개 사용자 | `/users/:userId/profile`, `/users/:userId/anime-list`, `/users/:userId/anime-stats` |
| 운영 | `/admin`, `/privacy`, `/account-deletion` |

존재하지 않는 라우트는 홈으로 교체 이동한다. 작품 상세는 일반 페이지로 열거나 현재 목록을 배경으로 유지하는 오버레이로 열 수 있다.
