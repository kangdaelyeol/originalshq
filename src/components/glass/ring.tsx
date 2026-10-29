import './ring.scss'
import { useEffect, useState } from 'react'

/**
 * 비율 링 — 값 하나(0~1)를 원 둘레로. 가운데에 비율 글자. 전환율처럼 "전체
 * 중 얼마"인 지표 하나에만 쓴다(여러 조각을 나누는 도넛이 아니다).
 */
export const Ring = ({
  value,
  text,
  label,
}: {
  /** 0~1. 범위를 넘으면 끝에서 멈춘다. */
  value: number
  /** 가운데 글자 — "64%". */
  text: string
  /** 읽어 주는 이름 — "CS팀 전환율". */
  label: string
}) => {
  const radius = 26
  const length = 2 * Math.PI * radius
  const clamped = Math.min(1, Math.max(0, value))
  // 처음엔 빈 원으로 그리고 다음 그리기에서 값으로 — 호가 차오르는 움직임은
  // ring.scss의 transition이 맡는다(값이 바뀔 때도 이어서 움직인다).
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      requestAnimationFrame(() => setShown(clamped)),
    )
    return () => cancelAnimationFrame(frame)
  }, [clamped])
  return (
    <span className="glass_ring" role="img" aria-label={`${label} ${text}`}>
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <circle className="glass_ring_track" cx="32" cy="32" r={radius} />
        <circle
          className="glass_ring_fill"
          cx="32"
          cy="32"
          r={radius}
          strokeDasharray={`${shown * length} ${length}`}
        />
      </svg>
      <span className="glass_ring_text">{text}</span>
    </span>
  )
}
