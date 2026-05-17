# Storage Cache 정리

이 문서는 프론트엔드에서 `localStorage`와 `sessionStorage`에 저장하는 데이터, 저장 시점, 갱신 시점을 정리합니다.

## localStorage

### `myanitrack.auth.session`

저장 내용:
- 로그인 사용자 정보 `user`
- access token 만료 기준 시각 `accessTokenExpiresAt`
- refresh token은 저장하지 않습니다. 백엔드가 내려주는 HttpOnly Cookie에만 보관됩니다.
- access token은 localStorage에 저장하지 않고 프론트 런타임 메모리에만 보관합니다.

저장/수정 시점:
- 로그인 성공 시 저장합니다.
- 토큰 refresh 성공 시 access token은 메모리에 올리고, localStorage에는 사용자 정보와 만료 기준만 갱신합니다.
- `/api/auth/me`로 사용자 정보를 다시 가져오면 저장된 `user`를 갱신합니다.
- 프로필 수정 등으로 사용자 정보가 바뀌면 저장된 `user`를 갱신합니다.

삭제 시점:
- 현재 기기 로그아웃
- 전체 기기 로그아웃
- refresh 실패 또는 세션 만료 처리
- 저장된 JSON 파싱 실패

### `myanitrack.pending.agreements`

저장 내용:
- 회원가입/인증 흐름 중 임시로 보관하는 약관 동의 payload
- 이메일과 약관 동의 값

저장/수정 시점:
- 이메일 인증 전 약관 동의 상태를 임시 보관해야 할 때 저장합니다.

삭제 시점:
- 같은 이메일로 약관 정보를 소비하면 삭제합니다.
- 저장된 JSON 파싱 실패 시 삭제합니다.

### `myanitrack.collection.cache:{userId}`

저장 내용:
- 애니별 내 컬렉션 상태의 가벼운 캐시
- key: `animeId`
- value: `status`, `score`, `progress`, `startedAt`, `completedAt`, `notes`

저장/수정 시점:
- 애니를 컬렉션에 추가할 때 갱신합니다.
- 컬렉션 항목을 수정할 때 갱신합니다.
- 애니 상세 페이지에서 내 컬렉션 단건을 가져올 때 갱신합니다.
- 컬렉션 목록을 API로 가져올 때 응답 항목을 반영합니다.
- 로그인 탐색 검색 `/api/me/anime/search` 응답의 `myCollection`을 반영합니다.

삭제 시점:
- 컬렉션에서 애니를 삭제하면 해당 `animeId` 항목을 삭제합니다.
- 탐색 검색 응답에서 `myCollection.exists === false`인데 캐시에 있으면 삭제합니다.
- 저장된 JSON 파싱 실패 시 전체 캐시를 삭제합니다.

관련 이벤트:
- 캐시가 바뀌면 `myanitrack:collection-cache-updated` 이벤트를 dispatch합니다.

### `myanitrack.collection.page-cache:{userId}:{sort}:{genre}`

저장 내용:
- 컬렉션 페이지에 표시할 전체 목록 응답
- `items`, `pageInfo`, `success`
- 정렬과 장르 조합별로 따로 저장합니다.

저장/수정 시점:
- 컬렉션 페이지에서 처음 API로 목록을 가져올 때 저장합니다.
- 컬렉션 페이지에서 무한 스크롤로 추가 페이지를 가져오면 기존 목록과 합쳐 저장합니다.
- 컬렉션 페이지의 reload 버튼을 눌러 API로 다시 불러오면 갱신합니다.

읽는 시점:
- 컬렉션 페이지 진입 시 같은 `sort`/`genre` 캐시가 있으면 API 대신 이 값을 사용합니다.

삭제 시점:
- 저장된 JSON 파싱 실패 시 해당 조합의 캐시를 삭제합니다.

주의:
- 컬렉션 항목 단건 추가/수정/삭제는 `myanitrack.collection.cache:{userId}`를 갱신하지만, 페이지 목록 캐시 전체를 자동 재구성하지는 않습니다.
- 컬렉션 페이지의 reload 버튼을 누르면 서버 기준으로 page cache를 다시 맞춥니다.

### `myanitrack.local.settings`

저장 내용:
- 로컬 설정
- `themeMode`, `motionMode`, `cardDensity`, `appLanguage`, `titleLanguage`

저장/수정 시점:
- 설정 페이지에서 로컬 설정 state가 바뀔 때마다 저장합니다.

읽는 시점:
- 설정 페이지 초기 진입 시 읽습니다.

삭제 시점:
- 현재 코드에서 명시 삭제는 없습니다.
- 파싱 실패 시 기본값을 사용하지만, 기존 값을 삭제하지는 않습니다.

## sessionStorage

### `myanitrack.friends.session-cache:{userId}`

저장 내용:
- 친구 페이지 데이터 묶음
- `friends`
- 받은 요청 `incoming`
- 보낸 요청 `outgoing`

저장/수정 시점:
- 친구 페이지에서 처음 API로 친구 목록과 요청 목록을 가져오면 저장합니다.
- 친구 요청 보내기 후 API로 다시 불러와 갱신합니다.
- 친구 요청 수락/거절/취소 후 API로 다시 불러와 갱신합니다.
- 친구 삭제 후 API로 다시 불러와 갱신합니다.

읽는 시점:
- 같은 브라우저 세션에서 친구 페이지에 다시 들어오면 API 대신 이 값을 먼저 사용합니다.

삭제 시점:
- 브라우저 탭/세션이 끝나면 브라우저가 삭제합니다.
- 저장된 JSON 파싱 실패 시 해당 캐시를 삭제합니다.

### `myanitrack:explore-view-state`

저장 내용:
- 탐색 페이지 화면 복원용 snapshot
- 정렬, 장르, 검색어, 검색 언어, 목록 아이템, 다음 cursor, 스크롤 위치 등

저장/수정 시점:
- `saveExploreViewSnapshot` 호출 시 저장합니다.

읽는 시점:
- `loadExploreViewSnapshot` 호출 시 읽습니다.

현재 상태:
- 이전 스크롤 복원 방식에서 쓰던 유틸입니다.
- 현재 탐색/상세 overlay 구조에서는 페이지 unmount를 피하는 방식으로 바뀌어, 실제 페이지에서 사용하지 않을 수 있습니다.

### `myanitrack:collection-view-state`

저장 내용:
- 컬렉션 페이지 화면 복원용 snapshot
- 정렬, 장르, 검색어, 목록 아이템, 다음 cursor, 스크롤 위치 등

저장/수정 시점:
- `saveCollectionViewSnapshot` 호출 시 저장합니다.

읽는 시점:
- `loadCollectionViewSnapshot` 호출 시 읽습니다.

현재 상태:
- 이전 스크롤 복원 방식에서 쓰던 유틸입니다.
- 현재 컬렉션/상세 overlay 구조에서는 페이지 unmount를 피하는 방식으로 바뀌어, 실제 페이지에서 사용하지 않을 수 있습니다.

## 요약

`localStorage`는 브라우저를 닫아도 유지되어야 하는 인증 세션, 컬렉션 캐시, 설정에 사용합니다.

`sessionStorage`는 현재 탭 세션 동안만 유지하면 되는 친구 목록 캐시와 화면 복원 snapshot에 사용합니다.

데이터가 서버와 달라질 수 있는 컬렉션 목록과 친구 목록은 각각 reload 또는 관계 변경 액션 이후 API로 다시 불러와 캐시를 갱신합니다.
