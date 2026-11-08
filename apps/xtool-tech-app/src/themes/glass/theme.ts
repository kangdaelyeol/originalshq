import type { TextStyle, ViewStyle } from 'react-native';
import type { KpiTint, KpiTone } from '@xtool-core/board-kpis';

// 글라스 — 웹 기술팀 보드의 기본 "대시보드" 유리 디자인. 값은 웹 src/ohq-ui(styles/_base·_mixins·_components,
// theme/glass.ts·accent.ts)와 화면 스타일(src/screens/xtool-tech/styles)에서 그대로 옮겼다. 유리 디자인은 어두운
// 것 하나뿐이다(밝게/어둡게·팔레트는 Monday에만 있다).

// ── 색 ─────────────────────────────────────────────────────────────────────────────────────────────────

export const T = {
  bg: '#050506',
  text1: 'rgba(255, 255, 255, 0.94)',
  text2: 'rgba(255, 255, 255, 0.7)',
  text3: 'rgba(255, 255, 255, 0.52)',
  text4: 'rgba(255, 255, 255, 0.45)',
  line: 'rgba(255, 255, 255, 0.065)',
  white: '#ffffff',
  good: '#4ade80',
  warn: '#fbbf24',
  crit: '#f87171',
  info: '#60a5fa',
  /** 확인 모달 위험 단추(웹 .confirm__danger) */
  danger: '#dc4c5c',
  /** 펼친 목록 바탕(웹 .multi-select__list) */
  pop: 'rgba(24, 25, 29, 0.98)',
  /** 서랍 뒤 막(웹 .drawer-scrim) */
  scrim: 'rgba(0, 0, 0, 0.38)',
  /** 확인 모달 막(웹 .confirm) */
  scrimStrong: 'rgba(0, 0, 0, 0.5)',
  /** 막대 색 — 웹 charts SERIES_PRIMARY */
  series: '#3a9ae6',
  /** 사이드바 접기 단추·고른 견본 틈(웹 .swatch.is-selected) */
  cardGap: '#121316',
} as const;

/** 반경 — 판 18, 칸·단추 10, 서랍 20, 토스트 14, 고르기 막대 16 */
export const RADIUS = { card: 18, control: 10, drawer: 20, toast: 14, bar: 16 } as const;

/** 판 사이 간격(웹 --gap) · 화면 좌우 여백(웹 ≤720px .shell padding) */
export const GAP = 20;
export const EDGE = 12;

// ── 글자 ───────────────────────────────────────────────────────────────────────────────────────────────
// 웹은 Pretendard(CDN)를 쓴다. 앱에는 없어서 iOS 시스템 글꼴(SF + Apple SD Gothic Neo — Pretendard가 본뜬 글꼴)로
// 그린다. 굵기는 fontWeight, 글자 사이는 웹 em 값을 pt로 바꿔 쓴다.

export type Weight = 400 | 500 | 600 | 700 | 800;

/** 글자 모양 — 크기·굵기 + 웹 letter-spacing(em)·line-height(배수) */
export const font = (size: number, weight: Weight = 400, opts: { ls?: number; lh?: number } = {}): TextStyle => ({
  fontSize: size,
  fontWeight: String(weight) as TextStyle['fontWeight'],
  ...(opts.ls !== undefined ? { letterSpacing: round(size * opts.ls, 3) } : {}),
  ...(opts.lh !== undefined ? { lineHeight: Math.round(size * opts.lh) } : {}),
});

/** 숫자 폭 고정(웹 font-variant-numeric: tabular-nums) */
export const TABULAR: TextStyle = { fontVariant: ['tabular-nums'] };
/** 고정폭 글꼴(웹 --font-mono) */
export const MONO = 'Menlo';

/** 작은 구역 이름(웹 label-caps) — 11/600, 0.06em, text-4 */
export const LABEL_CAPS: TextStyle = { ...font(11, 600, { ls: 0.06 }), color: T.text4 };

// ── 판 모양(웹 _mixins.scss) ─────────────────────────────────────────────────────────────────────────────

/** 판 안의 오목한 칸 — 검색창·입력칸·탭 묶음(웹 well) */
export const WELL: ViewStyle = {
  backgroundColor: 'rgba(0, 0, 0, 0.24)',
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.06)',
};

/** 판 안의 볼록한 칸 — 고른 메뉴·탭·아이콘 칸(웹 raised) */
export const RAISED: ViewStyle = {
  backgroundColor: 'rgba(255, 255, 255, 0.075)',
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.1)',
  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',
};

/** 유리 판 위 빛 — 150deg 흰 그라데이션(웹 glass 믹스인의 첫 바탕 층) */
export const GLASS_SHEEN =
  'linear-gradient(150deg, rgba(255, 255, 255, 0.075) 0%, rgba(255, 255, 255, 0.022) 42%, rgba(255, 255, 255, 0.045) 100%)';
/** 유리 판 아래 그림자(웹 0 24px 48px -24px) — 판 안으로는 번지지 않는다 */
export const GLASS_DROP = '0 24px 48px -24px rgba(0, 0, 0, 0.75)';

