# MyAniTrack Flutter Design Guide

이 문서는 MyAniTrack 웹의 색감과 UI 분위기를 Flutter 앱으로 옮길 때 기준이 되는 디자인 가이드입니다. 목표는 웹과 앱이 같은 서비스처럼 느껴지게 하는 것입니다.

## 1. 디자인 방향

MyAniTrack의 기본 인상은 **따뜻한 기록장 + 선명한 데이터 도구**입니다.

- 배경은 차가운 흰색이 아니라 아이보리, 크림, 베이지 계열을 사용합니다.
- 주요 액션은 앰버/골드 계열을 사용해 “기록하기, 시작하기, 새로고침” 같은 행동을 강조합니다.
- 텍스트와 카드 경계는 브라운이 섞인 뉴트럴 톤을 사용합니다.
- 분석 차트는 여러 색을 쓰되, 전체 UI의 기반은 따뜻한 중립색으로 유지합니다.
- 샘플/체험 화면은 틸 계열을 사용해 실제 사용자 데이터와 명확히 구분합니다.

앱에서는 과한 그라디언트나 장식보다, **부드러운 배경, 명확한 카드, 작은 배지, 읽기 쉬운 데이터 밀도**를 우선합니다.

## 2. Core Palette

### Primary Amber

서비스의 대표 액션 색입니다. 버튼, 활성 탭, 별점, 강조 수치에 사용합니다.

| Token | Hex | Flutter |
| --- | --- | --- |
| `pointColor` | `#F59E0B` | `Color(0xFFF59E0B)` |
| `pointHover` | `#D97706` | `Color(0xFFD97706)` |
| `pointPressed` | `#B45309` | `Color(0xFFB45309)` |
| `pointBorder` | `#FBBF24` | `Color(0xFFFBBF24)` |
| `pointSoft` | `#FEF3C7` | `Color(0xFFFEF3C7)` |
| `pointSoftStrong` | `#FDE68A` | `Color(0xFFFDE68A)` |
| `pointSoftest` | `#FFFBEB` | `Color(0xFFFFFBEB)` |

사용 규칙:

- Primary CTA 배경: `pointColor`
- CTA pressed: `pointPressed`
- 활성 navigation/tab 배경: `pointSoft`
- 별점/랭킹 하이라이트: `pointBorder` 또는 `pointColor`
- 넓은 배경 전체를 앰버로 채우지 않습니다.

### Backgrounds

| Token | Hex | Flutter |
| --- | --- | --- |
| `bgPage` | `#FFF7ED` | `Color(0xFFFFF7ED)` |
| `bgIvory` | `#FFFBF5` | `Color(0xFFFFFBF5)` |
| `bgCard` | `#FFFFFF` | `Color(0xFFFFFFFF)` |
| `bgSoftBeige` | `#F5EFE6` | `Color(0xFFF5EFE6)` |
| `bgNeutral` | `#FAFAF9` | `Color(0xFFFAFAF9)` |

사용 규칙:

- Scaffold 배경: `bgPage`
- 카드 배경: `bgCard`
- 섹션 배경 또는 skeleton: `bgNeutral`, `bgSoftBeige`
- 앱 전체 배경은 웹처럼 `pointSoftest -> bgPage -> bgSoftBeige` 느낌의 은은한 vertical gradient를 써도 됩니다.

Flutter 예시:

```dart
const appBackgroundGradient = LinearGradient(
  begin: Alignment.topCenter,
  end: Alignment.bottomCenter,
  colors: [
    Color(0xFFFFFBEB),
    Color(0xFFFFF7ED),
    Color(0xFFF5EFE6),
  ],
  stops: [0.0, 0.28, 1.0],
);
```

### Text

| Token | Hex | Flutter |
| --- | --- | --- |
| `textPrimary` | `#1C1917` | `Color(0xFF1C1917)` |
| `textSecondary` | `#57534E` | `Color(0xFF57534E)` |
| `textMuted` | `#78716C` | `Color(0xFF78716C)` |
| `textInverse` | `#FFFFFF` | `Color(0xFFFFFFFF)` |
| `textOnPointSoft` | `#78350F` | `Color(0xFF78350F)` |

사용 규칙:

- 제목/주요 수치: `textPrimary`
- 설명/메타 정보: `textSecondary`
- placeholder/보조 라벨: `textMuted`
- 앰버 soft 배경 위 텍스트: `textOnPointSoft`

