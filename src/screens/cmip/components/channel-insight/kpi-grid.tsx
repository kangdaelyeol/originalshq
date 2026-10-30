import { useMemo, type CSSProperties } from 'react'
import { Sparkline } from '@/components/glass'
import type { DateSummary, MetricsSummary } from '../../client'
import { channelSafeFields, METRIC_FIELDS } from '../metric-fields'

export function KpiGrid({
  metrics,
  channelScoped,
  trend,
}: {
  metrics: MetricsSummary
  /** true면 Meta/Google/Naver 개별 채널 KPI 카드 — 매출/ROAS 지표는 그 채널
   * 값이 항상 0이라(ACCOUNT_ONLY_METRIC_KEYS) 아예 보여주지 않는다. */
  channelScoped?: boolean
  /** 날짜별 값 — 있으면 칸마다 값 옆에 그 지표의 작은 추이 그래프. */
  trend?: readonly DateSummary[]
}) {
  const fields = channelScoped
    ? channelSafeFields(METRIC_FIELDS)
    : METRIC_FIELDS
  // 오래된 날부터(그래프가 왼쪽 → 오른쪽으로 시간 순).
  const days = useMemo(
    () => [...(trend ?? [])].sort((a, b) => a.date.localeCompare(b.date)),
    [trend],
  )
  return (
    <div
      className={`channel-insight__summary-grid${days.length > 1 ? ' has-trend' : ''}`}
    >
      {fields.map(({ key, label, format }, index) => (
        <div
          key={key}
          className="channel-insight__kpi"
          // 칸마다 추이 그래프가 조금씩 늦게 그려진다.
          style={{ '--glass-i': index } as CSSProperties}
        >
          <span className="channel-insight__kpi-label">{label}</span>
          <span className="channel-insight__kpi-row">
            <span className="channel-insight__kpi-value">
              {format(metrics[key])}
            </span>
            {days.length > 1 && (
              <Sparkline
                className="channel-insight__kpi-spark"
                values={days.map((day) => day[key])}
              />
            )}
          </span>
        </div>
      ))}
    </div>
  )
}
