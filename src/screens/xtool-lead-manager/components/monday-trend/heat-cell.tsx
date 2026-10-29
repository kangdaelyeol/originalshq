import type { CSSProperties } from 'react'

/** 히트맵 칸 — 그 칸(열)의 최댓값 대비 세기(--heat, 0~1)로 바탕을 칠한다.
 * 0은 비워 둔다. 오기입 칸은 경고색. */
export const HeatCell = ({
  value,
  max,
  warn = false,
}: {
  value: number
  max: number | undefined
  warn?: boolean
}) => (
  <td
    className={`heat_cell${warn ? ' is-warn' : ''}${value === 0 ? ' is-zero' : ''}`}
    style={{ '--heat': max ? value / max : 0 } as CSSProperties}
  >
    {value}
  </td>
)
