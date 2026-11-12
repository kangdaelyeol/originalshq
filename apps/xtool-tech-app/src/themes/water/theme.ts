import { PixelRatio, type BoxShadowValue, type TextStyle } from 'react-native';

// 물 디자인(D7) 토큰 — 웹 ohq-ui/water/styles/_tokens.scss·ohq-ui/theme/water.ts의 값을 그대로 옮겼다.
// 값은 영상 D7(표시 알약 높이 50.5px 기준)이라 작은 부품은 k(= 크기 / 50.5)로 줄인다. 그림자는 RN boxShadow(inset·퍼짐
// 지원)로 웹 그림자 목록을 겹 그대로 옮긴다 — 유리는 거의 투명하고 테두리·그림자로만 선다.

// ── 색 ──────────────────────────────────────────────────────────────────────

export const W = {
  /** 무대(벽) — 사선 그러데이션 hi → lo, 가운데 stage */
  stage: '#c7c5ca',
  stageHi: '#e3e1e6',
  stageLo: '#acaaaf',
  /** 벽 타일 격자선(16.5%) */
  line: 'rgba(0, 0, 0, 0.165)',
  /** 글자 — 밝은 벽 위(진함 순) */
  ink: '#3f3e43',
  ink2: '#55545a',
  ink3: '#69676c',
  ink4: '#6f6d72',
  /** 안 고른 칩(반투명 흰 알약 199 → 215) */
  chip: 'rgba(255, 255, 255, 0.28)',
  chipHover: 'rgba(255, 255, 255, 0.42)',
  chipRing: 'rgba(255, 255, 255, 0.35)',
  /** 상태 점 색 — 글자에는 쓰지 않는다(회색 벽 위 대비가 낮다) */
  ok: '#3c8a63',
  warn: '#c08a2e',
  crit: '#c2504a',
  info: '#4a72b8',
  /** 상태 글자 — 벽 위 4.5:1(보드 칸) */
  okInk: '#2c6b4b',
  warnInk: '#7d5a17',
  critInk: '#9e3b36',
  infoInk: '#34588f',
  /** 판 안 가는 선(벽 격자선보다 옅게) */
  rule: 'rgba(0, 0, 0, 0.085)',
  /** 물 화면 줄 사이 선(웹 --line) */
  pageLine: 'rgba(63, 62, 67, 0.12)',
  /** 물 화면 상태 글자(웹 --good·--warn·--crit·--info — 밝은 벽 위 4.5:1) */
  pageGood: '#285c41',
  pageWarn: '#6e4b0e',
  pageCrit: '#8f2f2b',
  pageInfo: '#2d4c80',
  /** 옅은 흰 줄(내 업무·일정 줄)과 누름 */
  rowFill: 'rgba(255, 255, 255, 0.2)',
  rowFillPressed: 'rgba(255, 255, 255, 0.36)',
  /** 기록 표 가리킨 줄 */
  rowHover: 'rgba(255, 255, 255, 0.16)',
  /** 어두운 알약 위 흰 칩 바탕 */
  onDarkFill: 'rgba(255, 255, 255, 0.14)',
  /** 작은 동그라미 단추 누름(닫기·지우기) */
  pressFill: 'rgba(255, 255, 255, 0.4)',
  /** 글자 링크 밑줄 — 옅게·진하게 */
  linkLine: 'rgba(63, 62, 67, 0.28)',
  linkLineStrong: 'rgba(63, 62, 67, 0.55)',
  /** 보드 이름 칩(내 업무 줄) */
  boardChip: 'rgba(63, 62, 67, 0.07)',
  /** 0건 점 */
  dotIdle: 'rgba(0, 0, 0, 0.18)',
  /** 답글 왼쪽 선 */
  replyLine: 'rgba(63, 62, 67, 0.14)',
  /** 떠 있는 고르기 막대 바탕(벽 밝기로 거의 불투명) */
  floatFill: 'rgba(214, 212, 217, 0.94)',
  /** 사진 아바타 바탕 */
  photoBack: '#b9b7bc',
  /** 어두운 알약 위 흐린 글자 */
  onDark2: 'rgba(255, 255, 255, 0.72)',
  /** 초점·누름 흰 고리 */
  ring: 'rgba(255, 255, 255, 0.85)',
  /** 대화상자·서랍 막 */
  scrim: 'rgba(38, 36, 42, 0.34)',
  drawerScrim: 'rgba(32, 31, 35, 0.34)',
  /** 막대 "기타"·무채 회색 */
  other: '#7c7a80',
  /** 1위 왕관(장식) */
  gold: '#f2c766',
} as const;

