import { useEffect, type RefObject } from 'react'

/** 네 카드가 함께 도는 한 바퀴 — 영상이 F1~F60(2초)마다 똑같이 되풀이된다. */
export const D10_LOOP_MS = 2000

/**
 * JS로 그리는 부분(글자 뒤섞기·모양 바꾸기)의 시계.
 * 요소에 걸린 CSS 애니메이션 `d10-clock`의 currentTime을 읽는다 — 다른 카드의 CSS 키프레임과
 * 같은 순간에 시작하고, 개발자 도구로 느리게 하거나 멈추고 시간을 옮겨도 함께 따라간다.
 * 시계가 없으면(움직임 줄이기 설정) t=0(완성된 모습)을 한 번 그리고 쉬다가, 애니메이션이 시작되면 다시 돈다.
 */
export function useLoopClock(ref: RefObject<Element | null>, draw: (t: number) => void) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let raf = 0
    let last = -1
    const tick = () => {
      raf = 0
      const clock = el.getAnimations().find((a) => (a as CSSAnimation).animationName === 'd10-clock')
      const ms = clock ? Number(clock.currentTime ?? 0) % D10_LOOP_MS : 0
      if (ms !== last) {
        last = ms
        draw(ms / 1000)
      }
      if (clock) raf = requestAnimationFrame(tick)
    }
    const wake = () => {
      if (!raf) raf = requestAnimationFrame(tick)
    }
    el.addEventListener('animationstart', wake)
    tick()
    return () => {
      el.removeEventListener('animationstart', wake)
      cancelAnimationFrame(raf)
    }
  }, [ref, draw])
}
