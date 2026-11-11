import type { TextStyle } from 'react-native';

// Monday 테마 — 웹(ohq-ui/styles/themes/_monday-palettes.scss, _monday.scss)의 --mon-* 값을 그대로 옮겼다.
// 처음 들어온 사람은 남색(navy). 설정에서 라이트·블랙으로 바꾼다(웹 설정 > 레이아웃 > Monday 색상과 같은 셋).

export type MonPaletteKey = 'navy' | 'light' | 'black';

export interface MonPalette {
  key: MonPaletteKey;
  scheme: 'dark' | 'light';
  page: string;
  bg: string;
  surface: string;
  nav: string;
  cell: string;
  hover: string;
  line: string;
  lineStrong: string;
  control: string;
  /** 본문 글자(웹 --text-1) */
  text: string;
  /** 사이드바 메뉴·섹션 제목·표 머리글(웹 --text-2) */
  textSoft: string;
  /** 흐린 글자·개수·자리 표시·쉬는 아이콘(웹 --text-3) — 이름이 엇갈리니 조심 */
  text2: string;
  /** 더 흐린 글자(웹 --text-4) */
  text4: string;
  primary: string;
  primaryHi: string;
  chip: string;
  badge: string;
  pop: string;
  selectedNav: string;
  selectedInk: string;
  selectedRow: string;
  overlay: string;
  overlayStrong: string;
  link: string;
  muted: string;
  workbox: string;
  workboxHead: string;
  sortBg: string;
  preview: string;
  personEmpty: string;
  toolOn: string;
  iconTint: string;
  iconInk: string;
  dangerText: string;
  shadow: string;
  scrim: string;
}

const navy: MonPalette = {
  key: 'navy',
  scheme: 'dark',
  page: '#18192d',
  bg: '#18192d',
  surface: '#2b2c44',
  nav: '#23263d',
  cell: '#2b2c44',
  hover: '#33354f',
  line: '#43445d',
  lineStrong: '#5f6278',
  control: '#797e93',
  text: '#d5d8df',
  textSoft: '#c3c6d4',
  text2: '#9699a6',
  text4: '#80839a',
  primary: '#2364e3',
  primaryHi: '#3a78f0',
  chip: '#192f67',
  badge: '#3a3a50',
  pop: '#30324e',
  selectedNav: '#192f67',
  selectedInk: '#ffffff',
  selectedRow: '#1c2c63',
  overlay: 'rgba(255, 255, 255, 0.08)',
  overlayStrong: 'rgba(255, 255, 255, 0.12)',
  link: '#66a3ff',
  muted: '#5f6278',
  workbox: '#1c1d33',
  workboxHead: '#23253d',
  sortBg: '#393b56',
  preview: '#11121f',
  personEmpty: '#bebfc9',
  toolOn: 'rgba(35, 100, 227, 0.22)',
  iconTint: 'rgba(35, 100, 227, 0.2)',
  iconInk: '#8fb4ff',
  dangerText: '#ff7f8f',
  shadow: 'rgba(0, 0, 0, 0.55)',
  scrim: 'rgba(0, 0, 0, 0.55)',
};

const light: MonPalette = {
  key: 'light',
  scheme: 'light',
  page: '#ffffff',
  bg: '#ffffff',
  surface: '#f5f6fa',
  nav: '#ffffff',
  cell: '#ffffff',
  hover: '#f5f6f8',
  line: '#d0d4e4',
  lineStrong: '#b4b8cc',
  control: '#c3c6d4',
  text: '#323338',
  textSoft: '#4b4c55',
  text2: '#676879',
  text4: '#8a8b99',
  primary: '#0073ea',
  primaryHi: '#0060b9',
  chip: '#cce5ff',
  badge: '#e6e9ef',
  pop: '#ffffff',
  selectedNav: '#cce5ff',
  selectedInk: '#323338',
  selectedRow: '#e5f2ff',
  overlay: 'rgba(0, 0, 0, 0.05)',
  overlayStrong: 'rgba(0, 0, 0, 0.09)',
  link: '#1f76c2',
  muted: '#b4b8cc',
  workbox: '#ffffff',
  workboxHead: '#f5f6fa',
  sortBg: '#e6e9ef',
  preview: '#f0f1f5',
  personEmpty: '#9a9cad',
  toolOn: '#cce5ff',
  iconTint: '#e5f0ff',
  iconInk: '#0073ea',
  dangerText: '#d83a52',
  shadow: 'rgba(29, 36, 69, 0.18)',
  scrim: 'rgba(41, 47, 76, 0.4)',
};

