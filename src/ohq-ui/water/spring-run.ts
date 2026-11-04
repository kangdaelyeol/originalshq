import { springAt, springSettle, type SpringSpec } from './motion'

// 스프링 움직임을 WAAPI 키프레임으로 — 위치 x(t)를 미리 재서 브라우저에 넘기면 합성 단계(compositor)가 그린다.
// 프레임마다 rAF로 style을 쓰지 않아 메인 스레드가 놀고, 메인 스레드가 바쁠 때도 매끄럽다. 시계가
// document.timeline이라 waterClock·개발 도구 "느리게 보기"(CDP Animation.setPlaybackRate)와 같이 간다.
// 움직이는 도중 다시 부르면 지금 위치·빠르기(sample)에서 이어 가 끊기지 않는다(D7 springAt).

/** 키프레임 간격(s) — 출발 직후(가속이 가장 클 때)도 직선 보간 오차가 1px 안쪽이게(377px 막대 기준 0.9px) */
const STEP = 1 / 240

export interface SpringRun {
  /** 끝 자리 */
  readonly to: number
  /** 지금 자리·빠르기 — 애니메이션 시각(currentTime)으로 계산한다(레이아웃을 읽지 않는다) */
  sample(): { x: number; v: number }
  /** 아직 움직이는지(늦게 시작하는 동안도 true) */
  busy(): boolean
  cancel(): void
}

export interface SpringRunOptions {
  from: number
  to: number
  /** 처음 빠르기(단위/s) — 움직이는 도중 다시 부를 때 */
  v0?: number
  spec: SpringSpec
  /** 늦게 시작(s) — 차례로 나타날 때(WATER_REVEAL.stagger). 그동안은 from에 서 있다 */
  delay?: number
  /** 자리 x → 키프레임(transform·opacity만 — 합성 단계에서 그려지게) */
  frame: (x: number) => Keyframe
  /** 다 움직였을 때 */
  onDone?: () => void
}

/**
 * el을 from → to로 스프링 움직임 — 길이는 motion.ts springSettle(남은 흔들림이 처음 거리의 1/2000 아래로).
 * 끝 모양은 부르는 쪽이 style에 미리 써 둔다(애니메이션이 끝나면 그 값이 남는다 — fill: backwards라 끝난
 * 애니메이션이 메모리에 남지 않는다).
 */
export function runSpring(el: Element, opts: SpringRunOptions): SpringRun {
  const { from, to, v0 = 0, spec, delay = 0, frame, onDone } = opts
  const duration = springSettle(spec)
  const n = Math.max(2, Math.ceil(duration / STEP))
  const frames: Keyframe[] = []
  for (let i = 0; i <= n; i++) {
    const x = i === n ? to : springAt(from, v0, to, (duration * i) / n, spec).x
    frames.push({ ...frame(x), offset: i / n })
  }
  const anim = el.animate(frames, {
    duration: duration * 1000,
    delay: delay * 1000,
    fill: 'backwards',
    easing: 'linear',
  })
  let done = false
  anim.onfinish = () => {
    done = true
    onDone?.()
  }
  const local = () => {
    const ct = anim.currentTime
    return (typeof ct === 'number' ? ct / 1000 : 0) - delay
  }
  return {
    to,
    sample() {
      const t = local()
      if (t <= 0) return { x: from, v: v0 }
      if (done || t >= duration) return { x: to, v: 0 }
      return springAt(from, v0, to, t, spec)
    },
    busy: () => !done && anim.playState !== 'idle',
    cancel() {
      done = true
      anim.onfinish = null
      anim.cancel()
    },
  }
}