/** 유리 판 칠 — rgba(22, 23, 27, 농도) */
export const glassTint = (opacity: number): string => `rgba(22, 23, 27, ${round(Math.min(1, opacity), 4)})`;
/** 가장자리 빛 테두리 — 0.085 × 테두리 빛 */
export const glassRim = (rim: number): string => `rgba(255, 255, 255, ${round(0.085 * rim, 4)})`;
/** 위쪽 안쪽 빛 1px — 0.07 × 테두리 빛 */
export const glassInset = (rim: number): string => `inset 0 1px 0 rgba(255, 255, 255, ${round(0.07 * rim, 4)})`;

// ── 상태 색·아이콘 칸 색조 ───────────────────────────────────────────────────────────────────────────────

export type Tone = KpiTone;

/** 알약·배지 색(웹 .pill--*, .delta--*) — 글자, 바탕, 테두리 */
export const TONE: Record<Tone, { color: string; bg: string; border: string }> = {
  good: { color: T.good, bg: 'rgba(74, 222, 128, 0.1)', border: 'rgba(74, 222, 128, 0.26)' },
  warn: { color: T.warn, bg: 'rgba(251, 191, 36, 0.1)', border: 'rgba(251, 191, 36, 0.26)' },
  crit: { color: T.crit, bg: 'rgba(248, 113, 113, 0.1)', border: 'rgba(248, 113, 113, 0.26)' },
  info: { color: T.info, bg: 'rgba(96, 165, 250, 0.1)', border: 'rgba(96, 165, 250, 0.26)' },
  neutral: { color: T.text2, bg: 'rgba(255, 255, 255, 0.06)', border: 'rgba(255, 255, 255, 0.12)' },
};

/** 숫자 카드 아이콘 칸(웹 .icon-chip--*) */
export const TINT: Record<KpiTint, { color: string; bg: string; border: string }> = {
  blue: { color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.12)', border: 'rgba(96, 165, 250, 0.28)' },
  violet: { color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.12)', border: 'rgba(167, 139, 250, 0.28)' },
  green: { color: '#4ade80', bg: 'rgba(74, 222, 128, 0.1)', border: 'rgba(74, 222, 128, 0.26)' },
  amber: { color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.1)', border: 'rgba(251, 191, 36, 0.26)' },
};

// ── 강조색(웹 theme/accent.ts) ───────────────────────────────────────────────────────────────────────────

export const DEFAULT_ACCENT = '#00c767';

export const ACCENT_PRESETS: readonly { value: string; label: string }[] = [
  { value: '#00c767', label: 'xTool 그린' },
  { value: '#3b82f6', label: '블루' },
  { value: '#8b5cf6', label: '바이올렛' },
  { value: '#ec4899', label: '핑크' },
  { value: '#f97316', label: '오렌지' },
  { value: '#06b6d4', label: '시안' },
  { value: '#84cc16', label: '라임' },
  { value: '#eab308', label: '골드' },
];

export const isHexColor = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toHex = (v: number) =>
  Math.round(Math.min(255, Math.max(0, v)))
    .toString(16)
    .padStart(2, '0');

/** a에서 b로 t만큼(0~1) 섞는다(sRGB 단순 혼합 — 웹 mixHex와 같다) */
export function mixHex(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return `#${toHex(r1 + (r2 - r1) * t)}${toHex(g1 + (g2 - g1) * t)}${toHex(b1 + (b2 - b1) * t)}`;
}

/** 색에 불투명도 — 웹 rgba(var(--accent-rgb), a) */
export const alpha = (hex: string, a: number): string => `rgba(${hexToRgb(hex).join(', ')}, ${a})`;

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export interface AccentPalette {
  accent: string;
  /** 밝은 단계 — 버튼 위쪽·강조 글자 */
  hi: string;
  /** 어두운 단계 — 버튼 아래쪽 */
  lo: string;
  /** 강조색 판 위 글자·아이콘 — 짙은 색과 흰색 중 대비가 높은 쪽(xTool 그린은 짙은 색) */
  ink: string;
}

export function accentPalette(accent: string): AccentPalette {
  const dark = mixHex(accent, '#000000', 0.88);
  return {
    accent,
    hi: mixHex(accent, '#ffffff', 0.18),
    lo: mixHex(accent, '#000000', 0.16),
    ink: contrastRatio(dark, accent) >= contrastRatio('#ffffff', accent) ? dark : '#ffffff',
  };
}

// ── 유리 효과(웹 theme/glass.ts) ─────────────────────────────────────────────────────────────────────────

export interface GlassSettings {
  /** 뒤 배경 흐림(px) */
  blur: number;
  /** 유리 농도 — 판 바탕색의 불투명도(0~1) */
  opacity: number;
  /** 비치는 색의 채도(%) */
  saturate: number;
  /** 가장자리 빛 테두리 세기(배수) */
  rim: number;
}

export const GLASS_DEFAULT: GlassSettings = { blur: 22, opacity: 0.46, saturate: 140, rim: 1 };

