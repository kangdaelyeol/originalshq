import type { MetricsSummary } from '../../client'
import { channelSafeFields, METRIC_FIELDS } from '../metric-fields'

export function KpiGrid({
  metrics,
  channelScoped,
}: {
  metrics: MetricsSummary
  /** true면 Meta/Google/Naver 개별 채널 KPI 카드 — 매출/ROAS 지표는 그 채널
   * 값이 항상 0이라(ACCOUNT_ONLY_METRIC_KEYS) 아예 보여주지 않는다. */
  channelScoped?: boolean
}) {
  const fields = channelScoped
    ? channelSafeFields(METRIC_FIELDS)
    : METRIC_FIELDS
  return (
    <div className="channel-insight__summary-grid">
      {fields.map(({ key, label, format }) => (
        <div key={key} className="channel-insight__kpi">
          <span className="channel-insight__kpi-label">{label}</span>
          <span className="channel-insight__kpi-value">
            {format(metrics[key])}
          </span>
        </div>
      ))}
    </div>
  )
}
