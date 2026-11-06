import { useRef } from 'react'
import { formatCount, useCountUp, type CountFormat } from './use-count-up'
import { DeltaChip } from './delta-chip'
import { Sparkline } from './sparkline'
import { D16_T } from './d16-motion'

interface KpiStatProps {
  label: string
  value: number
  format: CountFormat
  delta: string
  note: string
  down?: boolean
  spark?: readonly number[]
  /** lg: 14.8px(첫 칸 $244) · md: 11.4px(영상 $6,413 잉크 폭 30px · 6 높이 8px) */
  size?: 'lg' | 'md'
  /** 오르기 시작(초) — null이면 바로 끝 값 */
  countDelay?: number | null
  /** 다시 오르게 할 때 바꾸는 값 */
  playKey?: number
}

/** KPI 한 칸 — 라벨(5.2px 회색)·큰 숫자(14.8px 600, quartOut 1.06초로 오른다)·변화 칩·비교 글 */
export function KpiStat({
  label,
  value,
  format,
  delta,
  note,
  down,
  spark,
  size = 'lg',
  countDelay = null,
  playKey = 0,
}: KpiStatProps) {
  const numRef = useRef<HTMLSpanElement>(null)
  useCountUp(numRef, value, format, {
    delay: countDelay ?? 0,
    duration: D16_T.count,
    playKey: countDelay === null ? null : playKey,
  })
  return (
    <div className={`d16-kpi d16-kpi--${size}`}>
      <p className="d16-kpi__label">{label}</p>
      <p className="d16-kpi__value">
        <span ref={numRef}>{formatCount(value, format)}</span>
      </p>
      <p className="d16-kpi__foot">
        <DeltaChip value={delta} down={down} />
        <span className="d16-kpi__note">{note}</span>
      </p>
      {spark && (
        <Sparkline
          className="d16-kpi__spark"
          values={spark}
          drawDelay={countDelay === null ? null : countDelay + 0.1}
        />
      )}
    </div>
  )
}
