// 로그인 화면 색 — 웹 기술팀 로그인(src/screens/xtool-tech/pages/login-page.tsx)이 처음 들어온 사람에게 보이는
// 모습(기본 Monday 남색 테마)에서 그대로 땄다. 강조색 단계 계산은 웹 ohq-ui/theme/accent.ts와 같다.

/** Monday 파랑 — 웹 기본 테마(Monday)의 강조색(MONDAY_ACCENT). */
export const ACCENT = '#2364e3';

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toHex = (v: number) =>
  Math.round(Math.min(255, Math.max(0, v)))
    .toString(16)
    .padStart(2, '0');

/** a에서 b로 t만큼(0~1) 섞는다. */
export function mixHex(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return `#${toHex(r1 + (r2 - r1) * t)}${toHex(g1 + (g2 - g1) * t)}${toHex(b1 + (b2 - b1) * t)}`;
}

/** 강조색에 불투명도를 입힌 rgba — 웹의 rgba(var(--accent-rgb), a). */
export const alpha = (hex: string, a: number): string => `rgba(${hexToRgb(hex).join(', ')}, ${a})`;

export const C = {
  accent: ACCENT,
  accentHi: mixHex(ACCENT, '#ffffff', 0.18),
  accentLo: mixHex(ACCENT, '#000000', 0.16),
  /** 강조색 판 위 글자(파랑은 흰색이 대비가 높다) */
  accentInk: '#ffffff',
  // 바탕 — Monday 남색 페이지(#18192d)에 검은 막(#020203)을 40%(인트로 중 78%) 덮은 색
  page: '#18192d',
  veil: '#020203',
  text1: '#d5d8df',
  text2: '#c3c6d4',
  text3: '#9699a6',
  text4: '#80839a',
  good: '#4ade80',
  info: '#60a5fa',
  crit: '#f87171',
  white: '#ffffff',
} as const;

export const VEIL = { intro: 0.78, rest: 0.4 } as const;
