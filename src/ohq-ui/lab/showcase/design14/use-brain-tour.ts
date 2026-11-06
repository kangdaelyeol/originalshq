import { useEffect, type RefObject } from 'react'
import type { BrainSceneHandle } from './brain-scene'
import { TOUR } from './design14-data'

/**
 * 자동 둘러보기 — 전체 보기(4.2초) → OPERATIONS → MARKETING → STRATEGY → SALES → FINANCE → YOU → ADMIN → 다시.
 * 영상 t=28.9·30.4·32.2처럼 1.5~2초마다 다음 부서를 누른 것과 같다. 켜면 전체 보기부터 시작한다.
 */
export function useBrainTour(scene: RefObject<BrainSceneHandle | null>, on: boolean) {
  useEffect(() => {
    if (!on) return
    let i = 0
    let timer = 0
    const step = () => {
      const { stop, ms } = TOUR[i % TOUR.length]
      scene.current?.focus(stop)
      i++
      timer = window.setTimeout(step, ms)
    }
    step()
    return () => window.clearTimeout(timer)
  }, [on, scene])
}
