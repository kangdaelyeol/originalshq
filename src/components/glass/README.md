# glass — 유리(glassy) 대시보드 라이브러리

xtool 리드 매니저에서 만든 화면 틀·부품·스타일. 화면과 무관해서 다른
페이지(cmip, parke 관리자 등)에 그대로 입힌다. 테마 12개(다크 8·라이트 4)를
헤더에서 고른다.

```ts
import {
  GlassHeader,
  ThemePicker,
  useGlassTheme,
  startGlassTransition,
  Segmented,
  Select,
  StatTile,
} from '@/components/glass'
```

```scss
@use '…/components/glass/styles/tokens' as *; // $text, $fill-1 …
@use '…/components/glass/styles/mixins' as glass; // glass.card …
```

## 폴더

| 파일                        | 내용                                                                          |
| --------------------------- | ----------------------------------------------------------------------------- |
| `index.ts`                  | 내보내는 것 전부. `styles/base.scss`를 한 번 불러온다                         |
| `styles/_tokens.scss`       | 값 — 색 별칭(`$text`, `$fill-1`… 전부 CSS 변수), 반지름, 흐림                 |
| `styles/_mixins.scss`       | 믹스인 입구 — 아래 다섯 파일을 한데 모은다                                    |
| `styles/_surfaces.scss`     | 판 — 배경 빛, 카드, 모달 판, 떠 있는 판, 가림막                               |
| `styles/_controls.scss`     | 누르고 고르는 것 — 알약, 칩, 둥근 버튼, 색 버튼, 입력칸, 스위치, 툴팁         |
| `styles/_tables.scss`       | 표 — 고정 칸 표, 목록 표, 줄 목록                                             |
| `styles/_motion.scss`       | 움직임 — 로딩, 처음 그릴 때, 떠오름, 판 등장                                  |
| `styles/_skins.scss`        | 다른 곳에서 만든 부품의 유리 겉옷(기간 선택)                                  |
| `styles/base.scss`          | 전역 CSS — `_themes`(테마 변수), `_keyframes`(애니메이션), `_page`(페이지 셸) |
| `*.tsx` + 같은 이름 `.scss` | 부품 하나와 그 스타일. 클래스는 모두 `glass_`로 시작                          |

## 페이지 셸

| 무엇                   | 쓰는 법                                                                                                                                                   |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `glass_root` 클래스    | 페이지 맨 바깥. 화면 뒤에 배경 빛 한 장(고정 레이어)을 깔고 문서 바탕도 테마 바탕색으로                                                                   |
| `glass_page` 클래스    | 본문. 배경을 비워 뒤 빛이 비치게                                                                                                                          |
| `useGlassTheme(키)`    | 고른 테마를 `<html data-glass-theme data-glass-scheme>`에 걸고 브라우저에 기억. `[테마, 바꾸기]`                                                          |
| `GlassHeader`          | 맨 위 줄 `start`·`center`·`end` 세 칸. 위에 붙어 있고(z-index 6 — 메뉴 줄보다 위, 모달보다 아래), 화면 전환 동안 그대로 남는다                            |
| `ThemePicker`          | 지금 테마 알약 → 누르면 다크·라이트 견본 판이 펼쳐진다. 바깥을 누르거나 Esc로 접힌다                                                                      |
| `startGlassTransition` | 탭(화면)을 바꿀 때 상태 바꾸는 함수를 감싼다. 새 화면이 흐릿하게 나타나며 선명해진다(View Transitions, 지원 안 하는 브라우저·움직임 줄이기는 바로 바뀐다) |

```tsx
const [theme, setTheme] = useGlassTheme('cmip.theme')

<div className="cmip glass_root">
  <GlassHeader
    start={<Logo />}
    center={<Segmented options={TAB_LABEL} value={tab} label="화면" size="md"
      onChange={(next) => startGlassTransition(() => setTab(next))} />}
    end={<ThemePicker value={theme} onChange={setTheme} />}
  />
  <main className="glass_page">…</main>
</div>
```

## 부품

