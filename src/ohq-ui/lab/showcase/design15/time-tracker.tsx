import { Pause, Play } from 'lucide-react'
import { useLayoutEffect, useRef } from 'react'
import { DigitRoller } from './digit-roll'
import { cssVars, formatClock } from './d15-format'
import { prefersReducedMotion } from './d15-motion'
import { useTrackerRunning, type TrackerClock } from './tracker-clock'

interface TimeTrackerProps {
  clock: TrackerClock
  title?: string
  index?: number
}

// 바탕 물결선(F130 확대 화면) — 왼쪽 아래에서 오른쪽 위로 비스듬한 물결 여러 줄, 아주 옅게
const WAVES = Array.from({ length: 11 }, (_, k) => {
  const y = -30 + k * 13
  return `M -10 ${y + 70} C 30 ${y + 40}, 60 ${y + 62}, 100 ${y + 30} S 160 ${y + 10}, 200 ${y - 20}`
})

/**
 * 시간 기록(F205 x533~647, y305~378) — 짙은 강조색 카드·물결선·"01:24:08"·재생/멈춤(흰 동그라미)·정지(빨강).
 * 재생 중이면 초 경계마다 바뀐 자리만 굴린다(F167 08 → 09). 카드가 화면 밖이면 쉬고, 돌아오면 그 시각으로 놓는다.
 */
export function TimeTracker({ clock, title = 'Time Tracker', index = 7 }: TimeTrackerProps) {
  const running = useTrackerRunning(clock)
  const card = useRef<HTMLElement>(null)
  const digits = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const el = card.current
    const root = digits.current
    if (!el || !root) return
    const roller = new DigitRoller(root)
    const reduce = prefersReducedMotion()
    const show = (animate: boolean) => roller.set(formatClock(clock.elapsed()), animate && !reduce)
    show(false)
    let timer = 0
    let visible = true
    const schedule = () => {
      window.clearTimeout(timer)
      if (!clock.running || !visible) return
      const e = clock.elapsed()
      const wait = (Math.floor(e) + 1 - e) * 1000 + 8
      timer = window.setTimeout(() => {
        show(true)
        schedule()
      }, wait)
    }
    const io = new IntersectionObserver(([entry]) => {
      const was = visible
      visible = entry.isIntersecting
      if (visible && !was) show(false)
      schedule()
    })
    io.observe(el)
    const unsub = clock.subscribe(() => {
      show(true)
      schedule()
    })
    schedule()
    return () => {
      window.clearTimeout(timer)
      io.disconnect()
      unsub()
    }
  }, [clock])

  return (
    <section ref={card} className="d15-card d15-tracker d15-rise" style={cssVars({ '--i': index })}>
      <svg className="d15-tracker__waves" viewBox="0 0 114 73" preserveAspectRatio="none" aria-hidden>
        {WAVES.map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
      <h3 className="d15-tracker__title">{title}</h3>
      <span ref={digits} className="d15-tracker__time" role="timer" aria-label="Elapsed time" />
      <div className="d15-tracker__controls">
        <button
          type="button"
          className="d15-tracker__btn is-play"
          aria-label={running ? 'Pause' : 'Play'}
          data-tour="tracker-play"
          onClick={() => clock.toggle()}
        >
          {running ? <Pause aria-hidden fill="currentColor" /> : <Play aria-hidden fill="currentColor" />}
        </button>
        <button type="button" className="d15-tracker__btn is-stop" aria-label="Stop" onClick={() => clock.stop()}>
          <i aria-hidden />
        </button>
      </div>
    </section>
  )
}
