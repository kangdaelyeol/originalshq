import type { Transition } from 'motion/react'

// 느리게 보기 — 시간 배율 s(1이 영상 속도, 0.1이면 10배 느리게). 영상 프레임과 하나씩 맞대 볼 때 쓴다.

type Ease = readonly [number, number, number, number] | 'linear' | 'easeOut' | 'easeIn' | 'easeInOut'

export interface D8Tween {
  duration: number
  delay?: number
  ease: Ease
}

export interface D8Spring {
  stiffness: number
  damping: number
  mass?: number
  delay?: number
}

/** 시간 위치 그대로 늘인 tween */
export function slowTween(t: D8Tween, s: number): Transition {
  return { duration: t.duration / s, delay: (t.delay ?? 0) / s, ease: t.ease as Transition['ease'] }
}

/** 같은 모양을 시간축으로 늘인 스프링 — 질량 1에서 k·s², c·s */
export function slowSpring(t: D8Spring, s: number, restDelta = 0.001): Transition {
  return {
    type: 'spring',
    stiffness: t.stiffness * s * s,
    damping: t.damping * s,
    mass: t.mass ?? 1,
    delay: (t.delay ?? 0) / s,
    restDelta,
    restSpeed: 0.01 * s,
  }
}
