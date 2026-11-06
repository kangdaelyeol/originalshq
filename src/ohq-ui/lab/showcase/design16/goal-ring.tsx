interface GoalRingProps {
  /** 0~1 */
  value: number
  label: string
  sub: string
  /** 지름(영상 px) */
  size?: number
}

/**
 * 목표 고리 — 바깥 지름 54.6px, 두께 4.5px 어두운 길 위에 강조색 호(끝 둥글게, 12시에서 시계 방향).
 * 1%는 둥근 끝 때문에 작은 알약처럼 보인다(F30 x 516.7~523.3).
 */
export function GoalRing({ value, label, sub, size = 54.6 }: GoalRingProps) {
  const r = 25
  const pct = Math.max(0, Math.min(1, value)) * 100
  return (
    <div className="d16-ring" style={{ width: `calc(${size} * var(--d16-px))` }}>
      <svg viewBox="0 0 54.6 54.6" aria-hidden>
        <circle className="d16-ring__track" cx="27.3" cy="27.3" r={r} />
        <circle
          className="d16-ring__arc"
          cx="27.3"
          cy="27.3"
          r={r}
          pathLength={100}
          strokeDasharray={`${pct} 100`}
          transform="rotate(-90 27.3 27.3)"
        />
      </svg>
      <span className="d16-ring__label">{label}</span>
      <span className="d16-ring__sub">{sub}</span>
    </div>
  )
}