### Dark Neutrals

| Token | Hex |
| --- | --- |
| `darkEspresso` | `#292524` |
| `darkCocoa` | `#1C1917` |
| `darkBorder` | `#44403C` |

사용 규칙:

- 상세 페이지 hero overlay, 포스터 이미지 위 텍스트, modal backdrop에 사용합니다.
- 앱 전체 dark theme로 확장할 때도 이 계열을 기준으로 합니다.

## 3. Semantic Colors

| Role | Hex | Usage |
| --- | --- | --- |
| Success | `#16A34A` | 저장 완료, 연결 성공 |
| Success Soft | `#DCFCE7` | 성공 안내 배경 |
| Error | `#DC2626` | 삭제, 실패, 위험 버튼 |
| Error Soft | `#FEE2E2` | 오류 안내 배경 |
| Info | `#2563EB` | 비교 차트, 보조 정보 |
| Info Soft | `#DBEAFE` | 정보 안내 배경 |

주의:

- 삭제/위험 액션만 red 계열을 사용합니다.
- 정보성 파랑은 차트나 안내에 제한적으로 사용합니다.

## 4. Sample Mode Palette

샘플/체험 화면은 실제 사용자 데이터와 구분하기 위해 틸 계열을 사용합니다.

| Role | Hex |
| --- | --- |
| Sample Primary | `#0F766E` |
| Sample Dark Text | `#134E4A` |
| Sample Soft | `#F0FDFA` |
| Sample Border | `rgba(15, 118, 110, 0.20)` |

사용 규칙:

- 샘플 배너, 샘플 칩, 샘플 카드 배지에만 사용합니다.
- 실제 데이터 화면에서는 이 색을 주요 액션 색으로 쓰지 않습니다.
- 샘플 화면에는 반드시 “Sample mode”, “샘플 컬렉션”, “샘플 분석” 같은 텍스트 배지를 노출합니다.

## 5. Flutter Color Tokens

Flutter에서는 아래처럼 `AppColors`를 먼저 고정하는 것을 권장합니다.

```dart
abstract final class AppColors {
  static const point = Color(0xFFF59E0B);
  static const pointHover = Color(0xFFD97706);
  static const pointPressed = Color(0xFFB45309);
  static const pointBorder = Color(0xFFFBBF24);
  static const pointSoft = Color(0xFFFEF3C7);
  static const pointSoftStrong = Color(0xFFFDE68A);
  static const pointSoftest = Color(0xFFFFFBEB);

  static const bgPage = Color(0xFFFFF7ED);
  static const bgIvory = Color(0xFFFFFBF5);
  static const bgCard = Color(0xFFFFFFFF);
  static const bgSoftBeige = Color(0xFFF5EFE6);
  static const bgNeutral = Color(0xFFFAFAF9);

  static const textPrimary = Color(0xFF1C1917);
  static const textSecondary = Color(0xFF57534E);
  static const textMuted = Color(0xFF78716C);
  static const textInverse = Color(0xFFFFFFFF);
  static const textOnPointSoft = Color(0xFF78350F);

  static const darkEspresso = Color(0xFF292524);
  static const darkCocoa = Color(0xFF1C1917);
  static const darkBorder = Color(0xFF44403C);

  static const success = Color(0xFF16A34A);
  static const successSoft = Color(0xFFDCFCE7);
  static const error = Color(0xFFDC2626);
  static const errorSoft = Color(0xFFFEE2E2);
  static const info = Color(0xFF2563EB);
  static const infoSoft = Color(0xFFDBEAFE);

  static const sample = Color(0xFF0F766E);
  static const sampleDark = Color(0xFF134E4A);
  static const sampleSoft = Color(0xFFF0FDFA);
}
```

## 6. Typography

웹 기준 폰트:

- 기본: `Pretendard`, `Noto Sans KR`, `Inter`, `Manrope`
- Display: `Manrope`, `Inter`, `Pretendard`
- Mono: `JetBrains Mono`, `Cascadia Code`

Flutter 권장:

- 한글 중심 앱이므로 기본 폰트는 `Pretendard` 또는 `Noto Sans KR`
- 영문 브랜드/숫자 강조에는 `Manrope` 또는 `Inter`
- 숫자 데이터가 많은 분석 화면에서는 tabular number를 지원하는 폰트를 고려합니다.

