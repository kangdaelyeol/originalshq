import { useMemo, type CSSProperties } from 'react'
import { Sparkline, TrendGrid } from '@/components/glass'
import {
  aggregateMetrics,
  type DateSummary,
  type MetricsSummary,
} from '../../client'
import { channelSafeFields, METRIC_FIELDS } from '../metric-fields'
import { trendSeriesOf } from '../../utils/trend-series'

export function KpiGrid({
  metrics,
  channelScoped,
  trend,
  detailPrefix,
  periodLabel,
}: {
  metrics: MetricsSummary
  /** true면 Meta/Google/Naver 개별 채널 KPI 카드 — 매출/ROAS 지표는 그 채널
   * 값이 항상 0이라(ACCOUNT_ONLY_METRIC_KEYS) 아예 보여주지 않는다. */
  channelScoped?: boolean
  /** 날짜별 값 — 있으면 칸마다 값 옆에 그 지표의 작은 추이 그래프, 칸을
   * 누르면 이 묶음 안에서 그 칸이 커지며 추이를 자세히 보여 준다(TrendGrid). */
  trend?: readonly DateSummary[]
  /** 자세히 볼 때 이름 앞에 붙일 것(채널 이름 등)과 기간. */
  detailPrefix?: string
  periodLabel?: string
}) {
  const fields = channelScoped
    ? channelSafeFields(METRIC_FIELDS)
    : METRIC_FIELDS
  // 오래된 날부터(그래프가 왼쪽 → 오른쪽으로 시간 순).
  const days = useMemo(
    () => [...(trend ?? [])].sort((a, b) => a.date.localeCompare(b.date)),
    [trend],
  )

  if (days.length < 2) {
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

  return (
    <TrendGrid
      className="channel-insight__summary-grid has-trend"
      tiles={fields.map(({ key, label, format }, index) => {
        const values = days.map((day) => day[key])
        return {
          key,
          className: 'channel-insight__kpi',
          // 칸마다 추이 그래프가 조금씩 늦게 그려진다.
          style: { '--glass-i': index } as CSSProperties,
          detail: {
            title: detailPrefix ? `${detailPrefix} · ${label}` : label,
            subtitle: periodLabel,
            value: format(metrics[key]),
            format,
            // 주별·월별은 묶은 날들의 합계로 다시 계산(ROAS 등 비율도 맞게).
            series: () =>
              trendSeriesOf(days, (group) => aggregateMetrics(group)[key]),
          },
          content: (
            <>
              <span className="channel-insight__kpi-label">{label}</span>
              <span className="channel-insight__kpi-row">
                <span className="channel-insight__kpi-value">
                  {format(metrics[key])}
                </span>
                <Sparkline
                  className="channel-insight__kpi-spark"
                  values={values}
                />
              </span>
            </>
          ),
        }
      })}
    />
  )
}
