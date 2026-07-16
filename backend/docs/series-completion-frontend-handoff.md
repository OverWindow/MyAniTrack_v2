# 시리즈 완주 기준 프런트 전달 사항

## 변경 목적

시리즈 구성 작품은 그대로 보여주되, 시리즈 완주에 필수적이지 않거나 아직 시청할 수 없는 작품은 완주 분모에서 제외합니다. 완주 판정은 백엔드에서 일관되게 계산합니다.

## 대상 API

```http
GET /api/me/anime-list/series
GET /api/me/anime-stats
GET /api/users/:userId/anime-stats
```

`/api/me/anime-list/series`의 기존 요청 파라미터와 호출 방식은 바뀌지 않습니다.

## 완주 계산에서 제외되는 작품

| `completionExclusionReason` | 의미 |
| --- | --- |
| `MUSIC` | 음악·뮤직비디오 형식 |
| `RECAP` | 총집편 (`SUMMARY` relation) |
| `COMPILATION` | 컴필레이션 작품 |
| `NOT_YET_RELEASED` | 아직 공개되지 않은 작품 |
| `CANCELLED` | 제작·공개 취소 작품 |

제외 작품도 시리즈의 `items`에는 계속 포함되므로 시리즈 상세 화면에서 표시할 수 있습니다.

## 시리즈 컬렉션 응답 필드

```json
{
  "memberCount": 4,
  "requiredMemberCount": 2,
  "completedMemberCount": 2,
  "completedRequiredMemberCount": 1,
  "completionRate": 50,
  "completed": false,
  "items": [
    {
      "completionRequired": false,
      "completionExclusionReason": "NOT_YET_RELEASED",
      "anime": {},
      "userList": null
    }
  ]
}
```

- `memberCount`: 시리즈에 속한 전체 작품 수. 기존 의미 유지
- `requiredMemberCount`: 완주 판정에 포함되는 작품 수
- `completedMemberCount`: 전체 작품 중 사용자가 완료한 수. 기존 의미 유지
- `completedRequiredMemberCount`: 완주 필수 작품 중 사용자가 완료한 수
- `completionRate`: `completedRequiredMemberCount / requiredMemberCount * 100`
- `completed`: 완주 필수 작품이 1개 이상이고 모두 완료되었는지 여부
- `items[].completionRequired`: 해당 작품이 완주 판정에 포함되는지 여부
- `items[].completionExclusionReason`: 제외 이유. 포함 작품이면 `null`

## 프런트 적용 방법

1. 시리즈 진행률은 백엔드의 `completionRate`를 그대로 사용합니다.
2. 숫자형 진행 상태는 `completedRequiredMemberCount / requiredMemberCount`로 표시합니다.
3. 기존 `completedMemberCount / memberCount`로 완주 여부를 다시 계산하지 않습니다.
4. `completionRequired: false`인 작품에는 필요하면 “완주 계산 제외” 배지와 제외 사유를 표시합니다.
5. `status=watched`와 `status=completed` 필터 결과는 이미 새 기준으로 서버에서 필터링됩니다.

기존 필드는 삭제되지 않았으므로 즉시 프런트를 수정하지 않아도 API 파싱은 유지됩니다. 다만 새 완주 기준을 정확히 표시하려면 진행률의 분자·분모를 새 필드로 교체하는 것이 좋습니다.
