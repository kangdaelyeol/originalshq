import type { ComponentType } from 'react'
import { FocusBedIcon, FocusMoonIcon, FocusPersonIcon, type FocusIconProps } from './focus-icons'

// Design 6(sample/design6.mp4) — 유리 판 위 알약 셋. 길이는 em(= 영상 10px), 시간은 30fps 프레임.
// 영상은 70프레임짜리 한 주기를 알약마다 되풀이한다(F1·F71·F141 시작) — 아래 r은 주기 안 프레임.
//   r0~4   앞서 켜진 알약이 빠지고(drain), 마우스가 올라간 알약이 살짝 가라앉았다가
//   r5~19  튀어 올라 떠 있다(들림 + 바닥 쪽 색 빛)
//   r20~21 눌려 판 속으로 내려가고, r22~27 다시 튀어 오르며 하얗게 비었다가 옅은 색이 차고
//   r28    한 프레임 가늘게 쥐어짜였다 펴지고, r29~34 색이 짙어지고, r35~37 빛이 켜진다.
//   r22~50 그동안 판 전체가 출렁인다(카메라 쪽 흔들림).

export type PillTone = 'blue' | 'red' | 'orange'

export interface FocusPillItem {
  key: string
  label: string
  icon: ComponentType<FocusIconProps>
  /** 아이콘 상자 한 변(em) — 그림마다 속 크기가 달라 영상 화면 폭에 맞췄다 */
  iconSize: number
  /** 켜졌을 때 차오르는 액체 색 */
  tone: PillTone
  /** 켜면 무대가 어두워진다 — 방해 금지(F91~F95 밝음 → 어둠) */
  dark?: boolean
}

export const FOCUS_PILLS: readonly FocusPillItem[] = [
  { key: 'sleep', label: 'Sleep', icon: FocusBedIcon, iconSize: 3.1, tone: 'blue' },
  { key: 'dnd', label: 'Do Not Disturb', icon: FocusMoonIcon, iconSize: 3.4, tone: 'red', dark: true },
  { key: 'personal', label: 'Personal', icon: FocusPersonIcon, iconSize: 2.8, tone: 'orange' },
]

// ── 기하(em) ────────────────────────────────────────────────────────────────
/** 알약 두께 — 가까운 쪽 벽이 화면에서 15px(영상 F80 단면) ÷ sin 31.4° */
export const PILL_T = 2.9
/** 들린 높이 — 점 셋이 r19에 화면 21.6px 위(판 흔들림을 뺀 값) */
export const PILL_LIFT = 4.15
/** 눌린 두께 — r21 윗면이 화면 6.6px 아래(= 1.27em 내려감) */
export const PILL_SUNK = PILL_T - 1.27
/** 알약 사이 간격(중심 사이) — 세 알약의 점 셋이 화면 (77.5, 66.4)px씩 떨어져 있다 */
export const PILL_PITCH = 11

// ── 움직임 기록 ──────────────────────────────────────────────────────────────
/** [프레임, 값] — 키프레임 오프셋 = 프레임 / 마지막 프레임 */
export type MotionTrack = readonly (readonly [number, number])[]

/**
 * 들림(r−0.5 → r19, 19.5프레임): 알약 바닥 높이 z(em). 세 주기 '…' 점 추적값의 평균에서
 * 판 흔들림을 빼고 ÷0.521(sin 31.4°)·÷10 했다 — 먼저 1.4em 가라앉고(r2) 튀어 올라 r9에 88%.
 */
export const LIFT_TRACK: MotionTrack = [
  [0, 0],
  [0.5, -0.38],
  [1.5, -1.09],
  [2.5, -1.4],
  [3.5, -1.12],
  [4.5, 0.48],
  [5.5, 2.18],
  [6.5, 2.9],
  [7.5, 3.31],
  [8.5, 3.51],
  [9.5, 3.64],
  [10.5, 3.67],
  [12.5, 3.75],
  [14.5, 3.92],
  [16.5, 4.01],
  [19.5, PILL_LIFT],
]

/** 들리며 오른쪽으로 살짝 흔들림(화면 x, em) — r8~10에 +2.1px, r19에 +1px로 잦아든다 */
export const LIFT_SWAY_TRACK: MotionTrack = [
  [0, 0],
  [1.5, 0.03],
  [3.5, 0.09],
  [5.5, 0.16],
  [7.5, 0.2],
  [10.5, 0.21],
  [13.5, 0.19],
  [16.5, 0.14],
  [19.5, 0.1],
]

/** 들릴 때 판 전체(화면 y, em) — 알약이 가라앉을 때 같이 1.7px 내려갔다가 1.2px 올라온다 */
export const BOARD_DIP_TRACK: MotionTrack = [
  [0, 0],
  [0.5, 0.05],
  [1.5, 0.13],
  [2.5, 0.17],
  [3.5, 0.155],
  [4.5, 0.125],
  [5.5, 0.055],
  [6.5, 0],
  [7.5, -0.055],
  [8.5, -0.1],
  [10.5, -0.12],
  [12.5, -0.105],
  [14.5, -0.08],
  [16.5, -0.05],
  [19.5, -0.02],
  [21.5, 0],
]

