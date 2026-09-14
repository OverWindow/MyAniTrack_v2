# UI·반응형·접근성

## 공통 UI 원칙

페이지는 CSS custom property로 카드 배경, 본문·보조 텍스트, 포인트 색, 오류 색, 그림자와 radius를 공유한다. 목록은 skeleton → 콘텐츠/빈 상태 순으로 바뀌며 이전 요청의 stale 콘텐츠와 새 loading 상태를 구분한다.

컬렉션의 `CollectionViewSwitch`와 `SeriesCollectionGrid`는 내 페이지와 공개 사용자 페이지가 공유한다. 전환기는 `role="group"`, 각 버튼은 `aria-pressed`를 제공한다. 시리즈 구성 작품 링크는 제목·등록 상태를 title에 포함하고 대표 이미지가 없으면 텍스트 placeholder를 사용한다.

## 반응형

작품 grid는 넓은 화면에서 여러 열을 사용하고 1180px·760px 경계에서 열 수와 간격을 줄인다. 시리즈 grid는 데스크톱 3열, 중간 2열, 모바일 1열이며 카드 내부 대표 이미지와 설명 열을 유지한다. 모바일에서 컬렉션 전환기는 가용 폭을 채우고 필터는 줄바꿈된다.

전역 toast는 데스크톱에서 헤더 아래 우측 상단에 최대 390px 폭으로 배치한다. 모바일에서는 좌우 12px을 남긴 전체 폭으로 바뀌며 safe-area를 고려한다. toast viewport는 클릭을 통과시키고 실제 toast와 닫기 버튼만 pointer event를 받는다.

## 키보드와 스크린리더

- dialog와 작품 상세 오버레이는 `aria-modal`과 이름을 가진다.
- icon-only 버튼은 닫기·새로고침 등 동작을 설명하는 `aria-label`을 가진다.
- 선택 버튼은 `aria-pressed` 또는 tab의 `aria-selected`를 사용한다.
- 로딩·성공 상태는 필요한 위치에 `role="status"`를 사용한다.
- 오류 toast는 `role="alert"`이며 포커스를 강제로 이동하지 않는다.
- 이미지의 장식 여부에 따라 의미 있는 alt 또는 빈 alt를 사용한다.

## 움직임과 복구

toast 진입 애니메이션은 `prefers-reduced-motion: reduce`에서 제거한다. hover와 active 변형만으로 상태를 전달하지 않고 텍스트·색·`aria-pressed`를 함께 사용한다. 치명적 실패의 다시 시도 버튼은 현재 페이지를 새로 요청하며, 부분 목록의 추가 로딩 실패는 기존 항목을 유지해 사용자가 같은 버튼을 다시 누를 수 있게 한다.

## 점검 기준

새 컴포넌트는 좁은 화면에서 가로 스크롤을 만들지 않아야 하며 키보드만으로 전환·검색·필터·닫기·재시도를 수행할 수 있어야 한다. 오류 원문이 본문에 중복 노출되지 않고 동일 오류 toast가 동시에 하나만 존재하는지도 함께 확인한다.