| 부품          | 쓰는 곳                                                              | 넘기는 것                                                                            |
| ------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `Segmented`   | 여럿 중 하나 — 탭, [그래프 \| 표], 정렬 기준. 고른 알약이 미끄러진다 | `options`, `value`, `onChange`, `label`, `role`(`tabs`/`buttons`), `size`(`sm`/`md`) |
| `Select`      | 드롭다운(기본 `<select>` 대신) — 유리 목록이 펼쳐진다                | `options: SelectOption[]`, `value`, `onChange`, `label`                              |
| `AutoHeight`  | 내용 높이가 바뀔 때(로딩 → 내용) 높이가 부드럽게 늘고 줄어든다       | `children`                                                                           |
| `StatTile`    | 숫자 타일. 값이 길면 글자를 줄여 한 줄에                             | 아이콘(lucide), 이름, 값, 보조 줄, `to`/`onGo`(있으면 ↗ 버튼과 홈), `warn`           |
| `TrendList`   | 줄마다 작은 추이 그래프 + 합계 + 막대 + 가장 큰 칸                   | `rows: TrendListRow[]`, `labels`, `columns`, 줄의 `detail`(눌러 펼칠 내용)           |
| `StackedBars` | 맨 위 100% 요약 띠 + 줄마다 쌓은 막대                                | `segments`(종류·색), `rows`, `sum`. 줄에 `aside`·`detail`                            |
| `Ring`        | 비율 하나(0~1)를 원으로                                              | `value`, `text`, `label`                                                             |
| `GlassLine`   | 부드러운 선 그래프(면 채움, 마우스 올린 점 하나만)                   | 점·크기. 곡선은 `smoothPath`, 크기는 `useElementSize`                                |
| `useDismiss`  | 펼친 것을 바깥 누름·Esc로 닫기                                       | `ref`, `open`, `onDismiss`                                                           |

예시는 xtool: `screens/xtool-lead-manager/components/` — `header.tsx`(GlassHeader),
`monday-trend/`(StatTile·TrendList·StackedBars·Ring·Segmented),
`monday/monday-nav.tsx`(Select), `monday/monday-detail.tsx`(AutoHeight).

## 믹스인

| 믹스인                                  | 용도                                                                    |
| --------------------------------------- | ----------------------------------------------------------------------- |
| `ambient`                               | 위에 붙어 있는 줄(메뉴 줄 등) — 뒤 배경 빛과 이어지는 불투명 배경       |
| `card` / `inner`                        | 바깥 카드(흐림 없음) / 카드 안 타일(한 겹 밝게)                         |
| `panel($radius, $sheen)` + `panel-in`   | 모달 판·펼친 판 — 진한 유리 + 센 흐림 / 떠오르며 등장                   |
| `float($radius)` + `pop-in`             | 드롭다운 목록·툴팁 — 거의 불투명 / 내려오며 등장                        |
| `scrim`                                 | 모달 뒤 가림막                                                          |
| `pill-group`, `pill-button`, `chip`     | 알약 묶음, 알약 버튼, 켜고 끄는 칩                                      |
| `icon-button($size)`                    | 동그란 아이콘 버튼(닫기 등)                                             |
| `tint-button($color)`, `tint($color)`   | 뜻이 있는 색(등록·삭제)의 버튼·배지 — 그 색을 옅게 깐 유리 + 그 색 글자 |
| `field`, `select-arrow`, `check`        | 입력칸(초점은 청록이 번진다), 기본 select 화살표, 체크박스·라디오       |
| `switch-off` / `switch-on`              | 켜고 끄는 스위치                                                        |
| `tooltip`                               | 마우스를 올리면 뜨는 작은 알약                                          |
| `sticky-table($table)`                  | 고정 칸(머리글·첫 칸·합계)이 있는 표 — 밑으로 칸이 지나갈 때만 바탕     |
| `list-table($table, $hover, $round)`    | 눌러서 여는 줄이 있는 목록 표 — 불투명 머리글 띠, 한 줄 걸러 옅은 빛    |
| `zebra-list($item)`                     | 표가 아닌 줄 목록                                                       |
| `shimmer`                               | 스켈레톤 막대(빛 띠가 끊김 없이 흐른다)                                 |
| `draw-in` / `fill-in` / `fade-in`       | 처음 그릴 때 — 선·쌓은 막대 / 막대 / 점·이름표                          |
| `enter`, `enter-rows`, `enter-children` | 불러온 내용이 흐릿하게 떠오른다 — 하나 / 표의 줄 / 자식들 차례로        |
| `date-range-picker`                     | `screens/cmip/components/date-range-picker` 겉옷 — 감싼 줄에 include    |

## 테마

테마 = **바탕(base) + 데이터색(accent) + 누르는 색(link)** + 다크/라이트(scheme).
배경 빛, 글자 단계, 겹 단계, 판·툴팁·고정 칸 색은 이 셋에서 계산하거나 scheme
공통 값을 쓴다. 부품·화면 스타일은 전부 `var(--glass-*)`(또는 `$text` 같은
별칭)만 쓰고 색 숫자를 직접 적지 않는다.

