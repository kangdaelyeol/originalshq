# ohq-ui — originalshq 공용 디자인

originalshq 화면들이 같이 쓰는 디자인 라이브러리 — 토큰, 테마(유리·Monday), 기본 부품, 차트, 배경, 로고,
로그인 폼 부품, 외관 설정, 디자인 랩(카탈로그·견본 D1~D10·D13·D14·D16).

- 가져올 때는 `@/ohq-ui/...` (예: `@/ohq-ui/components/button`).
- 라이브러리는 화면 코드(`@/screens/...`)를 가져오지 않는다. 화면이 라이브러리를 쓰는 한 방향뿐이다.
- 실제 모습은 기술팀 보드의 디자인 화면(`/xtool-tech/design`, 관리자만) "기본 부품" 탭에서 본다.

## 새 화면 시작하기

관리 화면(`src/screens/xtool-admin`)이 라이브러리만으로 선 예다.

1. **루트** — `AppearanceProvider`로 감싸고 화면 범위 클래스를 준다. 외관 설정(테마·색·강조색·유리·배경)은
   기술팀 보드와 같이 저장돼서 화면마다 같은 모양이 된다.

   ```tsx
   <AppearanceProvider className="xtool-sales">
     <ScreenBackground />
     {/* 화면 */}
   </AppearanceProvider>
   ```

   설정 없이 모양을 고정하려면 `ThemeRoot`에 `accent`·`glass`·`theme`·`palette`를 바로 넘긴다.

2. **스타일** — 화면 스타일 맨 앞에서 라이브러리를, 맨 뒤에서 테마를 부른다(테마가 같은 우선순위의 화면
   스타일보다 뒤에 와야 이긴다). 화면 규칙은 자기 루트 클래스 아래에 둔다.

   ```scss
   @use 'sass:meta';
   @use '<상대 경로>/ohq-ui/styles';

   .xtool-sales {
     // 이 화면에만 있는 배치
   }

   @include meta.load-css('<상대 경로>/ohq-ui/styles/themes');
   ```

3. **부품** — 아래 폴더에서 가져다 쓴다. 팝오버·모달을 직접 띄울 때는 `usePortalRoot()`의 루트 안에 띄워야
   토큰(강조색·유리)이 그대로 걸린다.

## 폴더

| 폴더 | 내용 |
|---|---|
| `components/` | Button, GlassCard, Avatar, ConfirmDialog, SegmentedControl, TextField, RangeField, StatCard, StatusPill |
| `charts/` | AreaChart, BarList, ShareBar, LatencyBars, 차트 색(palette) |
| `theme/` | ThemeRoot(루트 `.ohq-ui`·강조색·유리 변수·포털 자리), 강조색·유리·Monday 색 |
| `appearance/` | 외관 설정 — `AppearanceProvider`, `useAppearance()`, 배경 목록 |
| `backgrounds/` | `ScreenBackground`(화면 뒤 고정 배경), `BackgroundArt`(파편·실크·그런지·사진), 파편 그림 생성기 |
| `brand/` | `BrandMark`·`XMark`(xTool X), `GoogleMark` |
| `auth/` | `LoginField` — 로그인 폼 클래스(`.login-form`·`.login-submit`·`.social-button`·`.check`·`.text-link` 등)와 같이 쓴다 |
| `styles/` | 토큰·태그 기본값(`_base`), 믹스인, 부품·격자·차트·배경·로고·로그인 폼 스타일, `themes/`(Monday) |
| `lib/`, `types.ts` | `cx`, 애니메이션 값, 숫자 형식, 포털 자리, 크기 재기, 공통 타입 |
| `lab/` | 디자인 랩 — `UiCatalog`·`CatalogSpec`, 견본 `SHOWCASES`(탭을 열 때만 받는다) |
| `water/` | 물 디자인(D7) 부품 — 아래 "물 부품" |

## 물 부품(`water/`)

참고 영상 D7(`lab/showcase/design7`)의 물·유리 디자인으로 다시 만든 부품. 밝은 회색 유리 벽(`WaterStage`)
위에서 보이게 만들었다. 가져오면(`@/ohq-ui/water`) 스타일도 같이 받는다. 실제 모습은 디자인 화면 "물 · 기본"
탭, 기술팀 보드 전용 물 부품은 "물 · tech" 탭.

- 이름은 `Water` 접두사, props는 같은 일을 하는 기본 부품과 같다(바꿔 끼울 수 있게) + 물에만 있는 옵션.
- 움직임은 D7 영상에서 잰 값을 같이 쓴다 — `motion.ts`(스프링·늘어남·나타남 시간표), `indicator.ts`(고른 것
  뒤 어두운 알약), `fx.ts`(물방울·물결). 매 프레임 React를 다시 그리지 않고 엔진이 rAF로 style을 직접 쓴다.
