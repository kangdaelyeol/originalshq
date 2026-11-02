import type { ComponentType, CSSProperties } from 'react'
import {
  RadialBellIcon,
  RadialChatIcon,
  RadialLoaderIcon,
  RadialPhoneIcon,
  RadialSettingsIcon,
  RadialUsersIcon,
  type RadialIconProps,
} from './radial-icons'

// Design 9(sample/design9.mp4) 방사형 메뉴의 항목·배치·재생 순서.
// 길이는 em — 1em = 영상 가운데 장면(코드 창이 있는 F60~F391)의 10px.

export interface RadialMenuItem {
  key: string
  /** 이름표 글자(영상 그대로 대문자) */
  label: string
  /** 화면 읽기용 이름 — 보이는 이름표를 포함해야 한다 */
  name: string
  icon: ComponentType<RadialIconProps>
}

/** 위에서부터 시계 방향(영상 순서) — 열고 닫을 때도 이 순서로 40ms씩 늦게 움직인다 */
export const RADIAL_ITEMS: readonly RadialMenuItem[] = [
  { key: 'chats', label: 'CHATS', name: 'Chats', icon: RadialChatIcon },
  { key: 'calls', label: 'CALLS', name: 'Calls', icon: RadialPhoneIcon },
  { key: 'people', label: 'PEOPLE', name: 'People', icon: RadialUsersIcon },
  { key: 'alerts', label: 'ALERTS', name: 'Alerts', icon: RadialBellIcon },
  { key: 'aibot', label: 'AI BOT', name: 'AI Bot', icon: RadialLoaderIcon },
  { key: 'settings', label: 'SETTINGS', name: 'Settings', icon: RadialSettingsIcon },
]

/** 궤도 반지름 — 위성 여섯의 중심이 메뉴 중심에서 147.5~148.3px(F92) */
export const RADIAL_ORBIT_EM = 14.8

export interface SatellitePlacement {
  /** 메뉴 중심에서 위성 중심까지(em) */
  x: number
  y: number
  /** 이름표 자리 — 위쪽 반원은 위(CALLS·SETTINGS), 아래쪽 반원은 아래(PEOPLE·AI BOT) */
  labelSide: 'above' | 'below'
}

/** i번째 위성 자리 — 맨 위(-90°)에서 시작해 360/n°씩 시계 방향 */
export function satellitePlacement(index: number, count: number, orbit = RADIAL_ORBIT_EM): SatellitePlacement {
  const angle = ((-90 + (index * 360) / count) * Math.PI) / 180
  const x = Math.round(Math.cos(angle) * orbit * 1000) / 1000
  const y = Math.round(Math.sin(angle) * orbit * 1000) / 1000
  return { x, y, labelSide: y <= 0 ? 'above' : 'below' }
}

/** 위성 하나에 줄 CSS 변수(자리·순번) */
export const satelliteVars = (placement: SatellitePlacement, index: number) =>
  ({ '--d9-x': `${placement.x}em`, '--d9-y': `${placement.y}em`, '--d9-i': index }) as CSSProperties

// ── 영상 순서 다시 보기 ─────────────────────────────────────────────────────
// 가운데 장면(F55~F396)에서 마우스가 한 일을 프레임으로 옮겼다. 올림·떠남은 아이콘이 커지고 작아지는
// 프레임(예: 톱니 F188·F205)의 반 프레임 앞, 누름은 선택 그림자가 들어간 프레임(F222·F245…)의 반 프레임 앞.

/** 'center'는 가운데 버튼, null은 아무것도 안 올림 */
export type ReplayHover = string | null

export interface ReplayStep {
  /** 영상 프레임(30fps) */
  at: number
  hover?: ReplayHover
  open?: boolean
  select?: string
}

/** 재생 시작 프레임 — 닫힌 메뉴의 가운데 버튼 위에 마우스가 있다 */
export const REPLAY_FROM_FRAME = 55
export const REPLAY_INITIAL = { open: false, hover: 'center' as ReplayHover, value: null as string | null }

export const REPLAY_STEPS: readonly ReplayStep[] = [
  { at: 58, open: true },
  { at: 95.5, hover: null },
  // 한 바퀴 올려 보기만(F99~F205)
  { at: 98.5, hover: 'chats' },
  { at: 111.5, hover: null },
  { at: 113.5, hover: 'calls' },
  { at: 127.5, hover: null },
  { at: 130.5, hover: 'people' },
  { at: 145.5, hover: null },
  { at: 152.5, hover: 'alerts' },
  { at: 164.5, hover: null },
  { at: 167.5, hover: 'aibot' },
  { at: 180.5, hover: null },
  { at: 187.5, hover: 'settings' },
  { at: 204.5, hover: null },
  // 한 바퀴 눌러 고르기(F212~F335)
  { at: 211.5, hover: 'chats' },
  { at: 221.5, select: 'chats' },
  { at: 228.5, hover: null },
  { at: 230.5, hover: 'calls' },
  { at: 244.5, select: 'calls' },
  { at: 250.5, hover: null },
  { at: 258.5, hover: 'people' },
  { at: 268.5, select: 'people' },
  { at: 273.5, hover: null },
  { at: 279.5, hover: 'alerts' },
  { at: 285.5, select: 'alerts' },
  { at: 292.5, hover: null },
  { at: 298.5, hover: 'aibot' },
  { at: 304.5, select: 'aibot' },
  { at: 315.5, hover: null },
  { at: 322.5, hover: 'settings' },
  { at: 327.5, select: 'settings' },
  { at: 334.5, hover: null },
  // 가운데를 눌러 닫았다가(F348) 다시 연다(F375)
  { at: 335.5, hover: 'center' },
  { at: 348, open: false },
  { at: 375, open: true },
]

/** 재생이 끝나 마우스 조작으로 돌려주는 프레임(영상이 검게 사라지기 시작) */
export const REPLAY_END_FRAME = 396

export const replayMs = (frame: number) => Math.round(((frame - REPLAY_FROM_FRAME) / 30) * 1000)
