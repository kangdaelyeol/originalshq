// 유리 효과 — 모든 유리 판(카드·사이드바·상단바·알림·로그인 카드)의 backdrop-filter와 칠 농도.
// CSS 변수(--glass-*)로 이 화면 루트 요소에 칠하고, _mixins.scss의 glass와 로그인 유리가 이 값을 쓴다.

export interface GlassSettings {
  /** 뒤 배경 흐림(px) */
  blur: number
  /** 유리 농도 — 판 바탕색의 불투명도(0~1). 낮을수록 투명하다. */
  opacity: number
  /** 비치는 색의 채도(%) */
  saturate: number
  /** 가장자리 빛 테두리 세기(배수, 1 = 기본) */
  rim: number
}

export const GLASS_DEFAULT: GlassSettings = { blur: 22, opacity: 0.46, saturate: 140, rim: 1 }

export const GLASS_LIMITS = {
  blur: { min: 0, max: 40, step: 1 },
  opacity: { min: 0.1, max: 0.9, step: 0.01 },
  saturate: { min: 100, max: 220, step: 5 },
  rim: { min: 0, max: 2, step: 0.1 },
} as const satisfies Record<keyof GlassSettings, { min: number; max: number; step: number }>

export type GlassPreset = 'clear' | 'default' | 'frosted' | 'smoky'

export const GLASS_PRESETS: readonly { value: GlassPreset; label: string; description: string; glass: GlassSettings }[] = [
  { value: 'clear', label: '맑게', description: '배경이 또렷하게 비쳐요', glass: { blur: 10, opacity: 0.26, saturate: 160, rim: 1.2 } },
  { value: 'default', label: '기본', description: '처음 설정', glass: GLASS_DEFAULT },
  { value: 'frosted', label: '젖빛', description: '뿌옇게 흐려 글이 잘 읽혀요', glass: { blur: 36, opacity: 0.4, saturate: 120, rim: 0.8 } },
  { value: 'smoky', label: '짙게', description: '어둡고 단단한 판', glass: { blur: 28, opacity: 0.72, saturate: 110, rim: 0.6 } },
]

const clamp = (v: number, { min, max }: { min: number; max: number }) => Math.min(max, Math.max(min, v))

/** 저장소에서 읽은 값 다듬기 — 숫자가 아니거나 범위를 벗어나면 기본값·경계값으로. */
export function normalizeGlass(raw: unknown): GlassSettings {
  const input = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<Record<keyof GlassSettings, unknown>>
  const pick = (key: keyof GlassSettings) => {
    const v = input[key]
    return typeof v === 'number' && Number.isFinite(v) ? clamp(v, GLASS_LIMITS[key]) : GLASS_DEFAULT[key]
  }
  return { blur: pick('blur'), opacity: pick('opacity'), saturate: pick('saturate'), rim: pick('rim') }
}

/** 지금 값이 어느 프리셋과 같은지 — 슬라이더로 바꿔서 어디에도 안 맞으면 null(사용자 지정). */
export function matchGlassPreset(glass: GlassSettings): GlassPreset | null {
  const same = (a: GlassSettings, b: GlassSettings) =>
    a.blur === b.blur &&
    Math.abs(a.opacity - b.opacity) < 0.005 &&
    a.saturate === b.saturate &&
    Math.abs(a.rim - b.rim) < 0.05
  return GLASS_PRESETS.find((p) => same(p.glass, glass))?.value ?? null
}

/** 요소 하나에만 다른 유리 값을 입힐 때(프리셋 미리보기 칩) 쓰는 CSS 변수 묶음. */
export function glassVars(glass: GlassSettings): Record<string, string> {
  return {
    '--glass-blur': `${glass.blur}px`,
    '--glass-opacity': String(glass.opacity),
    '--glass-saturate': `${glass.saturate}%`,
    '--glass-rim': String(glass.rim),
  }
}