export const GLASS_LIMITS = {
  blur: { min: 0, max: 40, step: 1 },
  opacity: { min: 0.1, max: 0.9, step: 0.01 },
  saturate: { min: 100, max: 220, step: 5 },
  rim: { min: 0, max: 2, step: 0.1 },
} as const satisfies Record<keyof GlassSettings, { min: number; max: number; step: number }>;

export type GlassPreset = 'clear' | 'default' | 'frosted' | 'smoky';

export const GLASS_PRESETS: readonly {
  value: GlassPreset;
  label: string;
  description: string;
  glass: GlassSettings;
}[] = [
  {
    value: 'clear',
    label: '맑게',
    description: '배경이 또렷하게 비쳐요',
    glass: { blur: 10, opacity: 0.26, saturate: 160, rim: 1.2 },
  },
  { value: 'default', label: '기본', description: '처음 설정', glass: GLASS_DEFAULT },
  {
    value: 'frosted',
    label: '젖빛',
    description: '뿌옇게 흐려 글이 잘 읽혀요',
    glass: { blur: 36, opacity: 0.4, saturate: 120, rim: 0.8 },
  },
  {
    value: 'smoky',
    label: '짙게',
    description: '어둡고 단단한 판',
    glass: { blur: 28, opacity: 0.72, saturate: 110, rim: 0.6 },
  },
];

const clamp = (v: number, { min, max }: { min: number; max: number }) => Math.min(max, Math.max(min, v));

/** 저장소에서 읽은 값 다듬기 — 숫자가 아니거나 범위를 벗어나면 기본값·경계값으로 */
export function normalizeGlass(raw: unknown): GlassSettings {
  const input = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<Record<keyof GlassSettings, unknown>>;
  const pick = (key: keyof GlassSettings) => {
    const v = input[key];
    return typeof v === 'number' && Number.isFinite(v) ? clamp(v, GLASS_LIMITS[key]) : GLASS_DEFAULT[key];
  };
  return { blur: pick('blur'), opacity: pick('opacity'), saturate: pick('saturate'), rim: pick('rim') };
}

/** 지금 값이 어느 프리셋과 같은지 — 슬라이더로 바꿔 어디에도 안 맞으면 null(사용자 지정) */
export function matchGlassPreset(glass: GlassSettings): GlassPreset | null {
  const same = (a: GlassSettings, b: GlassSettings) =>
    a.blur === b.blur &&
    Math.abs(a.opacity - b.opacity) < 0.005 &&
    a.saturate === b.saturate &&
    Math.abs(a.rim - b.rim) < 0.05;
  return GLASS_PRESETS.find(p => same(p.glass, glass))?.value ?? null;
}

/**
 * CSS saturate(s) 색 행렬(Skia ColorMatrix 4×5) — 웹 backdrop-filter의 saturate(140%)와 같은 식.
 * s는 배수(1.4 = 140%).
 */
export function saturateMatrix(s: number): number[] {
  return [
    0.213 + 0.787 * s,
    0.715 - 0.715 * s,
    0.072 - 0.072 * s,
    0,
    0,
    0.213 - 0.213 * s,
    0.715 + 0.285 * s,
    0.072 - 0.072 * s,
    0,
    0,
    0.213 - 0.213 * s,
    0.715 - 0.715 * s,
    0.072 + 0.928 * s,
    0,
    0,
    0,
    0,
    0,
    1,
    0,
  ];
}

// ── 배경(웹 appearance.ts BACKGROUND_OPTIONS) ──────────────────────────────────────────────────────────

/** 앱이 그리는 배경 — 웹의 shared(팀이 올린 사진)는 앱에 없어 기본(파편)으로 읽는다 */
export type GlassBackground = 'shards' | 'silk' | 'grunge' | 'photo';

export const BACKGROUND_OPTIONS: readonly {
  value: GlassBackground;
  label: string;
  description: string;
  /** 사진은 강조색을 바꾸지 않는다(사진 색을 해치지 않게) */
  kind: 'default' | 'texture' | 'photo';
}[] = [
  { value: 'shards', label: '블랙 파편', description: '처음부터 쓰던 기본 배경', kind: 'default' },
  { value: 'silk', label: '실크 웨이브', description: '강조색으로 빛나는 비단 물결', kind: 'texture' },
  { value: 'grunge', label: '그런지', description: '긁힌 캔버스 결 — 긁힘에 강조색이 배어요', kind: 'texture' },
  { value: 'photo', label: '작업장 사진', description: 'xTool 장비가 있는 작업장', kind: 'photo' },
];

export const KIND_LABEL = { default: '기본', texture: '텍스처', photo: '사진' } as const;

/** 사진 배경이면 강조색을 기본색으로 고정(웹 effectiveAccent) */
export const isPhotoBackground = (background: GlassBackground): boolean => background === 'photo';

// ── 도우미 ─────────────────────────────────────────────────────────────────────────────────────────────

export function round(n: number, digits: number): number {
  const k = 10 ** digits;
  return Math.round(n * k) / k;
}
