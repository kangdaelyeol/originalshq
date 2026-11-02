import { animate, motion, useMotionValue, useMotionValueEvent, type AnimationPlaybackControls } from 'motion/react'
import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import { useD8Sidebar } from './sidebar-context'
import { D8_PILL } from './sidebar-data'
import { slowSpring } from './sidebar-motion'

/**
 * 선택 알약 — 고른 항목 뒤 유리 알약(높이 4.8em). 다른 항목을 고르면 가는 쪽 가장자리가 먼저
 * 스프링으로 뻗고, 반대쪽은 0.147초 뒤 따라와 줄어든다(F96~F109). 접혔을 땐 폭이 패널을 따라
 * 줄어 원이 되고, 독 확대로 항목이 움직여도 항목 가운데에 붙어 있다(F19~F25, 차이 1px 안).
 * 위치는 매 프레임 항목 상자에서 다시 읽는다 — 앞·뒤 진행률(0→1)로 출발 자리와 지금 자리를 섞는다.
 */
export function SelectionPill({ value, listRef }: { value: string; listRef: RefObject<HTMLDivElement | null> }) {
  const { itemEl, subscribeLayout, notifyLayout, getScale } = useD8Sidebar()
  const top = useMotionValue(0)
  const height = useMotionValue(0)
  const lead = useMotionValue(1)
  const trail = useMotionValue(1)
  const valueRef = useRef(value)
  const from = useRef<{ top: number; bottom: number; down: boolean } | null>(null)
  useMotionValueEvent(lead, 'change', notifyLayout)
  useMotionValueEvent(trail, 'change', notifyLayout)

  const sync = useCallback(() => {
    const el = itemEl(valueRef.current)
    const list = listRef.current
    if (!el || !list) return
    const half = (D8_PILL.height * parseFloat(getComputedStyle(list).fontSize)) / 2
    const c = el.offsetTop + el.offsetHeight / 2
    let t = c - half
    let b = c + half
    const f = from.current
    if (f) {
      const l = lead.get()
      const r = trail.get()
      if (f.down) {
        b = f.bottom + (b - f.bottom) * l
        t = f.top + (t - f.top) * r
      } else {
        t = f.top + (t - f.top) * l
        b = f.bottom + (b - f.bottom) * r
      }
      if (l >= 1 && r >= 1) from.current = null
    }
    top.set(t)
    height.set(b - t)
  }, [itemEl, listRef, lead, trail, top, height])

  // 고른 항목이 바뀌면 — 지금 보이는 자리를 출발점으로 잡고 두 가장자리 스프링을 건다
  useLayoutEffect(() => {
    let runs: AnimationPlaybackControls[] = []
    if (valueRef.current !== value) {
      const el = itemEl(value)
      const t0 = top.get()
      const b0 = t0 + height.get()
      valueRef.current = value
      if (el) {
        const c = el.offsetTop + el.offsetHeight / 2
        from.current = { top: t0, bottom: b0, down: c > (t0 + b0) / 2 }
        lead.jump(0)
        trail.jump(0)
        const s = getScale()
        runs = [animate(lead, 1, slowSpring(D8_PILL.lead, s)), animate(trail, 1, slowSpring(D8_PILL.trail, s))]
      }
    }
    sync()
    return () => runs.forEach((r) => r.stop())
  }, [value, itemEl, top, height, lead, trail, getScale, sync])

  useEffect(() => subscribeLayout(sync), [subscribeLayout, sync])

  return <motion.div className="d8-pill" style={{ top, height }} aria-hidden="true" />
}
