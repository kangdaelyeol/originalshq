import { useMemo, useState } from 'react'
import { AreaChart, type ChartSeries } from '../components/charts/area-chart'
import { LatencyBars } from '../components/charts/latency-bars'
import { CATEGORICAL, OTHER_GRAY, SERIES_COMPARE, SERIES_PRIMARY } from '../components/charts/palette'
import { ShareBar } from '../components/charts/share-bar'
import { GlassCard } from '../components/ui/glass-card'
import { SegmentedControl } from '../components/ui/segmented-control'
import { StatCard } from '../components/ui/stat-card'
import { StatusPill } from '../components/ui/status-pill'
import { usePeriod } from '../context/period-context'
import {
  ANALYTICS_KPIS,
  LATENCY_SCALE_MS,
  LATENCY_TARGET_MS,
  SERVICE_LATENCY,
  TRAFFIC_METRICS,
  TRAFFIC_SOURCES,
  trafficWave,
  type TrafficMetric,
} from '../data/analytics'
import { PERIOD_COMPARE } from '../data/period'
import { compact, formatInt } from '../lib/format'

const sum = (values: readonly number[]) => values.reduce((s, v) => s + v, 0)

export function AnalyticsPage() {
  const { period } = usePeriod()
  const [metric, setMetric] = useState<TrafficMetric>('requests')

  const wave = useMemo(() => trafficWave(period, metric), [period, metric])
  const names = PERIOD_COMPARE[period]
  const isRequests = metric === 'requests'
  const series: ChartSeries[] = [
    { key: 'current', label: names.current, color: SERIES_PRIMARY, values: wave.current },
    { key: 'previous', label: names.previous, color: SERIES_COMPARE, values: wave.previous },
  ]
  const summarize = (values: readonly number[]) =>
    isRequests ? `합계 ${compact(sum(values))}` : `평균 ${(sum(values) / values.length).toFixed(1)}ms`

  // 넷째 칸("기타")은 범주 색을 늘리지 않고 회색으로 묶는다.
  const sources = TRAFFIC_SOURCES.map((s, i) => ({ ...s, color: CATEGORICAL[i] ?? OTHER_GRAY }))

  return (
    <>
      <div className="grid grid--kpi">
        {ANALYTICS_KPIS[period].map(({ key, ...kpi }) => (
          <StatCard key={key} {...kpi} />
        ))}
      </div>

      <GlassCard
        title="트래픽 파형"
        subtitle={`현재 기간과 직전 기간의 API ${isRequests ? '요청 수를' : '응답 시간을'} 같은 축에서 비교해요`}
        actions={
          <>
            <StatusPill tone="good" dot="pulse">
              Live · 18.4k req/min
            </StatusPill>
            <SegmentedControl size="sm" ariaLabel="파형 지표" options={TRAFFIC_METRICS} value={metric} onChange={setMetric} />
          </>
        }
      >
        <AreaChart
          labels={wave.labels}
          series={series}
          height={290}
          ariaLabel={`${isRequests ? '요청 수' : '응답 시간'} 비교 — ${names.current} · ${names.previous}`}
          formatTick={isRequests ? compact : (v) => `${v}ms`}
          formatValue={isRequests ? formatInt : (v) => `${v.toFixed(1)}ms`}
        />
        <footer className="chart-footer">
          <ul className="chart-legend">
            {series.map((s) => (
              <li key={s.key}>
                <span className="line-key" style={{ background: s.color }} aria-hidden />
                {s.label}
                <strong>{summarize(s.values)}</strong>
              </li>
            ))}
          </ul>
          <p className="chart-footer__aside">
            SLA 달성률<strong className="text-good">99.99%</strong>
          </p>
        </footer>
      </GlassCard>

      <div className="grid grid--wide-narrow">
        <GlassCard
          title="서비스별 응답 지연"
          subtitle="주요 엔드포인트 p95 기준"
          actions={<span className="target-chip">목표 &lt; {LATENCY_TARGET_MS}ms</span>}
        >
          <LatencyBars rows={SERVICE_LATENCY} target={LATENCY_TARGET_MS} scale={LATENCY_SCALE_MS} />
        </GlassCard>

        <GlassCard title="트래픽 소스 분포" subtitle="채널별 요청 비중">
          <ShareBar items={sources} ariaLabel="채널별 요청 비중" />
        </GlassCard>
      </div>
    </>
  )
}