const black: MonPalette = {
  key: 'black',
  scheme: 'dark',
  page: '#121212',
  bg: '#121212',
  surface: '#272727',
  nav: '#181818',
  cell: '#272727',
  hover: '#303030',
  line: '#4a4a4a',
  lineStrong: '#6a6a6a',
  control: '#8a8a8a',
  text: '#e6e6e6',
  textSoft: '#cfcfcf',
  text2: '#a3a3a3',
  text4: '#8a8a8a',
  primary: '#2364e3',
  primaryHi: '#3a78f0',
  chip: '#192f67',
  badge: '#3a3a3a',
  pop: '#2f2f2f',
  selectedNav: '#192f67',
  selectedInk: '#ffffff',
  selectedRow: '#1d2a4d',
  overlay: 'rgba(255, 255, 255, 0.08)',
  overlayStrong: 'rgba(255, 255, 255, 0.12)',
  link: '#66a3ff',
  muted: '#666666',
  workbox: '#1a1a1a',
  workboxHead: '#222222',
  sortBg: '#3a3a3a',
  preview: '#0b0b0b',
  personEmpty: '#bdbdbd',
  toolOn: 'rgba(35, 100, 227, 0.25)',
  iconTint: 'rgba(35, 100, 227, 0.22)',
  iconInk: '#8fb4ff',
  dangerText: '#ff7f8f',
  shadow: 'rgba(0, 0, 0, 0.6)',
  scrim: 'rgba(0, 0, 0, 0.6)',
};

export const PALETTES: Record<MonPaletteKey, MonPalette> = { navy, light, black };

/** 설정의 팔레트 고르기 — 이름과 견본 색(웹 ohq-ui/theme/monday.ts와 같다) */
export const PALETTE_CHOICES: readonly { key: MonPaletteKey; label: string; swatch: [string, string, string] }[] = [
  { key: 'navy', label: '남색', swatch: ['#18192d', '#2b2c44', '#192f67'] },
  { key: 'light', label: '라이트', swatch: ['#ffffff', '#f5f6fa', '#cce5ff'] },
  { key: 'black', label: '블랙', swatch: ['#121212', '#272727', '#192f67'] },
];

/** 상태 색 — 웹 Monday 테마의 --good·--warn·--crit·--info */
export const STATE = { good: '#00c875', warn: '#fdab3d', crit: '#e2445c', info: '#579bfc' } as const;
/** 토스트 성공·실패 바탕, 위험 단추 */
export const TOAST = { success: '#00854d', error: '#d83a52' } as const;
/** Monday 강조색(웹 MONDAY_ACCENT) — "나" 동그라미 등 */
export const MONDAY_ACCENT = '#2364e3';
/** 고른 칸·체크 칸의 흰 글자·체크(라벨 색·파란 바탕 위) */
export const INK = '#ffffff';

// 글꼴 — Figtree(앱에 넣은 정적 글꼴). 한글은 Figtree에 없어 iOS 한글 글꼴(Apple SD Gothic Neo)로 나온다(웹과 같다).
export const FONT = {
  regular: 'Figtree-Regular',
  medium: 'Figtree-Medium',
  semibold: 'Figtree-SemiBold',
  bold: 'Figtree-Bold',
} as const;

/** 글자 모양 — 보드 안 글자는 웹처럼 모두 500(medium) */
export const type = (size: number, weight: keyof typeof FONT = 'medium', extra: TextStyle = {}): TextStyle => ({
  fontFamily: FONT[weight],
  fontSize: size,
  ...extra,
});

/** 반경 — 칸·단추 4, 팝오버·카드 8, 상자·시트 12, 보드 틀 16 */
export const RADIUS = { control: 4, card: 8, box: 12, frame: 16 } as const;
