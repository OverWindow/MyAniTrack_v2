# 데이터·캐시·오류 처리

## API 계층

`src/lib`의 도메인 모듈이 URL 구성, query parameter, 응답 타입과 HTTP 상태 메시지를 담당한다. `authFetch`는 저장 세션의 access token을 붙이고 만료 시 refresh 흐름을 거친다. 컴포넌트는 이 함수가 던진 `Error`를 `getFriendlyErrorMessage`로 네트워크 연결 메시지 또는 기능별 fallback으로 정규화한다.

요청 취소는 `AbortController`를 사용한다. `AbortError`는 사용자가 화면이나 필터를 바꾼 정상 흐름이므로 오류 state와 toast를 만들지 않는다. 목록 요청은 filter를 포함한 request key로 현재 응답인지 검증하고 cursor와 ID 집합으로 반복 페이지를 차단한다.

## 컬렉션 캐시

작품별 캐시는 anime ID를 key로 상태·점수·진행 화수와 날짜를 저장한다. 목록 페이지 캐시는 정렬·장르·연도·점수 조건을 포함한다. 탐색 결과에 `myCollection`이 포함되면 같은 캐시에 병합해 카드·상세·컬렉션 간 표시를 맞춘다.

시리즈 캐시는 사용자 ID, scope, status, title language, 정규화한 query를 key로 사용한다. 아직 다음 cursor가 남은 부분 결과는 캐시로 인정하지 않는다. 저장 공간이 부족하면 해당 사용자 시리즈 캐시를 비우고 한 번 다시 저장한다. 공개 사용자 시리즈는 대상 사용자 데이터가 인증 사용자 캐시에 섞이지 않도록 localStorage에 저장하지 않는다.

분석 캐시는 사용자와 분석 종류·정렬을 조합한 key를 사용한다. 명시적 분석 새로고침은 관련 prefix를 제거한다. 인증 로그아웃과 컬렉션 변경은 영향을 받는 캐시를 정리한다.

## 전역 오류 Toast

`ToastProvider`는 `{ id, message }` 형태의 error toast를 관리한다. `showError(message)`는 공백 문구를 버리고 현재 표시 중인 동일 문구를 중복 추가하지 않는다. 최신 3개만 유지하며 각 항목은 6초 후 사라지거나 닫기 버튼으로 제거된다.

`ErrorToast`는 error state/prop을 `useErrorToast`에 연결하는 렌더 없는 bridge다. hook은 마지막 문구를 기억해 같은 state의 재렌더와 Strict Mode effect 재실행이 반복 알림을 만들지 않게 한다. 오류가 null로 복구된 뒤 같은 문제가 다시 발생하면 새 toast를 허용한다.

치명적인 로드 실패는 `ConnectionErrorState`가 오류 원문을 toast로 전달하고 본문에는 이미지, 중립 문구, 다시 시도 버튼만 렌더링한다. 세부 위젯은 기존 데이터를 유지하고 중립적인 빈 상태를 보여준다. 입력 필드의 즉시 검증 힌트와 개발자용 `throw new Error`는 toast 전환 대상이 아니다.

## 오류와 정상 상태 구분

- 오류: HTTP 실패, 네트워크 연결 실패, 파싱 불가, 사용자 작업 거부
- 정상 빈 상태: 컬렉션 없음, 검색 결과 없음, 배지 없음, 분석 표본 없음
- 제어 흐름: AbortError, 인증 redirect, 샘플 모드 전환

오류만 `role="alert"` toast를 사용하고 성공·로딩·빈 상태는 `role="status"` 또는 일반 본문 안내를 사용한다.
