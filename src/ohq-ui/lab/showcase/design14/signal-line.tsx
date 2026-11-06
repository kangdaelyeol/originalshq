import { useEffect, useRef } from 'react'
import { cx } from '../../../lib/cx'
import { drawSignal } from './brain-engine'
import { SIGNAL_SPEED } from './design14-data'

interface SignalLineProps {
  /** 1초에 새로 나가는 신호 수 */
  rate?: number
  /** 신호 빠르기(CSS px/s) — 장면 안 코어 ↔ 부서 줄과 같은 270w/s */
  speed?: number
  /** 꼬리 길이(CSS px) */
  tail?: number
  className?: string
}

/** 줄 하나와 그 위를 가는 신호(부품 견본) — 장면과 같은 drawSignal로 그린다. 왼쪽 → 오른쪽. */
export function SignalLine({ rate = 2.4, speed = SIGNAL_SPEED, tail = 70, className }: SignalLineProps) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let visible = true
    let w = 0
    let h = 0
    let dpr = 1
    let next = 0
    let starts: number[] = []
    const draw = (now: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      const ax = 16
      const bx = w - 16
      const y = h / 2
      ctx.strokeStyle = 'rgba(255,112,52,0.3)'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(ax, y)
      ctx.lineTo(bx, y)
      ctx.stroke()
      const dur = (bx - ax) / speed
      if (reduce) {
        drawSignal(ctx, ax, y, bx, y, 0.62, tail, 1.6, '255,118,52', 0.95)
        return
      }
      if (!next) next = now
      while (next <= now) {
        starts.push(next)
        next += -Math.log(1 - Math.random()) / rate
      }
      starts = starts.filter((s) => now - s < dur)
      for (const s of starts) {
        const p = (now - s) / dur
        drawSignal(ctx, ax, y, bx, y, p, tail, 1.6, '255,118,52', 0.95 * Math.min(1, p / 0.08, (1 - p) / 0.12))
      }
    }
    const tick = (time: number) => {
      raf = 0
      draw(time / 1000)
      if (!reduce && visible) raf = requestAnimationFrame(tick)
    }
    const measure = () => {
      const box = canvas.getBoundingClientRect()
      dpr = Math.min(2, window.devicePixelRatio || 1)
      w = box.width
      h = box.height
      canvas.width = Math.max(1, Math.round(w * dpr))
      canvas.height = Math.max(1, Math.round(h * dpr))
      draw(performance.now() / 1000)
    }
    const resize = new ResizeObserver(measure)
    resize.observe(canvas)
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible && !raf && !reduce) raf = requestAnimationFrame(tick)
    })
    io.observe(canvas)
    measure()
    return () => {
      cancelAnimationFrame(raf)
      resize.disconnect()
      io.disconnect()
    }
  }, [rate, speed, tail])

  return <canvas ref={ref} className={cx('d14-signal-line', className)} aria-hidden="true" />
}
