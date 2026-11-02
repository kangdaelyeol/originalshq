import {
  BOARD_BOUNCE_PX,
  BOARD_DIP_TRACK,
  LIFT_SWAY_TRACK,
  LIFT_TRACK,
  PILL_LIFT,
  PILL_SUNK,
  PILL_T,
  POP_TRACK,
  type MotionTrack,
} from './glass-data'

// 알약·판의 움직임 — Web Animations로 '지금 값'에서 시작한다. 마우스가 알약 위를 빠르게 지나가도
// 튀지 않게(들리던 도중에 내려오기 등). CSS 변수(--d6-z 등)는 _design6.scss에서 @property로 등록돼
// 숫자로 보간된다. Web Animations라서 캡처 도구의 느린 재생(Animation.setPlaybackRate)도 그대로 따른다.

const FRAME = 1000 / 30

/** 알약 자세 — 쉼 · 들림(호버) · 눌림 */
export type PillPose = 'rest' | 'lifted' | 'pressed'

interface PillState {
  z: number
  h: number
  sx: number
  sq: number
}

const VARS = { z: '--d6-z', h: '--d6-h', sx: '--d6-sx', sq: '--d6-sq' } as const
type PillKey = keyof typeof VARS

function readState(el: HTMLElement): PillState {
  const cs = getComputedStyle(el)
  const num = (name: string, fallback: number) => {
    const v = parseFloat(cs.getPropertyValue(name))
    return Number.isFinite(v) ? v : fallback
  }
  return { z: num(VARS.z, 0), h: num(VARS.h, PILL_T), sx: num(VARS.sx, 0), sq: num(VARS.sq, 1) }
}

function writeState(el: HTMLElement, s: PillState) {
  for (const k of Object.keys(VARS) as PillKey[]) el.style.setProperty(VARS[k], String(s[k]))
}

/** 기록(프레임 → 값) 여러 개를 오프셋 하나로 합친 키프레임 — 기록 사이는 직선으로 잇는다 */
function trackFrames(tracks: Partial<Record<PillKey, MotionTrack>>, base: PillState, length: number): Keyframe[] {
  const stops = new Set<number>([0, length])
  for (const t of Object.values(tracks)) t?.forEach(([f]) => stops.add(f))
  return [...stops]
    .sort((a, b) => a - b)
    .map((f) => {
      const frame: Keyframe = { offset: f / length }
      for (const k of Object.keys(VARS) as PillKey[]) {
        const t = tracks[k]
        frame[VARS[k]] = String(t ? sample(t, f) : base[k])
      }
      return frame
    })
}

function sample(track: MotionTrack, f: number): number {
  if (f <= track[0][0]) return track[0][1]
  for (let i = 1; i < track.length; i++) {
    const [f1, v1] = track[i]
    if (f <= f1) {
      const [f0, v0] = track[i - 1]
      return v0 + ((v1 - v0) * (f - f0)) / (f1 - f0)
    }
  }
  return track[track.length - 1][1]
}

function run(el: HTMLElement, keyframes: Keyframe[], duration: number, end: PillState, easing = 'linear') {
  const anim = el.animate(keyframes, { duration, easing, fill: 'forwards' })
  // 끝나면 값을 인라인으로 옮기고 애니메이션을 지운다(쌓이지 않게).
  anim.onfinish = () => {
    writeState(el, end)
    anim.cancel()
  }
}

function settle(el: HTMLElement): PillState {
  const now = readState(el)
  el.getAnimations().forEach((a) => a.cancel())
  writeState(el, now)
  return now
}

const near = (a: number, b: number, eps = 0.25) => Math.abs(a - b) < eps

/**
 * 자세를 바꾼다. 들림은 영상처럼 가라앉았다 튀어 오르고(쉬던 자리에서 시작할 때만),
 * 눌림은 2프레임 만에 내려가며, 눌림에서 풀릴 때 켜졌으면(activated) r21~r30 튀어 오름·쥐어짜임을 한다.
 * 돌려주는 값: 영상의 판 흔들림을 같이 일으켜야 하는지.
 */
