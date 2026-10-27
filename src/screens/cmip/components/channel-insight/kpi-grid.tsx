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
  const fields = channelScoped ? channelSafeFields(METRIC_FIELDS) : METRIC_FIELDS
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

/** 조회 중(로딩)일 때 KpiGrid 자리에 대신 깔아두는 스켈레톤 — 값이 들어올 자리를
 * 그대로 흉내 내서(라벨 폭 짧게, 값 폭 길게) 레이아웃이 흔들리지 않게 한다. */
export function KpiSkeletonGrid() {
  return (
    <div className="channel-insight__summary-grid" aria-hidden>
      {METRIC_FIELDS.map(({ key }) => (
        <div key={key} className="channel-insight__kpi">
          <span className="channel-insight__skeleton-bar channel-insight__skeleton-bar--label" />
          <span className="channel-insight__skeleton-bar channel-insight__skeleton-bar--value" />
        </div>
      ))}
    </div>
  )
}
