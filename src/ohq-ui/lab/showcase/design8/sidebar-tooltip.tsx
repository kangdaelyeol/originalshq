import { AnimatePresence, animate, motion, useMotionValue, useTransform, type MotionValue } from 'motion/react'
import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import { useD8Sidebar, type D8TipTarget } from './sidebar-context'
import { D8_TOOLTIP } from './sidebar-data'
import { slowSpring, slowTween } from './sidebar-motion'

/** 툴팁 말풍선 — 밝은 회색 판(높이 3.5em·둥글기 1.1em) + 라벨(600·15px) + 오른쪽 칩(⌘K·12·3·[) */
export function TooltipBubble({ label, chip }: { label: string; chip?: string }) {
  return (
    <span className="d8-tip__bubble">
      <span className="d8-tip__label">{label}</span>
      {chip && <span className="d8-tip__chip">{chip}</span>}
    </span>
  )
}

/**
 * 접힌 사이드바의 툴팁 — 기준(패널·토글) 오른쪽 1.4em에 뜨고, 세로는 가리킨 항목 가운데를
 * 스프링으로 따라간다. 처음 뜰 때는 그 자리에서 왼쪽 0.4em·0.92배로부터 나타나고(0.18초),
 * 떠 있는 동안 다른 항목으로 옮기면 글자는 바로 바뀌고 판만 미끄러진다(F20~F23).
 */
export function SidebarTooltip({
  target,
  width,
  wrapRef,
}: {
  target: D8TipTarget | null
  /** 패널 폭(em) — 펼치는 동안 토글을 따라가려고 */
  width: MotionValue<number>
  wrapRef: RefObject<HTMLDivElement | null>
}) {
  const { expanded, subscribeLayout, getScale, timeScale } = useD8Sidebar()
  const y = useMotionValue(0)
  const leftPanel = useTransform(width, (w) => `${w + D8_TOOLTIP.gap}em`)
  // 토글 툴팁은 접혔을 땐 토글 오른쪽(오른쪽 끝 + 1.4em), 펼치면 패널 안쪽 왼편으로 넘어간다 —
  // 오른쪽 끝이 토글 가운데에서 6.5em 왼쪽(F76~F79에 판이 토글을 지나 왼쪽으로 미끄러진다).
  const side = useMotionValue(expanded ? 1 : 0)
  const leftToggle = useTransform(() => {
    const w = width.get()
    const s = side.get()
    return `${(w + 1.55 + D8_TOOLTIP.gap) * (1 - s) + (w - 6.5) * s}em`
  })
  const shiftToggle = useTransform(side, (s) => `${-100 * s}%`)
  useEffect(() => {
    const run = animate(side, expanded ? 1 : 0, slowSpring(D8_TOOLTIP.ySpring, getScale()))
    return () => run.stop()
  }, [expanded, side, getScale])
  const targetRef = useRef<D8TipTarget | null>(null)
  const shownRef = useRef(false)

  const measure = useCallback(() => {
    const t = targetRef.current
    const wrap = wrapRef.current
    if (!t || !wrap) return null
    const r = t.el.getBoundingClientRect()
    return r.top + r.height / 2 - wrap.getBoundingClientRect().top
  }, [wrapRef])

  // 대상이 바뀌면 — 처음 뜨면 그 자리로 바로, 떠 있던 중이면 스프링으로 옮긴다
  useLayoutEffect(() => {
    targetRef.current = target
    if (!target) {
      shownRef.current = false
      return
    }
    const v = measure()
    if (v == null) return
    if (shownRef.current) animate(y, v, slowSpring(D8_TOOLTIP.ySpring, getScale(), 0.05))
    else y.jump(v)
    shownRef.current = true
  }, [target, measure, y, getScale])

  // 독 확대로 항목이 움직이면 따라간다
  useEffect(
    () =>
      subscribeLayout(() => {
        if (!shownRef.current) return
        const v = measure()
        if (v != null && Math.abs(v - y.get()) > 0.05) animate(y, v, slowSpring(D8_TOOLTIP.ySpring, getScale(), 0.05))
      }),
    [subscribeLayout, measure, y, getScale],
  )

  return (
    <AnimatePresence>
      {target && (
        <motion.div
          key="tip"
          className="d8-tip"
          style={
            target.anchor === 'toggle'
              ? { left: leftToggle, top: y, x: shiftToggle, y: '-50%' }
              : { left: leftPanel, top: y, y: '-50%' }
          }
        >
          <motion.div
            role="tooltip"
            className="d8-tip__body"
            initial={{ opacity: 0, x: '-0.4em', scale: 0.92 }}
            animate={{ opacity: 1, x: '0em', scale: 1 }}
            exit={{ opacity: 0, x: '-0.4em', transition: slowTween(D8_TOOLTIP.exit, timeScale) }}
            transition={slowTween(D8_TOOLTIP.enter, timeScale)}
          >
            <TooltipBubble label={target.label} chip={target.chip} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
