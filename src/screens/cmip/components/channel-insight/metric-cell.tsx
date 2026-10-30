import { DELTA_ARROW, computeMetricDelta } from './metric-delta'

/** 지표 한 칸의 내용 — 대비 표시가 꺼져 있거나 비교할 이전 값이 없으면 값만,
 * 켜져 있으면 왼쪽에 증감/등락률, 오른쪽에 값을 같이 보여준다. 메인 행과 채널별
 * 펼침 행이 이 렌더링을 공유한다. */
export function MetricCell({
  value,
  prevValue,
  format,
  showCompare,
}: {
  value: number
  prevValue: number | null
  format: (v: number) => string
  showCompare: boolean
}) {
  const cmp = showCompare ? computeMetricDelta(value, prevValue) : null
  if (!cmp) return <>{format(value)}</>
  return (
    <span className="channel-insight__metric-cell">
      <span className={`channel-insight__metric-delta is-${cmp.dir}`}>
        {DELTA_ARROW[cmp.dir]} {format(Math.abs(cmp.delta))}
        {cmp.pct != null &&
          ` (${cmp.delta >= 0 ? '+' : '-'}${Math.abs(cmp.pct).toFixed(1)}%)`}
      </span>
      <span className="channel-insight__metric-value">{format(value)}</span>
    </span>
  )
}