- 유리는 가만한 상자면 CSS 믹스인(`styles/_tokens.scss`의 `w-glass`·`w-groove`·`w-solid`), 모양이 바뀌면 SVG
  필터(`glass.tsx`). `w-glass`는 같은 k의 필터와 단면이 맞게 보정해 둬서 둘을 바꿔 끼워도 이음매가 없다(테두리
  오프셋은 장치 화소 `--w-dpx`에 맞춘다 — 루트 `.ohq-ui`에 `w-vars`가 CSS 기본값(배율 2 → 0.5px, 1.49 이하 →
  1px)을 건다). 조상 CSS `zoom`·배율 1.25·1.5는 CSS가 모르니 `useWaterDpx`(hooks.ts)가 실제 배율을 읽어
  요소에 다시 건다 — `WaterStage`와 `WaterDialog`(포털 층)는 이미 쓰고, 무대 밖에 따로 띄우는 층(포털 등)은
  그 뿌리 요소에 `ref`를 단다. 크기·배율이 바뀔 때만 재서 가만히 있을 때는 비용이 없다.
- 같이 쓰는 도구 — 새로 만들지 말고 여기서 가져다 쓴다.

  | 어디 | 무엇 |
  |---|---|
  | `motion.ts` | `waterClock`·`since`(누른 시각 → 시작 시각)·`spring`·`springAt`·`springArrival`(처음 닿는 시각)·`springSettle`(제자리 드는 시간)·`animate`·D7 상수 `WATER_*` |
  | `indicator.ts` | `WaterIndicatorEngine` — 옵션 `squash`(옆 찌그러짐 배율, 기본 1)·`onDraw`(그릴 때마다, 같은 프레임) |
  | `fx.ts`·`ripple.ts` | 물방울 `WaterFxEngine`(무리에 `water-fx__rings`·`__drop`·`__splash` 클래스), 누르자마자 퍼지는 물결 `WaterRipple`·`rippleAt`·`pressPoint` — 둘이 같은 고리 그리기(`drawRipple`)를 쓴다 |
  | `reveal.ts` | `revealStagger` — 차례로 나타나기(WAAPI, 21ms 간격 55ms) |
  | `spring-run.ts` | `runSpring` — 스프링 한 번을 WAAPI 키프레임으로(1/240초 간격, 합성 단계라 프레임마다 JS 없음). `sample()`로 움직이는 도중 자리·빠르기를 읽어 다음 움직임을 이어 간다(막대 채움·숫자 굴림·차오름) |
  | `glide.ts` | `WaterGlide` — WAAPI판 표시 알약 미끄러짐(스프링 + 늘어남 28%·옆 0.64배·15ms 지연을 미리 적분, 여러 요소를 한 시간표로). rAF로 매 프레임 쓰는 `WaterIndicatorEngine`보다 싸다(영역 차트 측정: 래스터 67개 14ms → 14개 1.6ms) |
  | `styles/_surfaces.scss` | 공용 클래스 `.water-reveal` + `style="--w-i: 차례"` — CSS만으로 차례로 나타나기(55ms, 21ms 간격, 열두째부터 같이). 누른 시각에 맞춰야 하면 `revealStagger` |
  | `charts/palette.ts` | 차트 색 — `WATER_CATEGORICAL` 6색(회색 벽 위 이웃 쌍 검사 통과 — 쌓은 막대·막대·선, 아무 둘이나 붙는 차트는 앞 3색까지), `waterShareItems()`(넘겨준 순서대로 색, 일곱째부터 "기타" 회색), 빗금은 대비 높이기·인쇄일 때만 |
  | `focus.ts` | `focusablesIn`·`trapTab` — 모달 안 Tab 가두기 |
  | `hooks.ts` | `useWaterIndicator`·`useWaterFx`·`useWaterRipple`·`useReducedMotion`·`useWaterDpx`(장치 화소 `--w-dpx`를 실제 배율로) — 결과는 구조 분해해서 쓴다(React Compiler 규칙) |
  | `styles/_tokens.scss` | `w-spring(이름 \| ζ, ω, $dur)` → (ease, dur) · `w-ease()`·`w-dur()` — D7 스프링을 CSS `linear()`로(이름: move·extend·detach·wobble·gather·swell·trail·indicator), `$w-ease-shade`(1-(1-u)²) |