타이포그래피 방향:

- H1: 크고 단단하지만 과장하지 않기
- 카드 제목: 16-20px, weight 700 전후
- 메타/라벨: 12-13px, weight 700-900, muted color
- 본문: 14-16px, line-height 1.45-1.6

## 7. Shape & Spacing

웹 토큰:

| Token | Value |
| --- | --- |
| Card radius | `18px` |
| Input radius | `14px` |
| Pill radius | `999px` |
| Base spacing | `4, 8, 12, 16, 24, 32, 48, 64, 96` |

Flutter 적용:

- 카드: `BorderRadius.circular(18)`
- 입력창/툴바: `BorderRadius.circular(14)`
- 칩/탭/배지: `BorderRadius.circular(999)`
- 카드 내부 padding: 16-24
- 목록 item gap: 12-18
- 화면 좌우 padding: mobile 16, tablet 24

주의:

- 앱에서는 카드 안에 또 카드가 중첩되지 않게 합니다.
- 화면 섹션은 큰 floating card로 감싸기보다, full-width 배경 위에 카드/리스트를 배치합니다.

## 8. Elevation & Borders

웹의 그림자는 강하지 않습니다. Flutter에서도 Material 기본 elevation을 과하게 쓰지 않습니다.

권장 shadow:

```dart
const cardShadow = [
  BoxShadow(
    color: Color(0x0A000000),
    offset: Offset(0, 1),
    blurRadius: 2,
  ),
  BoxShadow(
    color: Color(0x0F1C1917),
    offset: Offset(0, 8),
    blurRadius: 24,
  ),
];
```

Border:

- 기본 카드 border: `Color(0x2478716C)`에 가까운 stone 계열 투명선
- Active/hover/focus border: amber 계열 투명선
- Sample mode border: teal 계열 투명선

## 9. Component Guidelines

### Buttons

Primary button:

- Background: `pointColor`
- Text: `textInverse`
- Radius: pill
- Height: 44-48
- Pressed: `pointPressed`

Secondary button:

- Background: white or transparent
- Border: stone 300 느낌
- Text: `textPrimary`

Danger button:

- Background: `error`
- Text: white
- 위험 액션에만 사용합니다.

### Cards

기본 카드:

- Background: `bgCard`
- Border: stone 계열 12-16% opacity
- Radius: 18
- Shadow: low elevation

분석 카드:

- 높은 데이터 밀도 허용
- heading은 작게, 숫자는 크게
- 너무 장식적인 hero card 스타일을 반복하지 않습니다.

### Chips & Badges

일반 정보 칩:

- Background: `pointSoftest` 또는 `bgNeutral`
- Text: `textSecondary`

Active chip:

- Background: `pointSoft`
- Text: `pointHover`

Sample chip:

- Background: `sampleSoft`
- Text: `sample`
- Border: sample transparent border

### Inputs

- Background: white
- Border: stone 20% opacity
- Focus border: amber 30-36% opacity
- Focus ring: amber 18% opacity

## 10. Page Patterns

### Home / Landing

홈은 가장 감성적이어도 되는 화면입니다.

- 실제 애니 포스터, 배너 이미지 중심
- 어두운 overlay 위에 white text 사용 가능
- CTA는 amber
- 단, 앱 첫 화면은 marketing page보다 바로 탐색/기록으로 진입하는 구조가 좋습니다.

### Collection

컬렉션은 반복 사용 화면입니다.

- 배경은 `bgPage`
- 상단 검색/필터는 card 또는 toolbar band
- 애니 카드는 포스터 중심
- 평점은 amber stars
- 샘플 상태라면 카드마다 작은 “샘플” 배지 표시

### Analysis

분석 화면은 조용하고 밀도 있게 설계합니다.

- 요약 수치 카드 2x2 또는 가로 scroll
- chart panel은 white card
- chart color는 여러 색을 쓰되, 주변 UI는 neutral/amber 유지
- selected state는 amber 또는 dark border
- sample analysis는 teal badge와 banner로 분리

### Detail

상세 화면은 이미지가 주인공입니다.

- 상단 hero는 poster/banner 이미지 + dark overlay
- 텍스트는 white 또는 ivory
- 아래 정보 섹션은 white card
- 컬렉션 편집 UI는 별점/상태 선택이 바로 보이게 합니다.