| 테마     | scheme | 바탕      | 데이터색  | 누르는 색 |
| -------- | ------ | --------- | --------- | --------- |
| Lime     | 다크   | 검정      | 라임      | 청록      |
| Ember    | 다크   | 짙은 갈색 | 복숭아    | 크림      |
| Aurora   | 다크   | 남색      | 민트      | 라벤더    |
| Ocean    | 다크   | 짙은 청록 | 하늘      | 민트      |
| Orchid   | 다크   | 자주      | 핑크      | 하늘      |
| Graphite | 다크   | 무채색    | 은빛      | 하늘      |
| Nebula   | 다크   | 짙은 보라 | 라벤더    | 핑크      |
| Forest   | 다크   | 짙은 숲색 | 비취      | 얼음 하늘 |
| Daylight | 라이트 | 밝은 회청 | 보라      | 짙은 청록 |
| Paper    | 라이트 | 흰 종이   | 파랑      | 자홍      |
| Mint     | 라이트 | 옅은 민트 | 에메랄드  | 남색      |
| Blush    | 라이트 | 옅은 분홍 | 짙은 청록 | 장미      |

- 테마를 더할 때: `styles/_themes.scss`에 `[data-glass-theme='…']` 블록,
  `themes.ts`의 `GLASS_THEMES`에 한 줄(이름·scheme·견본색). 라이트면 scheme
  공통 블록이 겹·글자를 뒤집으니 바탕·두 색만 적으면 된다.
- 주의(`--glass-warn`)·위험(`--glass-danger`)은 뜻이 있는 색이라 데이터색은
  노랑·빨강 계열을 피한다.
- 페이지의 예전 색(유리 스타일이 덮지 않는 글자·뱃지)을 라이트에서 뒤집으려면
  그 페이지 쪽에서 `[data-glass-scheme='light']` 아래에 덮는다(xtool:
  `pages/xtool-global.scss`의 `--xt-*`).

| 변수                                                                                   | 뜻                                             |
| -------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `--glass-accent` / `--glass-on-accent`                                                 | 데이터색 / 그 위 글자                          |
| `--glass-link` / `--glass-on-link`                                                     | 누르는 색 / 그 위 글자                         |
| `--glass-ink`                                                                          | 겹·글자를 섞는 바탕(다크 흰색, 라이트 짙은 색) |
| `--glass-text`, `-2`, `-3`                                                             | 글자 단계                                      |
| `--glass-fill-1~3`, `--glass-hover`, `--glass-track`                                   | 겹 단계                                        |
| `--glass-card-*`, `--glass-panel-*`, `--glass-float`, `--glass-scrim`, `--glass-solid` | 카드·모달 판·툴팁·가림막·불투명 칸             |

## 다른 페이지(cmip 등)를 유리로 바꾸는 순서

1. **셸**: 맨 바깥에 `glass_root`, 본문에 `glass_page`. `useGlassTheme(키)`로
   테마를 걸고, 헤더를 `GlassHeader` + `ThemePicker`로. 탭 바꾸기는
   `startGlassTransition`으로 감싼다.
2. **메뉴 줄**: 위에 붙는 줄에 `@include glass.ambient`. 기간 선택이 있으면
   `@include glass.date-range-picker`. 알약 토글은 `Segmented`, 드롭다운은
   `Select`로 바꾼다.
3. **카드**: 카드 클래스에 `glass.card`, 카드 안 타일에 `glass.inner`.
4. **표**: 고정 칸 표는 스크롤 상자에 `glass.sticky-table('그 표 선택자')`,
   목록 표는 `glass.list-table`. 표는 `border-collapse: separate`.
5. **모달**: 가림막 `glass.scrim`, 판 `glass.panel` + `glass.panel-in`, 닫기
   `glass.icon-button`, 입력칸 `glass.field`.
6. **로딩**: 스켈레톤 막대에 `glass.shimmer`, 다 받은 내용에 `glass.enter`·
   `enter-children`.
7. **글자·색**: 하드코딩된 색을 `$text`·`$text-2`·`$text-3`, `var(--glass-accent)`
   등으로. 밝은 테마에서도 읽히는지 Paper로 확인한다.

xtool은 화면 클래스에 맞춘 묶음을 `screens/xtool-lead-manager/styles/_xtool-glass.scss`
(`nav`·`page`·`list-nav`·`list-table`·`detail-modal`·`confirm-modal`)에 두고,
화면마다 `*-glass.scss`에서 include한다.

## 원칙

- 테두리(border)와 반짝이는 그림자(glow)는 쓰지 않는다. 모양은 배경 겹과
  흐림으로만.
- 흐림(backdrop-filter)은 밑으로 내용이 지나가는 것(모달·펼친 판·툴팁)에만.
  카드에 주면 스크롤·전환이 무거워진다.
- 흐림이 안 먹으면 조상을 본다 — 조상에 filter·opacity·backdrop-filter·
  view-transition-name이 있으면 흐림이 그 조상 안에서만 계산된다.
- 툴팁·떠 있는 판은 거의 불투명. 뒤가 비치면 글자가 안 읽힌다.
- 움직임은 `prefers-reduced-motion`이면 끈다.
- 그래프에는 늘 표 보기를 둔다(정확한 값·접근성).
