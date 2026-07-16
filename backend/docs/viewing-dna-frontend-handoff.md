# 감상 DNA 6각형 프런트 전달 문서

## API

내 분석:

```http
GET /api/me/anime-stats/viewing-dna
Authorization: Bearer <access-token>
```

공개 사용자 분석:

```http
GET /api/users/:userId/anime-stats/viewing-dna
```

내 분석 응답은 `{ success, item }`, 공개 사용자 응답은 `{ success, user, item }`입니다. 두 API의 `item` 구조는 같습니다.

## 프런트 준비 코드

- 타입: `frontend/src/types/stats.ts`
  - `ViewingDnaAxisKey`
  - `ViewingDnaAxis`
  - `ViewingDnaItem`
  - `ViewingDnaResponse`
- 요청 함수: `frontend/src/lib/stats.ts`
  - 내 분석: `fetchViewingDnaStats({ signal })`
  - 공개 사용자: `fetchViewingDnaStats({ userId, signal })`

## 차트 데이터

`item.axes`는 다음 순서로 반환되며 그대로 레이더 차트에 전달합니다.

1. `completion` — 작품 완주력
2. `seriesCompletion` — 시리즈 완주력
3. `genreExploration` — 장르 탐험도
4. `eraExploration` — 시대 탐험도
5. `ratingActivity` — 평가 적극성
6. `watchImmersion` — 시청 몰입도

모든 `score`는 0~100이며 차트 범위는 `item.scale`을 사용합니다.

```ts
const chartData = item.axes.map((axis) => ({
  key: axis.key,
  subject: axis.label,
  value: axis.score,
  fullMark: item.scale.max,
  available: axis.available,
  description: axis.description,
  raw: axis.raw,
}))
```

## UI 처리 규칙

- `available=false`: 값은 0으로 표시하되 툴팁에 `데이터가 아직 부족해요`를 표시합니다.
- `confidence=none|low`: 그래프 위에 표본 부족 안내를 표시합니다.
- `strongestAxis`: 가장 높은 사용 가능 축을 강조하는 문구에 사용합니다.
- `description`: 축 툴팁 설명으로 사용합니다.
- `raw`: 상세 근거 수치 표시용이며 축마다 키가 다릅니다.
- `methodologyVersion`: 프런트 캐시 키에 포함하는 것을 권장합니다.
- `calculatedAt`: API가 계산된 시각이며 기존 `user_anime_stats.updatedAt`과 다를 수 있습니다.

## 주의사항

- 시리즈 완주력은 `mainline` 시리즈 데이터 기준입니다.
- relation 변경 후 시리즈 재계산이 실행되기 전까지 시리즈 완주력은 이전 그룹 기준일 수 있습니다.
- 시청 몰입도는 절대 점수가 아니라 전체 통계 사용자 중 총 시청 시간 백분위입니다.
- 6개 축은 우열이 아니라 사용자의 감상 성향을 나타냅니다.
