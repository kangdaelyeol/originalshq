# glass — 유리(glassy) 대시보드 부품

xtool 인입통계에서 만든 시각화 부품과 디자인 값. 데이터만 넘기면 그리는
화면 무관한 부품이라 다른 페이지(cmip, parke 관리자 등)에서도 그대로 쓴다.

```ts
import { StatTile, TrendList, StackedBars, Ring, Segmented } from '@/components/glass'
```

## 폴더

| 파일 | 내용 |
|---|---|
| `styles/_tokens.scss` | 모양 값 — 투명도, 테두리, 반지름, 흐림, 글자 흰색 단계 |
| `styles/_mixins.scss` | `ambient`(배경 빛), `card`, `inner`, `shimmer`(로딩), `pill-group`, `pill-button`, `tooltip`, `sticky-table`, 처음 그릴 때의 `draw-in`·`fill-in`·`fade-in` |
| `styles/base.scss` | 색 CSS 변수(`:root`), 애니메이션. `index.ts`가 한 번 불러온다 |
| `*.tsx` + 같은 이름 `.scss` | 부품 하나와 그 스타일. 클래스는 모두 `glass_` 로 시작 |
| `smooth-path.ts` | 점들을 지나는 부드러운 곡선(SVG path). 값보다 튀어 오르지 않는 보간 |

## 부품

| 부품 | 쓰는 곳 | 넘기는 것 |
|---|---|---|
| `StatTile` | 숫자 타일 | 아이콘(lucide), 이름, 값, 보조 줄, `to`(있으면 ↗ 버튼과 홈), `warn` |
| `TrendList` | 줄마다 작은 추이 그래프 + 합계 + 막대 + 가장 큰 칸 | `rows: TrendListRow[]`, `labels`(기간 이름), `columns`(머리글), `extra`(아래 따로 둘 줄) |
| `StackedBars` | 맨 위 100% 요약 띠 + 줄마다 쌓은 막대 | `segments`(종류·색), `rows`, `sum`. 줄에 `aside`(옆 칸)·`detail`(눌러 펼칠 내용) |
| `Ring` | 비율 하나(0~1)를 원으로 | `value`, `text`, `label` |
| `Segmented` | 여럿 중 하나 고르기 — [그래프 \| 표], [건수 순 \| 비율 순], 메뉴 줄 단위. 고른 버튼 뒤 유리 알약이 미끄러져 간다 | `options`, `value`, `onChange`, `role`(`tabs` 보이는 내용 전환 / `buttons` 방식 전환), `size`(`sm` 카드 / `md` 메뉴 줄) — 고른 값은 부르는 쪽이 기억 |

예시는 xtool 인입통계: `screens/xtool-lead-manager/components/monday-trend/`
의 `board-trend-list.tsx`(TrendList), `pipeline-section.tsx`(StackedBars),
`cs-team-section.tsx`(Ring·TrendList·Segmented), `monday-trend.tsx`(메뉴 줄 Segmented), `live-inflow.tsx`(StatTile).

## 색

색은 CSS 변수라 페이지(또는 그 안 상자)에서 다시 정하면 그 아래 부품이 따른다.

| 변수 | 뜻 | 기본 |
|---|---|---|
| `--glass-accent` | 데이터(그래프 선·막대·링) | 라임 `#d4f25c` |
| `--glass-on-accent` | 데이터색 위 글자 | 어두운 올리브 |
| `--glass-link` | 누르는 것(링크·선택·포커스) | 청록 `#6ee7e0` |
| `--glass-warn` | 주의(오기입·미처리) | 노랑 |
| `--glass-danger` | 위험 | 빨강 |

글자는 막대 색을 쓰지 않고 흰색 단계로만. 쌓은 막대처럼 종류가 여럿인
색은 부품이 정하지 않고 부르는 쪽이 조각마다 준다(순서 있는 종류는 한 색의
옅은 → 진한 색).

## 다른 페이지를 유리로 바꾸는 순서

1. **배경**: 페이지 본문(과 붙어 있는 메뉴 줄)에 `@include glass.ambient`.
   유리는 뒤에 비칠 게 있어야 보인다.
2. **카드**: 그 페이지의 카드 클래스에 `@include glass.card`, 카드 안 타일에
   `glass.inner`.
3. **표**: 스크롤 상자에 `@include glass.sticky-table('그 표 선택자')`.
   표는 `border-collapse: separate`.
4. **부품**: 숫자·목록·막대 자리를 위 부품으로 바꾸고, 정확한 숫자가 필요한
   곳은 `Segmented`로 [그래프 | 표]를 둬서 표를 남긴다.

xtool은 2~3을 `screens/xtool-lead-manager/styles/glass-theme.scss`에
`nav`·`page` 믹스인으로 묶어 두었다. 화면 내비 줄과 본문에 `glass_theme`
클래스를 붙이고 그 파일 맨 아래처럼 선택자에 include하면 된다.

```scss
@use '../../../components/glass/styles/tokens' as *;
@use '../../../components/glass/styles/mixins' as glass;

.my_page {
  @include glass.ambient;

  .my_card {
    @include glass.card;
  }
}
```

## 원칙

- 흐림(backdrop-filter)은 바깥 카드에만. 안쪽은 반투명 색만 깐다. 흐림을
  겹치면 스크롤이 무거워진다.
- 툴팁·떠 있는 판은 거의 불투명. 뒤가 비치면 글자가 안 읽힌다.
- 움직임은 `prefers-reduced-motion`이면 끈다.
- 그래프에는 늘 표 보기를 둔다(정확한 값·접근성).