/**
 * 놓는 순간(r21)부터 튀어 오름: 바닥 높이 z · 두께 h · 화면 x 흔들림 sx · 폭 sq(em·배율).
 * r24에 윗면이 쉬는 자리보다 화면 16px 위·6px 왼쪽(F95·F165), r27에 제자리,
 * r28에 폭이 0.22배로 쥐어짜였다가(F29·F99·F169) r29에 다시 편다.
 */
export const POP_TRACK = {
  z: [
    [0, 0],
    [1, 0],
    [2, 2.4],
    [3, 2.9],
    [4, 1.65],
    [5, 0.45],
    [6, 0],
    [9, 0],
  ],
  h: [
    [0, PILL_SUNK],
    [1, 2.46],
    [2, PILL_T],
    [9, PILL_T],
  ],
  sx: [
    [0, 0],
    [1, -0.13],
    [2, -0.35],
    [3, -0.58],
    [4, 0.33],
    [5, 0.1],
    [6, 0],
    [9, 0],
  ],
  sq: [
    [0, 1],
    [5, 1],
    [6, 0.62],
    [7, 0.22],
    [8, 1.03],
    [9, 1],
  ],
} satisfies Record<string, MotionTrack>

/**
 * 판 출렁임(r22 → r51): 화면 y 이동 A, 세로 늘어남 B(가운데 알약 기준 ±67px 지점의 차), x 이동 C(px).
 * 세 주기 모두 같은 모양이라 눌린 알약과 상관없는 무대 전체 흔들림 — 위 알약(S)과 아래 알약(P)의
 * 위상이 달라서 이동 + 세로 배율로 나눴다.
 */
export const BOARD_BOUNCE_PX: readonly (readonly [number, number, number])[] = [
  [2.0, 0.7, 0.5],
  [6.0, 1.8, 1.5],
  [8.0, 2.4, 1.9],
  [7.0, 2.6, 1.9],
  [4.0, 2.35, 1.5],
  [0.6, 1.55, 1.0],
  [-2.6, 0.65, 0.4],
  [-4.3, -0.55, -0.1],
  [-4.6, -1.7, -0.8],
  [-4.6, -2.6, -1.5],
  [-4.2, -3.3, -1.9],
  [-3.3, -3.6, -2.0],
  [-2.3, -3.4, -2.0],
  [-1.2, -3.05, -1.7],
  [0.0, -2.35, -1.4],
  [1.0, -1.45, -0.9],
  [1.6, -0.8, -0.5],
  [1.85, 0.05, 0.0],
  [1.85, 0.7, 0.5],
  [1.5, 1.15, 0.7],
  [1.4, 1.3, 0.9],
  [1.1, 1.3, 0.7],
  [0.8, 1.1, 0.6],
  [0.7, 1.0, 0.6],
  [0.5, 0.75, 0.4],
  [0.5, 0.45, 0.3],
  [0.3, 0.3, 0.2],
  [0.3, 0.05, 0.1],
  [0.0, -0.2, -0.1],
  [0.0, 0.0, 0.0],
]

// ── 영상 그대로 다시 보기 ────────────────────────────────────────────────────
export interface ReplayStep {
  /** 다시 보기 시작부터 프레임(30fps) — 0 = 영상 F1 직전(r −0.5) */
  frame: number
  hover?: string | null
  press?: string | null
  /** 켤 알약(null = 모두 끔) */
  value?: string | null
  /** 무대 밝기 — 영상은 놓기 1프레임 전에 어두워지기 시작하고(F91), 밝아짐은 놓은 뒤 3프레임(F165) */
  dark?: boolean
}

/** 다시 보기 길이(프레임) — 영상 7초 */
export const REPLAY_FRAMES = 210

/** 주기마다: 앞 알약 빠짐 + 다음 알약 들림(r−0.5) → 누름(r19.7) → 놓음·켜짐(r21.5) */
export const REPLAY_STEPS: readonly ReplayStep[] = FOCUS_PILLS.flatMap((item, i): ReplayStep[] => {
  const base = i * 70
  return [
    { frame: base, hover: item.key, value: null },
    { frame: base + 19.7, press: item.key },
    { frame: base + 21.5, press: null, value: item.key },
  ]
})
  .concat([
    { frame: 90.5, dark: true },
    { frame: 164.5, dark: false },
    { frame: REPLAY_FRAMES, hover: null },
  ])
  .sort((a, b) => a.frame - b.frame)

/** 다시 보기 처음 모습 — 영상 F1처럼 Personal이 켜진 밝은 무대 */
export const REPLAY_START_VALUE = 'personal'
