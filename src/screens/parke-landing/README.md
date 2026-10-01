# Parké 랜딩 페이지

`Parke_Developer_Handoff_v29_20260929/source` (Next.js 디렉터리 구조 + Vinext 실행,
Tailwind 4, Cloudflare Workers/D1) 를 이 프로젝트의 React + TypeScript + Vite +
react-router 구조로 옮긴 것입니다.

- 경로: `/parke` (랜딩), `/parke/reservation` (예약 취소)
- 레이아웃: `src/pages/parke-page.tsx`
- 라우터 등록: `src/router/index.tsx` (lazy — CSS가 270KB대라 다른 라우트에
  얹지 않습니다)

기존 `src/screens/parke` 는 QR 관리용 어드민 화면으로, 이 화면과 무관합니다.

## 옮기면서 바뀐 것

| 원본 | 이곳 |
| --- | --- |
| `app/layout.tsx` 의 `metadata`, `next/font/google` Geist | `pages/parke-page.tsx` 에서 `document.title`·meta·폰트 `<link>` 를 마운트 시 주입하고 언마운트 시 되돌립니다 |
| `app/page.tsx` → `ParkeLaunch` | `screens/parke-landing/index.tsx` |
| `app/reservation/page.tsx` | `screens/parke-landing/reservation-cancel.tsx` (`useSearchParams`/`useLocation` 사용) |
| Tailwind 4 + `@base-ui/react` + shadcn UI | `components/ui/*` 에 의존성 없이 재구현. 원본 CSS가 `[data-slot=...]` 로 스타일을 걸고 있어 같은 slot·상태 속성을 그대로 내보냅니다 |
| `artifacts/legacy-film.css` (Tailwind preflight + shadcn 토큰 로딩용) | `styles/base.css` — preflight와 토큰 중 이 페이지가 실제로 쓰는 부분만 `.parke-page` 스코프로 다시 정의 |
| `app/*.css` | `styles/*.css` — 내용은 그대로, 모든 셀렉터를 `.parke-page` 하위로 스코프 |
| embla carousel | 그대로 (`embla-carousel-react` 설치) |

### CSS 스코프

이 앱은 CSS가 전역으로 번들되고 `src/reset.scss` (Meyer reset) 가 이미 전역에
깔려 있습니다. 그래서 랜딩 CSS는 전부 `.parke-page` 하위로 스코프했고,
`:root`/`html`/`body` 규칙은 `.parke-page` 자체로 옮겼습니다. 반대로 Meyer reset이
지우는 것(`em` 기울임, `small` 크기, `summary` 마커 등) 중 원본이 Tailwind
preflight에서 기대하던 것은 `styles/base.css` 에서 되살립니다.

원본 CSS를 다시 받아 갱신할 때는 같은 스코프 처리를 다시 해야 합니다.
`styles/index.css` 의 import 순서는 원본 `app/layout.tsx` 와
`app/globals.css` 의 `@import` 체인 순서를 그대로 따릅니다 — 파일끼리 서로
덮어쓰므로 순서를 바꾸면 안 됩니다.

## 아직 남은 일

### 1. 이미지·영상 자산

전부 `public/` 아래 절대 경로로 참조합니다. 아래 파일이 있어야 합니다.

**단품 이미지**

```
public/images/brand/intro-poster.jpg
public/images/brand/product-studio.webp
public/images/brand/internal.webp
public/images/brand/package.webp
public/images/comparison/02-forgot-manual.webp
public/images/comparison/02-forgot-parke.webp
public/images/comparison/03-parked-parke.webp
public/images/comparison/04-next-parke.webp
public/images/engraving-v29/front-blank.webp
public/images/parke-scan.png
public/images/premium-v27/gallery-signature.webp
public/images/premium-v27/gallery-detail.webp
public/images/premium-v27/gallery-dashboard.webp
public/images/premium-v27/package-offer.webp
public/images/story-v26/beauty.webp
public/images/story-v26/boarding-connect.webp
public/images/story-v26/device-phone-studio.webp
public/images/story-v26/today-manual.webp
public/images/story-v26/yesterday-exit.webp
```

**인트로 스크롤 시퀀스** (`utils/scroll-sequence.ts`, `components/original-360-hero.tsx`)

스프라이트 시트입니다. `desktop`, `mobile` 두 프로필 모두 필요합니다.

```
public/media/parke-scroll-v28/{desktop,mobile}/00.webp … 05.webp   (모션 6장, 8열 × 48칸)
public/media/parke-scroll-v25/{desktop,mobile}/000.webp … 137.webp (디테일 138장, 2열 × 4칸)
```

시트가 없으면 캔버스는 비고 `intro-poster.jpg` 포스터가 남습니다. 헤더의
일시정지 버튼(움직임 없이 보기)을 누르면 시퀀스 대신 `product-studio.webp`
정지 컷을 씁니다.

### 2. 예약 API

`components/reservation.tsx` 와 `reservation-cancel.tsx` 가
`POST`/`DELETE /api/reservations` 를 그대로 호출합니다. 원본은 Cloudflare D1
바인딩(`DB`)에 저장했고 (`source/app/api/reservations/route.ts`,
`source/db/`), 이 프로젝트에는 아직 백엔드가 없습니다.

지금은 요청이 SPA fallback(`public/_redirects`)에 걸려 HTML을 돌려주므로,
JSON 파싱 실패를 잡아 한국어 안내 문구를 보여주도록만 해 뒀습니다.
Firebase Functions 등으로 붙일 때는 원본 라우트의 계약을 맞추면 됩니다.

- `POST` 요청: `{ name, phone, engraving, consent, requestKey }`
- `POST` 응답: `{ id, key }` (접수 번호 / 취소 키)
- `DELETE` 요청: `{ id, key }`
- 실패: `{ error }` + non-2xx

접수증에 적히는 취소 링크는 `/parke/reservation?id=<id>#<key>` 입니다.
