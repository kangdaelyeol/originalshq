# ohq-ui — originalshq 공용 디자인

originalshq 화면들이 같이 쓰는 디자인 라이브러리 — 토큰, 테마(유리·Monday), 기본 부품, 차트, 배경, 로고,
로그인 폼 부품, 외관 설정, 디자인 랩(카탈로그·견본 D1~D10).

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
