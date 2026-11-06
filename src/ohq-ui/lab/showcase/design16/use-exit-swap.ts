import { useLayoutEffect, useState, type RefObject } from 'react'
import { D16_T, EASE, play } from './d16-motion'

/**
 * 나가고 바꾸기 — target이 바뀌면 지금 보이는 것(selector)을 0.03초 뒤 0.1초에 흐리게 내보낸 다음 바꾼다.
 * 대시보드 → Orders(F74.5~F77.7), All orders → Packing board(F106.5~F108.9) 둘 다 같은 값.
 * 돌려주는 값이 실제로 그릴 것 — 그걸 key로 써서 새 것이 다시 붙게(들어오는 움직임이 다시 돈다) 한다.
 */
export function useExitSwap<T>(target: T, rootRef: RefObject<HTMLElement | null>, selector: string): T {
  const [shown, setShown] = useState(target)

  useLayoutEffect(() => {
    if (Object.is(target, shown)) return
    const els = rootRef.current ? Array.from(rootRef.current.querySelectorAll<HTMLElement>(selector)) : []
    const anims = els.map((el) =>
      play(
        el,
        [
          { opacity: 1, translate: '0 0' },
          { opacity: 0, translate: '0 calc(3 * var(--d16-px))' },
        ],
        { duration: D16_T.exit, delay: D16_T.exitDelay, easing: EASE.in, fill: 'both' },
      ),
    )
    let alive = true
    Promise.all(anims.map((a) => a?.finished)).then(
      () => alive && setShown(target),
      () => undefined,
    )
    return () => {
      alive = false
      anims.forEach((a) => a?.cancel())
    }
  }, [target, shown, rootRef, selector])

  return shown
}