export function animatePill(
  el: HTMLElement,
  to: PillPose,
  from: PillPose,
  activated: boolean,
): 'dip' | 'bounce' | null {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const now = settle(el)
  const target: PillState = {
    z: to === 'lifted' ? PILL_LIFT : 0,
    h: to === 'pressed' ? PILL_SUNK : PILL_T,
    sx: to === 'lifted' ? LIFT_SWAY_TRACK[LIFT_SWAY_TRACK.length - 1][1] : 0,
    sq: 1,
  }
  if (reduce) {
    run(el, [{}, toFrame(target)], 160, target, 'ease-out')
    return null
  }

  if (from === 'pressed' && to !== 'pressed') {
    if (activated) {
      // 켜짐 — 영상 r21~r30 그대로(쉬는 자리로 끝난다)
      run(el, trackFrames(POP_TRACK, now, 9), 9 * FRAME, { ...target, z: 0, sx: 0 })
      return 'bounce'
    }
    // 끔·취소 — 영상에 없는 경우라 두께만 젤리처럼 살짝 넘쳤다 돌아온다
    run(
      el,
      [
        toFrame(now),
        { offset: 0.35, [VARS.h]: String(PILL_T + 0.35), [VARS.z]: String(target.z * 0.6) },
        toFrame(target),
      ],
      8 * FRAME,
      target,
    )
    return null
  }

  if (to === 'pressed') {
    // r19 → r21: 처음엔 천천히(r20에 14%), 끝에 확 내려간다
    run(
      el,
      [toFrame(now), { offset: 0.5, [VARS.z]: String(now.z * 0.84), [VARS.h]: String(now.h) }, toFrame(target)],
      2 * FRAME,
      target,
    )
    return null
  }

  if (to === 'lifted') {
    if (near(now.z, 0) && near(now.h, PILL_T)) {
      run(el, trackFrames({ z: LIFT_TRACK, sx: LIFT_SWAY_TRACK }, now, 19.5), 19.5 * FRAME, target)
      return 'dip'
    }
    run(el, [toFrame(now), toFrame(target)], 8 * FRAME, target, 'cubic-bezier(.2,.8,.3,1)')
    return null
  }

  // 들림 → 쉼(마우스가 그냥 떠남) — 영상에 없어서 살짝 내려앉게만 했다
  run(
    el,
    [toFrame(now), { offset: 0.7, [VARS.z]: String(-0.18), [VARS.sx]: '0' }, toFrame(target)],
    10 * FRAME,
    target,
    'ease-in-out',
  )
  return null
}

function toFrame(s: PillState): Keyframe {
  return { [VARS.z]: String(s.z), [VARS.h]: String(s.h), [VARS.sx]: String(s.sx), [VARS.sq]: String(s.sq) }
}

/**
 * 판 전체 흔들림 — 화면 기준 이동·세로 배율(transform-origin은 가운데 알약 높이).
 * 더하기(composite: add)라 들림 흔들림과 켜짐 출렁임이 겹쳐도 끊기지 않는다.
 */
export function animateBoard(el: HTMLElement, kind: 'dip' | 'bounce') {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  if (kind === 'dip') {
    const len = BOARD_DIP_TRACK[BOARD_DIP_TRACK.length - 1][0]
    el.animate(
      BOARD_DIP_TRACK.map(([f, y]) => ({ offset: f / len, transform: `translateY(${y}em)` })),
      { duration: len * FRAME, composite: 'add' },
    )
    return
  }
  // 놓는 순간(r21) 0에서 시작해 r22~r51 기록을 한 프레임씩
  const len = BOARD_BOUNCE_PX.length
  const frames: Keyframe[] = [{ offset: 0, transform: 'translate(0, 0) scaleY(1)' }].concat(
    BOARD_BOUNCE_PX.map(([y, s, x], i) => ({
      offset: (i + 1) / len,
      transform: `translate(${x / 10}em, ${y / 10}em) scaleY(${1 + s / 67})`,
    })),
  )
  el.animate(frames, { duration: len * FRAME, composite: 'add' })
}

/**
 * 밝기가 넘어가는 동안 알약이 잠깐 맑은 유리처럼 비는 흐림(--d6-wash) — 장면이 아직 밝을 때 가장 흐리다:
 * 어두워질 땐 F92(바탕 7%)에, 밝아질 땐 F167(바탕 78%)에 가장 흐리고 4프레임 안에 돌아온다.
 */
export function washScene(el: HTMLElement, toDark: boolean) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  // 장면에는 밝기 전환(CSS transition)도 걸려 있어서 흐림만 골라 멈춘다
  el.getAnimations().forEach((a) => {
    if (a.id === 'd6-wash') a.cancel()
  })
  const peak = toDark ? 0.35 : 0.55
  const wash = el.animate(
    [
      { '--d6-wash': '0' },
      { '--d6-wash': '1', offset: peak },
      { '--d6-wash': '0.5', offset: Math.min(0.9, peak + 0.25) },
      { '--d6-wash': '0' },
    ],
    { duration: 4.5 * FRAME },
  )
  wash.id = 'd6-wash'
}