## 11. Chart Colors

차트는 웹에서 다음 계열을 사용합니다.

```dart
const chartPalette = [
  Color(0xFF2563EB),
  Color(0xFFDC2626),
  Color(0xFF16A34A),
  Color(0xFF9333EA),
  Color(0xFFEA580C),
  Color(0xFF0891B2),
  Color(0xFFDB2777),
  Color(0xFF65A30D),
  Color(0xFF7C3AED),
  Color(0xFFCA8A04),
  Color(0xFF0F766E),
  Color(0xFFBE123C),
];
```

차트 사용 규칙:

- 주요 trend line: amber 또는 blue
- community comparison: blue
- selected bar/slice: amber highlight
- grid line: stone 12% opacity
- tooltip: white card + dark text

## 12. Sample Mode UI

샘플 모드는 Flutter 앱에서도 반드시 명시합니다.

필수 요소:

- 상단 banner: “Sample mode”
- 화면 제목 또는 toolbar chip: “샘플 컬렉션”, “샘플 분석”
- 카드 또는 리스트 item에 작은 “샘플” badge
- CTA: “내 기록으로 시작하기”

권장 스타일:

```dart
BoxDecoration(
  color: AppColors.sampleSoft.withOpacity(0.86),
  border: Border.all(color: AppColors.sample.withOpacity(0.2)),
  borderRadius: BorderRadius.circular(18),
)
```

샘플 모드 색은 teal로만 제한하고, amber CTA는 계속 유지합니다.

## 13. Do / Don't

Do:

- 따뜻한 ivory/amber 기반을 유지합니다.
- 데이터 화면은 조용하고 스캔하기 쉽게 만듭니다.
- 포스터 이미지를 적극적으로 사용합니다.
- active/selected state는 분명하게 만듭니다.
- 샘플 데이터와 실제 데이터를 색/배지로 명확히 구분합니다.

Don't:

- 전체 앱을 진한 orange/brown으로 덮지 않습니다.
- 분석 화면을 marketing hero처럼 만들지 않습니다.
- 카드 안에 카드가 계속 중첩되는 구조를 피합니다.
- 보라/파랑 gradient를 서비스 대표색처럼 쓰지 않습니다.
- 샘플 화면을 실제 개인 데이터처럼 보이게 만들지 않습니다.

## 14. Flutter Theme Skeleton

```dart
ThemeData buildMyAniTrackTheme() {
  return ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    scaffoldBackgroundColor: AppColors.bgPage,
    colorScheme: ColorScheme.fromSeed(
      seedColor: AppColors.point,
      primary: AppColors.point,
      secondary: AppColors.sample,
      error: AppColors.error,
      surface: AppColors.bgCard,
      background: AppColors.bgPage,
      onPrimary: AppColors.textInverse,
      onSurface: AppColors.textPrimary,
    ),
    textTheme: const TextTheme(
      headlineLarge: TextStyle(
        color: AppColors.textPrimary,
        fontWeight: FontWeight.w800,
        height: 1.1,
      ),
      titleMedium: TextStyle(
        color: AppColors.textPrimary,
        fontWeight: FontWeight.w700,
      ),
      bodyMedium: TextStyle(
        color: AppColors.textSecondary,
        height: 1.5,
      ),
      labelMedium: TextStyle(
        color: AppColors.textMuted,
        fontWeight: FontWeight.w800,
      ),
    ),
    cardTheme: CardThemeData(
      color: AppColors.bgCard,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: BorderSide(
          color: AppColors.textMuted.withOpacity(0.16),
        ),
      ),
    ),
  );
}
```

## 15. Implementation Priority

Flutter 앱을 만들 때 우선순위:

1. `AppColors`, `AppTextStyles`, `AppSpacing`, `AppRadii` 토큰 고정
2. 공통 `AppScaffold`, `AppCard`, `PrimaryButton`, `SecondaryButton`, `SampleBanner` 구현
3. Collection 카드와 Anime detail hero 구현
4. Analysis summary card와 chart panel 구현
5. Sample mode를 모든 게스트 화면에 일관되게 적용

이 순서로 만들면 색감과 분위기를 초반부터 안정적으로 맞출 수 있습니다.