/** 숫자 카드 아이콘 색(장식) — 회색 벽에 맞춰 채도를 낮춘 상태 점 색 계열 */
export const W_TINT = { blue: W.info, violet: '#6f5fae', green: W.ok, amber: W.warn } as const;

/** 범주 색(막대 여럿) — 웹 charts/palette.ts WATER_CATEGORICAL */
export const W_CATEGORICAL = ['#2b5991', '#803c1a', '#357a47', '#5d5294', '#806504', '#822f5c'] as const;

// ── 색 계산 ──────────────────────────────────────────────────────────────────

export const isHexColor = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

export function hexToRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

const toHex = (v: number) =>
  Math.round(Math.min(255, Math.max(0, v)))
    .toString(16)
    .padStart(2, '0');

/** a에서 b로 t만큼(0~1) 섞는다(sRGB 단순 혼합 — 웹 accent.ts mixHex와 같다) */
export function mixHex(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return `#${toHex(r1 + (r2 - r1) * t)}${toHex(g1 + (g2 - g1) * t)}${toHex(b1 + (b2 - b1) * t)}`;
}

/** 육각 색 + 불투명도 → rgba() */
export function alpha(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// ── 물 설정(웹 theme/water.ts와 같은 값·모양) ─────────────────────────────────────

/** 벽(무대) 색조 — 밝은 쪽만(벽 위 글자가 잉크색이라) */
export type WaterWall = 'grey' | 'bright' | 'warm' | 'cool' | 'deep';

export const WATER_WALLS: readonly { value: WaterWall; label: string; description: string; hi: string; lo: string }[] =
  [
    { value: 'grey', label: '기본', description: '처음 설정 — 연회색 타일', hi: '#e3e1e6', lo: '#acaaaf' },
    { value: 'bright', label: '밝게', description: '하얗게 밝은 벽', hi: '#efeef2', lo: '#c2c0c6' },
    { value: 'warm', label: '따뜻하게', description: '베이지 빛이 도는 벽', hi: '#e8e2d9', lo: '#b2aa9f' },
    { value: 'cool', label: '차갑게', description: '푸른 빛이 도는 벽', hi: '#dfe4ea', lo: '#a7afb8' },
    { value: 'deep', label: '짙게', description: '조금 어두운 회색 벽', hi: '#d5d3d8', lo: '#a3a1a6' },
  ];

/** 강조색 견본 — null은 D7 잉크(기본). 흰 글자가 얹히니 어두운 단계로 칠한다 */
export const WATER_ACCENTS: readonly { value: string | null; label: string }[] = [
  { value: null, label: '잉크(기본)' },
  { value: '#3b5b8c', label: '남색' },
  { value: '#2f7a6a', label: '청록' },
  { value: '#3f7a3a', label: '숲' },
  { value: '#7a4b8c', label: '자두' },
  { value: '#a14a3c', label: '벽돌' },
  { value: '#9a7228', label: '황토' },
];

/** 판 색 — 불투명 판(서랍·팝업·알림)의 바탕 */
export type WaterPane = 'grey' | 'wall' | 'white';

export const WATER_PANES: readonly { value: WaterPane; label: string }[] = [
  { value: 'grey', label: '기본 회색' },
  { value: 'wall', label: '벽 색 따라' },
  { value: 'white', label: '흰빛' },
];

export interface WaterSettings {
  wall: WaterWall;
  /** null — D7 잉크 */
  accent: string | null;
  /** 떨어지는 그림자(띄움) 배수 — 1 = 기본 */
  depth: number;
  /** 유리 가장자리(테두리·안쪽 그림자) 진하기 배수 — 1 = 기본 */
  rim: number;
  pane: WaterPane;
  /** 유리 농도 — 판에 덮는 흰빛(0 = D7 그대로) */
  frost: number;
  /** 벽 아래 깔 사진(팀이 공유한 사진 id) — 앱은 아직 그리지 않고 값만 지킨다(웹과 같은 저장 모양) */
  photoId: string | null;
}

export const WATER_DEFAULT: WaterSettings = {
  wall: 'grey',
  accent: null,
  depth: 1,
  rim: 1,
  pane: 'grey',
  frost: 0,
  photoId: null,
};

export const WATER_LIMITS = {
  depth: { min: 0, max: 1.6, step: 0.1 },
  rim: { min: 0.4, max: 1.6, step: 0.1 },
  frost: { min: 0, max: 0.6, step: 0.05 },
} as const;

export type WaterPreset = 'crisp' | 'default' | 'soft' | 'flat';

export const WATER_PRESETS: readonly {
  value: WaterPreset;
  label: string;
  description: string;
  depth: number;
  rim: number;
}[] = [
  { value: 'crisp', label: '또렷하게', description: '테두리가 진하고 높이 떠요', depth: 1.4, rim: 1.4 },
  { value: 'default', label: '기본', description: '처음 설정', depth: 1, rim: 1 },
  { value: 'soft', label: '은은하게', description: '테두리가 옅고 낮게 떠요', depth: 0.6, rim: 0.7 },
  { value: 'flat', label: '평평하게', description: '그림자 없이 벽에 붙어요', depth: 0, rim: 0.6 },
];

const clamp = (v: number, { min, max }: { min: number; max: number }) => Math.min(max, Math.max(min, v));

/** 저장소에서 읽은 값 다듬기 — 모르는 값이면 기본값·경계값으로(웹 normalizeWater와 같다) */
export function normalizeWater(raw: unknown): WaterSettings {
  const input = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<Record<keyof WaterSettings, unknown>>;
  const num = (key: 'depth' | 'rim' | 'frost') => {
    const v = input[key];
    return typeof v === 'number' && Number.isFinite(v) ? clamp(v, WATER_LIMITS[key]) : WATER_DEFAULT[key];
  };
  return {
    wall: WATER_WALLS.some(w => w.value === input.wall) ? (input.wall as WaterWall) : WATER_DEFAULT.wall,
    accent: isHexColor(input.accent) ? input.accent.toLowerCase() : null,
    depth: num('depth'),
    rim: num('rim'),
    pane: WATER_PANES.some(p => p.value === input.pane) ? (input.pane as WaterPane) : WATER_DEFAULT.pane,
    frost: num('frost'),
    photoId: typeof input.photoId === 'string' && input.photoId ? input.photoId : null,
  };
}

/** 지금 깊이·테두리가 어느 프리셋과 같은지 — 없으면 null(사용자 지정) */
export function matchWaterPreset(w: Pick<WaterSettings, 'depth' | 'rim'>): WaterPreset | null {
  return WATER_PRESETS.find(p => Math.abs(p.depth - w.depth) < 0.05 && Math.abs(p.rim - w.rim) < 0.05)?.value ?? null;
}

/** 고른 것 알약 단계 — 위가 밝고 아래가 어두운 그러데이션(D7 #555358 → #2b292e와 같은 결) */
export function waterAccentStops(accent: string) {
  return {
    dark1: mixHex(accent, '#000000', 0.18),
    dark2: mixHex(accent, '#000000', 0.55),
    chip1: mixHex(accent, '#000000', 0.08),
    chip2: mixHex(accent, '#000000', 0.38),
    chip3: mixHex(accent, '#000000', 0.48),
  };
}

// 불투명 판 D7 값 — board/_base.scss $wb-fill(150deg 203 → 189)
const SOLID_HI = '#cbc9ce';
const SOLID_LO = '#bdbbc0';

/** 판 색 — 불투명 판의 그러데이션 두 단계와 투명한 유리 몸 바탕(웹 waterPaneColors와 같다) */
export function waterPaneColors(w: Pick<WaterSettings, 'wall' | 'pane' | 'frost'>) {
  const wall = WATER_WALLS.find(o => o.value === w.wall) ?? WATER_WALLS[0];
  let hi = SOLID_HI;
  let lo = SOLID_LO;
  if (w.pane === 'wall') {
    hi = mixHex(SOLID_HI, wall.hi, 0.45);
    lo = mixHex(SOLID_LO, wall.lo, 0.45);
  } else if (w.pane === 'white') {
    hi = '#e7e6ea';
    lo = '#d8d7db';
  }
  if (w.frost > 0) {
    hi = mixHex(hi, '#ffffff', w.frost * 0.5);
    lo = mixHex(lo, '#ffffff', w.frost * 0.5);
  }
  return { solidHi: hi, solidLo: lo, glass: w.frost > 0 ? `rgba(255, 255, 255, ${w.frost})` : 'rgba(0, 0, 0, 0.026)' };
}

// ── 지금 설정으로 푼 팔레트 ──────────────────────────────────────────────────────

export interface WaterPalette {
  settings: WaterSettings;
  /** 벽 색조 */
  wallHi: string;
  wallLo: string;
  /** 벽 가운데 밝기 — 화면 바탕(무대가 그려지기 전·끝까지 당겼을 때) */
  stageMid: string;
  /** 고른 것 어두운 알약(D7 indicator) 위 → 아래 */
  dark1: string;
  dark2: string;
  /** 어두운 칩·주 버튼(D7 고른 칩) 세 단계 */
  chip1: string;
  chip2: string;
  chip3: string;
  /** 불투명 판(서랍·토스트·대화상자) 그러데이션 */
  solidHi: string;
  solidLo: string;
  /** 투명한 유리 몸 바탕 */
  pane: string;
  /** 테두리·그림자 배수(설정) */
  rim: number;
  depth: number;
}

export function makePalette(settings: WaterSettings): WaterPalette {
  const wall = WATER_WALLS.find(o => o.value === settings.wall) ?? WATER_WALLS[0];
  const stops = settings.accent
    ? waterAccentStops(settings.accent)
    : { dark1: '#555358', dark2: '#2b292e', chip1: '#605e63', chip2: '#3f3d42', chip3: '#353338' };
  const pane = waterPaneColors(settings);
  return {
    settings,
    wallHi: wall.hi,
    wallLo: wall.lo,
    stageMid: wall.value === 'grey' ? W.stage : mixHex(wall.hi, wall.lo, 0.6),
    ...stops,
    solidHi: pane.solidHi,
    solidLo: pane.solidLo,
    pane: pane.glass,
    rim: settings.rim,
    depth: settings.depth,
  };
}

// ── 그러데이션(RN backgroundImage — CSS와 같은 글) ────────────────────────────────

/** 고른 것 어두운 알약(D7 indicator) */
export const darkFill = (p: WaterPalette) => `linear-gradient(180deg, ${p.dark1}, ${p.dark2})`;
/** 어두운 칩·주 버튼 */
export const darkChipFill = (p: WaterPalette) =>
  `linear-gradient(180deg, ${p.chip1} 0%, ${p.chip2} 92%, ${p.chip3} 100%)`;
/** 붉은 알약(지우기) */
export const DANGER_FILL = 'linear-gradient(180deg, #c45f59 0%, #a2403b 92%, #96382f 100%)';
/** 대화상자 위험 아이콘 */
export const DANGER_ICON_FILL = 'linear-gradient(180deg, #c45f59, #96382f)';
/** 불투명 판 속(wb-fill) — 왼쪽 위가 밝은 사선 */
export const paneFill = (p: WaterPalette) => `linear-gradient(150deg, ${p.solidHi}, ${p.solidLo})`;
/** 대화상자 유리 판 — 벽 조각(밝은 사선) */
export const DIALOG_FILL = 'linear-gradient(135deg, #e5e3e8, #cbc9ce)';
/** 불투명 유리 단추 속(w-solid) — 가운데 194 → 가장자리 181. 알약은 ellipse */
export const solidFill = (shape: 'circle' | 'ellipse' = 'circle') =>
  `radial-gradient(${shape} closest-side, #c2c0c5 0%, #bcbabf 70%, #b9b7bc 85%, #b5b3b8 100%)`;
/** 색 막대 채움 — 위가 밝고 아래가 짙은 알약(웹 w-fill-color) */
export const colorFill = (c: string) =>
  `linear-gradient(180deg, ${mixHex(c, '#ffffff', 0.2)} 0%, ${c} 55%, ${mixHex(c, '#000000', 0.22)} 100%)`;
/** 사람 색이 물든 유리 구슬(아바타) */
export const avatarFill = (c: string) =>
  `radial-gradient(circle closest-side, ${mixHex('#c2c0c5', c, 0.74)} 0%, ${mixHex('#bcbabf', c, 0.8)} 70%, ${mixHex(
    '#78767b',
    c,
    0.86,
  )} 100%)`;

// ── 그림자(웹 믹스인 → boxShadow 겹) ──────────────────────────────────────────────

/** 장치 화소 한 칸 — 유리 테두리 오프셋을 화소에 맞춘다(웹 --w-dpx: 폰 배율 3 → 1/3) */
const DPX = 1 / PixelRatio.get();
const snap = (v: number) => Math.round(v / DPX) * DPX;
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const black = (a: number) => `rgba(0, 0, 0, ${r3(Math.min(1, a))})`;
const white = (a: number) => `rgba(255, 255, 255, ${r3(Math.min(1, a))})`;
const sh = (x: number, y: number, blur: number, spread: number, color: string, inset = false): BoxShadowValue => ({
  offsetX: r3(x),
  offsetY: r3(y),
  blurRadius: r3(blur),
  spreadDistance: r3(spread),
  color,
  inset,
});

/**
 * 유리 상자(w-glass) — 테두리·안쪽 그림자 7겹(rim 배수) + 떨어지는 그림자 2겹(lift·depth 배수, 1 아래면 진하기도).
 * lift: 카드 0.3 · 홀로 선 판 0.55 · 판 안의 판 0 · 서랍 1.
 */
export function glassShadow(p: Pick<WaterPalette, 'rim' | 'depth'>, k = 1, lift = 1): BoxShadowValue[] {
  const rim = p.rim;
  const list: BoxShadowValue[] = [
    sh(0, 0, k, 0, white(0.35 * rim), true),
    sh(-2.8, -2.8, 0, -2.55, black(0.14 * rim), true),
    sh(snap(1.7 * k), snap(1.9 * k), 1.1 * k, 0, black(0.62 * rim), true),
    sh(0, 0, 0, Math.max(1, k), black(0.24 * rim), true),
    sh(snap(-3.4 * k), snap(-3.4 * k), 1.4 * k, 0, white(0.9 * rim), true),
    sh(snap(-2 * k), snap(-5.5 * k), 2.8 * k, 0, white(0.3 * rim), true),
    sh(7 * k, 13 * k, 16 * k, 0, black(0.24 * rim), true),
  ];
  const s = k * lift * p.depth;
  if (s > 0) {
    const fade = Math.min(1, lift) * p.depth;
    list.push(sh(21 * s, 44 * s, 36 * s, 20 * s, black(0.27 * fade)), sh(0, 0, 24 * s, 0, black(0.13 * fade)));
  }
  return list;
}

/** 홈(w-groove) — 유리 안에 파인 길. 바탕은 GROOVE_FILL */
export const GROOVE_FILL = 'rgba(0, 0, 0, 0.12)';
export function grooveShadow(k = 1): BoxShadowValue[] {
  return [
    sh(0, 2 * k, 0, 0, black(0.3), true),
    sh(0, 0, 0, 1.4 * k, black(0.16), true),
    sh(0, 5 * k, 6 * k, 0, black(0.05), true),
  ];
}

/** 불투명 유리 단추 속(w-solid) 테두리·안쪽 그림자 — 바탕은 solidFill */
export function solidShadow(k = 1): BoxShadowValue[] {
  return [
    sh(-3.4 * k, -3.4 * k, 1.8 * k, 0, white(0.9), true),
    sh(1.5 * k, 1.7 * k, 0.6 * k, 0, black(0.45), true),
    sh(0, 0, 0.5 * k, 0.5 * k, black(0.15), true),
    sh(-5.5 * k, -5.5 * k, 3.5 * k, -1 * k, white(0.18), true),
    sh(10 * k, 11 * k, 14 * k, 1 * k, black(0.14), true),
  ];
}

/** 떨어지는 그림자만(wc-drop) — 불투명 유리 단추 뒤 */
export function dropShadow(k = 1): BoxShadowValue[] {
  return [sh(21 * k, 44 * k, 36 * k, 20 * k, black(0.27)), sh(0, 0, 24 * k, 0, black(0.13))];
}

/** 고른 것 어두운 알약 둘레 그림자(D7 0 0.35em 0.8em 26%) — em은 기준 글자 크기 */
export const indicatorShadow = (em = 10): BoxShadowValue[] => [sh(0, 0.35 * em, 0.8 * em, 0, black(0.26))];

/** 긴 글 칸(wb-well) — 바탕 WELL_FILL */
export const WELL_FILL = 'rgba(255, 255, 255, 0.3)';
export const WELL_SHADOW: BoxShadowValue[] = [
  sh(0, 2, 0, 0, black(0.17), true),
  sh(0, 0, 0, 1.2, black(0.15), true),
  sh(0, 5, 6, 0, black(0.05), true),
];

/** 아바타 유리 테두리(k = 지름 / 121 × 1.4) */
export function avatarRim(d: number): BoxShadowValue[] {
  const k = (d / 121) * 1.4;
  return [
    sh(-3.4 * k, -3.4 * k, 1.8 * k, 0, white(0.75), true),
    sh(1.5 * k, 1.7 * k, 0.6 * k, 0, black(0.4), true),
    sh(0, 0, 0.5 * k, 0.5 * k, black(0.15), true),
    sh(10 * k, 11 * k, 14 * k, 1 * k, black(0.12), true),
  ];
}

/** 초점·누름 흰 2px 고리 */
export const FOCUS_RING: BoxShadowValue[] = [sh(0, 0, 0, 2, W.ring)];

/** 상태 점 유리구슬(아래 어둡게·위 밝게) */
export const DOT_SHADOW: BoxShadowValue[] = [
  sh(0, -1, 1.2, 0, black(0.22), true),
  sh(0, 0.8, 0.8, 0, white(0.35), true),
];

/** 그림자 하나 — 부품마다 따로 적는 값(웹 값 그대로) */
export const shadow = sh;

// ── 글자 ────────────────────────────────────────────────────────────────────

/**
 * 글자 모양 — 웹 물은 시스템 글꼴(-apple-system … Apple SD Gothic Neo)이라 앱도 fontFamily 없이 iOS 시스템 글꼴
 * (SF·한글 SD 고딕)로 쓴다. 굵기는 CSS 값 그대로(650 → '600'). letterSpacing은 em(글자 크기 배수).
 */
export type WWeight = '400' | '500' | '600' | '700' | '800';

export const wtype = (size: number, weight: WWeight = '500', em = 0, extra: TextStyle = {}): TextStyle => ({
  fontSize: size,
  fontWeight: weight,
  ...(em ? { letterSpacing: r3(em * size) } : null),
  ...extra,
});

/** 어두운 알약 위 흰 글자 그림자(D7 0 0.06em 0.12em 28%) — RN 글자 그림자는 한 겹이라 진한 겹만 */
export const onDarkText = (size: number): TextStyle => ({
  color: '#ffffff',
  textShadowColor: 'rgba(0, 0, 0, 0.28)',
  textShadowOffset: { width: 0, height: r3(0.06 * size) },
  textShadowRadius: r3(0.12 * size),
});

// ── 움직임(웹 motion.ts) ─────────────────────────────────────────────────────────

/** 감쇠 스프링 — zeta 감쇠비, omega 고유진동수(rad/s) */
export interface SpringSpec {
  zeta: number;
  omega: number;
}

/** D7에서 잰 스프링 */
export const WATER_SPRING = {
  /** 자리를 옮김(3.8% 넘침) */
  move: { zeta: 0.72, omega: 26 },
  /** 뻗어 나감(16% 넘침) */
  extend: { zeta: 0.5, omega: 34 },
  /** 떨어져 나감 */
  detach: { zeta: 0.45, omega: 36 },
  /** 출렁임(누름) */
  wobble: { zeta: 0.3, omega: 46 },
  /** 다시 붙음 */
  gather: { zeta: 0.6, omega: 47 },
  /** 부풂(뗌) */
  swell: { zeta: 0.35, omega: 20 },
  /** 꼬리(임계 감쇠) */
  trail: { zeta: 1, omega: 24 },
  /** 고른 표시 알약(7% 넘침) */
  indicator: { zeta: 0.65, omega: 30.5 },
} as const satisfies Record<string, SpringSpec>;

/** Reanimated withSpring 설정 — 질량 1이면 강성 ω², 감쇠 2ζω(같은 물리). 남은 흔들림 기준은 웹 settle(1/2000)에 가깝게 */
export const springConfig = ({ zeta, omega }: SpringSpec) => ({
  mass: 1,
  stiffness: omega * omega,
  damping: 2 * zeta * omega,
});

/** 표시 알약이 달릴 때 늘어남 — 가로 최대 28%·옆은 0.64배만큼 준다, 15ms 늦게 따라간다 */
export const WATER_STRETCH = { max: 0.28, perSpeed: 0.134, squash: 0.64, lag: 0.015 } as const;

/** 차례로 나타나는 시간표(초) — 표시 알약 진해짐 0.1, 항목 55ms씩 21ms 간격, 사라짐 30ms */
export const WATER_REVEAL = { indicator: 0.1, fade: 0.055, stagger: 0.021, label: 0.075, out: 0.03 } as const;

/** 스프링이 처음 목표에 닿는 시각(초) — extend 0.071 · move 0.132 */
export function springArrival({ zeta, omega }: SpringSpec): number {
  if (zeta >= 1) return Infinity;
  return (Math.PI - Math.acos(zeta)) / (omega * Math.sqrt(1 - zeta * zeta));
}

/** 스프링이 제자리에 드는 시간(초) — 처음 거리의 1/2000 */
export const springSettle = ({ zeta, omega }: SpringSpec): number => Math.log(2000) / (Math.min(1, zeta) * omega);

/** 0.1s ease-out(웹 $w-quick) */
export const QUICK_MS = 100;
