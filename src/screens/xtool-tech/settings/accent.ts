// 강조색 — 사용자가 고른 색 하나에서 밝은·어두운 단계, 반투명용 rgb, 그 위 글자색을 만든다.

export const DEFAULT_ACCENT = '#00c767'

export const ACCENT_PRESETS: readonly { value: string; label: string }[] = [
  { value: '#00c767', label: 'xTool 그린' },
  { value: '#3b82f6', label: '블루' },
  { value: '#8b5cf6', label: '바이올렛' },
  { value: '#ec4899', label: '핑크' },
  { value: '#f97316', label: '오렌지' },
  { value: '#06b6d4', label: '시안' },
  { value: '#84cc16', label: '라임' },
  { value: '#eab308', label: '골드' },
]

export const isHexColor = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const toHex = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')

/** a에서 b로 t만큼(0~1) 섞는다(sRGB 단순 혼합 — 단계 색 만들기엔 충분). */
export function mixHex(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a)
  const [r2, g2, b2] = hexToRgb(b)
  return `#${toHex(r1 + (r2 - r1) * t)}${toHex(g1 + (g2 - g1) * t)}${toHex(b1 + (b2 - b1) * t)}`
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

export interface AccentPalette {
  accent: string
  hi: string
  lo: string
  /** rgba(var(--accent-rgb), 0.x)용 "r, g, b" */
  rgb: string
  /** 강조색 판 위 글자·아이콘 — 짙은 색과 흰색 중 대비가 높은 쪽(xTool 그린은 짙은 색). */
  ink: string
}

export function accentPalette(accent: string): AccentPalette {
  const dark = mixHex(accent, '#000000', 0.88)
  return {
    accent,
    hi: mixHex(accent, '#ffffff', 0.18),
    lo: mixHex(accent, '#000000', 0.16),
    rgb: hexToRgb(accent).join(', '),
    ink: contrastRatio(dark, accent) >= contrastRatio('#ffffff', accent) ? dark : '#ffffff',
  }
}

/** 강조색 CSS 변수 묶음 — 이 화면의 루트 요소(.xtool-tech) style에 칠한다(:root는 다른 화면과 같이 써서 건드리지 않는다). */
export function accentVars(accent: string): Record<string, string> {
  const p = accentPalette(accent)
  return {
    '--accent': p.accent,
    '--accent-hi': p.hi,
    '--accent-lo': p.lo,
    '--accent-rgb': p.rgb,
    '--accent-ink': p.ink,
  }
}
