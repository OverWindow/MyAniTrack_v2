# 컬렉션과 시리즈

## 작품 기록

로그인 사용자의 `/collection`은 작품별·시리즈별 보기 방식을 제공한다. 작품 기록은 `planned`, `watching`, `completed`, `paused`, `dropped` 상태와 10점 평점, 진행 화수, 시작·완료일, 메모를 가진다. `CollectionEditor`는 기존 기록 조회, 추가, 수정, 삭제를 담당하고 변경 후 메모리·localStorage 캐시를 동기화한다.

작품별 목록은 최근 수정·추가·평점 정렬과 장르 필터를 서버에 전달한다. 제목 검색은 현재 불러온 작품의 한국어·영어·원어·로마자·선호 제목을 합친 문자열에서 수행한다. IntersectionObserver와 cursor로 다음 페이지를 가져오며 작품 ID를 기준으로 중복을 제거한다.

비로그인 사용자는 실제 계정 데이터 대신 샘플 컬렉션과 샘플 최애 캐러셀을 본다. 샘플 데이터는 기록 편집을 허용하지 않고 가입·로그인으로 연결한다.

## 시리즈 컬렉션

공통 전환기는 탐색과 같은 `Film`·`Layers3` 아이콘을 사용한다. 시리즈 보기의 요청 값은 다음과 같다.

- `scope=mainline`: 본편 진행과 완주에 집중한 시리즈
- `scope=franchise`: 관련 작품 전체 프랜차이즈
- `status=all|started|watched|completed`
- `query`: 시리즈명 또는 구성 작품 제목
- `titleLanguage=ko|en|ja`

시리즈 카드는 대표 이미지, 완주율, 필수 작품 완주 수, 컬렉션 작품 수와 전체 구성 작품 스트립을 보여준다. 스트립에서 대상 사용자의 기록이 있는 작품만 강조한다. 완주율은 `completedRequiredMemberCount / requiredMemberCount`이며 음악·요약·미방영 등 완주 제외 작품은 필수 수에서 빠진다.

내 시리즈 목록은 모든 cursor 페이지를 최대 50개 단위로 결합한 뒤 scope/status/query/언어와 로그인 사용자 ID가 포함된 localStorage 키에 완결된 결과만 저장한다. 컬렉션을 변경하면 시리즈 캐시를 비운다.

## 공개 사용자 컬렉션

`/users/:userId/anime-list`는 작품별 보기와 동일한 시리즈 UX를 제공한다. 작품 목록은 기존 공개 API를, 시리즈 목록은 다음 API를 사용한다.

`GET /api/users/:userId/anime-list/series`

시리즈 검색어는 550ms debounce된다. 첫 페이지의 `user`로 헤더 소유자를 갱신하고 모든 cursor를 순서대로 불러온다. 반복 cursor를 중단하고 `seriesId`를 중복 제거하며 AbortController와 요청 키로 빠른 사용자·필터 전환의 오래된 응답을 버린다. 공개 결과는 내 컬렉션 localStorage 캐시와 공유하지 않는다.

## 스마트 평점과 최애 캐러셀

스마트 평점은 이미 평가한 유사 후보와 목표 작품의 상대 관계를 입력받아 추정 점수를 계산한다. 최애 캐러셀은 10점 작품을 별도 요청해 3D 배치와 드래그·스크롤 탐색을 제공한다. 공개 사용자 페이지에서는 대상 사용자의 10점 작품을 사용한다.
