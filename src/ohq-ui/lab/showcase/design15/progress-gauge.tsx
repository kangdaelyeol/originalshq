import { useId, useLayoutEffect, useRef } from 'react'
import { CountUp } from './count-up'
import { cssVars } from './d15-format'
import { easeInOutCubic, GAUGE_DELAY_MS, GAUGE_MS, GAUGE_STAGGER_MS, prefersReducedMotion, tween } from './d15-motion'

interface ProgressGaugeProps {
  /** 끝난 비율(0~1) — 큰 % 글과 강조색 호 */
  completed: number
  /** 진행 중 비율(0~1) — 짙은 호(끝난 호 뒤에서 이어진다) */
  inProgress: number
  title?: string
  label?: string
  index?: number
  /** 그리기 시작(ms) */
  delay?: number
}

// 반원(F205): 가운데 (449,351), 반지름 38px, 굵기 17px, 끝 둥글게. 호 셋을 겹쳐 그린다 — 맨 아래 빗금(전체),
// 그 위 짙은 색(완료+진행), 맨 위 강조색(완료). 그래서 각 호의 둥근 끝이 아래 호 위로 올라온다(F205 6배 확대).
const R = 38
const CX = 46.5
const CY = 46.5
const ARC = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`

/**
 * Project Progress 반원 — 세 호가 0.1초 간격으로 easeInOutCubic 0.73초에 왼쪽 끝부터 자란다(F871~F895).
 * 값이 바뀌면 지금 길이에서 새 길이로 다시 그린다(F92~F100 42% → 40%).
 */
export function ProgressGauge({
  completed,
  inProgress,
  title = 'Project Progress',
  label = 'Project Ended',
  index = 9,
  delay = GAUGE_DELAY_MS,
}: ProgressGaugeProps) {
  const hatch = `d15-hatch-${useId().replace(/:/g, '')}`
  const arcs = useRef<(SVGPathElement | null)[]>([])
  const shown = useRef<number[] | null>(null)
  const pct = Math.round(completed * 100)

  useLayoutEffect(() => {
    const targets = [100, Math.min(100, (completed + inProgress) * 100), completed * 100]
    const first = shown.current === null
    const from = shown.current ?? [0, 0, 0]
    const set = (k: number, v: number) => {
      const el = arcs.current[k]
      if (el) el.setAttribute('stroke-dasharray', `${v} 200`)
    }
    if (prefersReducedMotion()) {
      targets.forEach((v, k) => set(k, v))
      shown.current = targets
      return
    }
    const prev = shown.current
    const now = [...from]
    shown.current = now
    if (first) targets.forEach((_, k) => set(k, 0))
    let begun = false
    // 맨 위(완료)가 먼저, 짙은 호, 빗금 순서 — 그리는 차례는 아래에서 위지만 자라는 차례는 위에서 아래
    const stops = targets.map((to, k) => {
      const order = 2 - k
      return tween(
        GAUGE_MS,
        (u) => {
          begun = true
          now[k] = from[k] + (to - from[k]) * easeInOutCubic(u)
          set(k, now[k])
        },
        (first ? delay : 0) + order * GAUGE_STAGGER_MS,
      )
    })
    return () => {
      stops.forEach((stop) => stop())
      // StrictMode의 첫 번째 효과는 시작 전에 걷힌다 — "처음" 상태를 되돌려 다음 번이 지연째로 그리게
      if (!begun) shown.current = prev
    }
  }, [completed, inProgress, delay])

  return (
    <section className="d15-card d15-gauge d15-rise" style={cssVars({ '--i': index })}>
      <h3 className="d15-card__title">{title}</h3>
      <svg className="d15-gauge__svg" viewBox="0 0 93 56" aria-hidden>
        <defs>
          <pattern id={hatch} width="3.4" height="3.4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="3.4" height="3.4" className="d15-hatch__bg" />
            <rect width="1" height="3.4" className="d15-hatch__line" />
          </pattern>
        </defs>
        {(['pending', 'doing', 'done'] as const).map((tone, k) => (
          <path
            key={tone}
            ref={(el) => {
              arcs.current[k] = el
            }}
            d={ARC}
            pathLength={100}
            className={`d15-gauge__arc is-${tone}`}
            stroke={tone === 'pending' ? `url(#${hatch})` : undefined}
            strokeDasharray="0 200"
          />
        ))}
      </svg>
      <div className="d15-gauge__center">
        <p className="d15-gauge__pct">
          <CountUp value={pct} format="pct" />
        </p>
        <p className="d15-gauge__label">{label}</p>
      </div>
      <ul className="d15-legend">
        <li>
          <i className="is-accent" />
          Completed
        </li>
        <li>
          <i className="is-deep" />
          In Progress
        </li>
        <li>
          <i className="is-hatch" />
          Pending
        </li>
      </ul>
    </section>
  )
}
