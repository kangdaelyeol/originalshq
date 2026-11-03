import type { ComponentType, CSSProperties } from 'react'
import {
  LiquidHeartIcon,
  LiquidHomeIcon,
  LiquidPlusIcon,
  LiquidSearchIcon,
  LiquidUserIcon,
  type LiquidIconProps,
} from './liquid-icons'

// Design 1(sample/design1.mp4) 탭 바의 버튼·색. 색은 물이 가득 찬 프레임에서 뽑았다
// (물 위쪽·아래쪽 = 수면 바로 아래·바닥 바로 위, 선택 색 = 선택된 아이콘·점).

/** 버튼 하나의 색 */
export interface LiquidTone {
  /** 물 위쪽(수면) */
  top: string
  /** 물 아래쪽(바닥) */
  bottom: string
  /** 버튼 바깥 빛·아이콘 뒤 빛 */
  glow: string
  /** 선택됐을 때 아이콘·점 */
  ink: string
  /** 선택 점 둘레 빛 */
  dotGlow: string
}

export interface LiquidTabItem {
  key: string
  label: string
  icon: ComponentType<LiquidIconProps>
  tone: LiquidTone
  /** 물에 잠기면 아이콘 속을 흰색으로 채운다 — 영상에서는 하트만 */
  fillOnWet?: boolean
}

export const LIQUID_TABS: readonly LiquidTabItem[] = [
  {
    key: 'home',
    label: '홈',
    icon: LiquidHomeIcon,
    tone: { top: '#6dffff', bottom: '#26a8f5', glow: '#2f9dff', ink: '#1e8fe6', dotGlow: '#8fd8ff' },
  },
  {
    key: 'search',
    label: '검색',
    icon: LiquidSearchIcon,
    tone: { top: '#c95ff8', bottom: '#8a14f3', glow: '#a13dff', ink: '#7c0ae4', dotGlow: '#d9a4ff' },
  },
  {
    key: 'plus',
    label: '새로 만들기',
    icon: LiquidPlusIcon,
    tone: { top: '#f6b545', bottom: '#f25418', glow: '#ff5b2e', ink: '#e24115', dotGlow: '#ffb1a0' },
  },
  {
    key: 'heart',
    label: '좋아요',
    icon: LiquidHeartIcon,
    tone: { top: '#f760a8', bottom: '#ee006a', glow: '#ff2f86', ink: '#d8004a', dotGlow: '#ff9fd2' },
    fillOnWet: true,
  },
  {
    key: 'user',
    label: '내 정보',
    icon: LiquidUserIcon,
    tone: { top: '#f9ea5c', bottom: '#f2c21f', glow: '#ffc928', ink: '#e2a800', dotGlow: '#ffe68a' },
  },
]

/** 버튼 색을 CSS 변수로 — 스타일(_design1.scss)이 color-mix로 투명도를 만든다 */
export const liquidToneVars = (tone: LiquidTone) =>
  ({
    '--d1-top': tone.top,
    '--d1-bottom': tone.bottom,
    '--d1-glow': tone.glow,
    '--d1-ink': tone.ink,
    '--d1-dot-glow': tone.dotGlow,
  }) as CSSProperties

// ── 물속 거품·흘러내리는 방울 ───────────────────────────────────────────────

/** 물속 거품 4개 — 영상에서 매번 같은 자리(중심 기준 x, 영상 px)에서 올라온다 */
export const LIQUID_BUBBLES = [
  { x: -16.5, delay: 0.14, duration: 1.15 },
  { x: -6.5, delay: 0.18, duration: 1.2 },
  { x: -1, delay: 0.16, duration: 1.1 },
  { x: 13.5, delay: 0.26, duration: 1.25 },
] as const

export interface LiquidDrip {
  id: number
  /** 중심 기준 가로 위치(em, 1em = 영상 10px) */
  x: number
  /** 시작 높이 — 원 안쪽 위 벽 바로 아래 */
  y0: number
  /** 내려오며 옆으로 흐르는 정도 */
  dx: number
  /** 마우스가 떠난 뒤 나타나기까지(초) */
  delay: number
}

// 물이 빠질 때 벽에 남는 방울 — 영상 세 번(검색·더하기·하트)을 프레임마다 따라가 보니 넷이
// 0·4·6·9프레임 간격으로 원 안쪽 위 벽에서 생겨, 같은 두 높이(-21·+9px)에서 잠깐 멈추며
// 흘러내리고 사라졌다. 가로 위치만 매번 달랐다(-28~+32px).
const DRIP_DELAYS = [0.1, 0.23, 0.3, 0.4]
const FACE_RADIUS = 45
let nextDripId = 1

/** 마우스가 떠날 때(이벤트 처리 안에서) 부른다 — 매번 다른 자리에 흘린다 */
export function makeDrips(): LiquidDrip[] {
  const used: number[] = []
  return DRIP_DELAYS.map((delay) => {
    let x = 0
    for (let tries = 0; tries < 8; tries++) {
      x = -28 + Math.random() * 60
      if (used.every((u) => Math.abs(u - x) > 6)) break
    }
    used.push(x)
    const wall = Math.sqrt(FACE_RADIUS * FACE_RADIUS - x * x)
    return {
      id: nextDripId++,
      x: x / 10,
      y0: -(wall - 2) / 10,
      dx: (Math.random() * 5 - 2.5) / 10,
      delay,
    }
  })
}
