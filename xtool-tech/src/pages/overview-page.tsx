import { useMemo, useState } from 'react'
import { ActivityLog } from '../components/board/activity-log'
import { DeployTable } from '../components/board/deploy-table'
import { AreaChart } from '../components/charts/area-chart'
import { DonutChart } from '../components/charts/donut-chart'
import { CATEGORICAL, SERIES_PRIMARY } from '../components/charts/palette'
import { GlassCard } from '../components/ui/glass-card'
import { SegmentedControl } from '../components/ui/segmented-control'
import { StatCard } from '../components/ui/stat-card'
import { StatusPill } from '../components/ui/status-pill'
import { usePeriod } from '../context/period-context'
import {
  ACTIVITY,
  DEPLOY_FILTERS,
  OVERVIEW_KPIS,
  OVERVIEW_MEASURES,
  RECENT_DEPLOYS,
  WORK_MIX,
  overviewTrend,
  type DeployFilter,
  type OverviewMeasure,
} from '../data/overview'
import { formatInt } from '../lib/format'

const MEASURE_UNIT: Record<OverviewMeasure, string> = { deploys: '회', commits: '개', prs: '건' }

export function OverviewPage() {
  const { period } = usePeriod()
  const [measure, setMeasure] = useState<OverviewMeasure>('deploys')
  const [filter, setFilter] = useState<DeployFilter>('all')

  const trend = useMemo(() => overviewTrend(period, measure), [period, measure])
  const measureLabel = OVERVIEW_MEASURES.find((m) => m.value === measure)?.label ?? ''
  const mix = WORK_MIX[period].map((slice, i) => ({ ...slice, color: CATEGORICAL[i] }))
  const deploys = filter === 'all' ? RECENT_DEPLOYS : RECENT_DEPLOYS.filter((d) => d.status === filter)

  return (
    <>
      <div className="grid grid--kpi">
        {OVERVIEW_KPIS[period].map(({ key, ...kpi }) => (
          <StatCard key={key} {...kpi} />
        ))}
      </div>

      <div className="grid grid--main-side">
        <GlassCard
          title="개발 생산성 추이"
          actions={
            <SegmentedControl size="sm" ariaLabel="추이 지표" options={OVERVIEW_MEASURES} value={measure} onChange={setMeasure} />
          }
        >
          <AreaChart
            labels={trend.labels}
            series={[{ key: measure, label: `${measureLabel} 수`, color: SERIES_PRIMARY, values: trend.values }]}
            height={256}
            integer
            ariaLabel={`기간별 ${measureLabel} 수 추이`}
            formatValue={(v) => `${formatInt(v)}${MEASURE_UNIT[measure]}`}
          />
        </GlassCard>

        <GlassCard title="작업 유형 분포">
          <DonutChart segments={mix} unit="건" ariaLabel="작업 유형별 비중" />
        </GlassCard>
      </div>

      <div className="grid grid--main-side">
        <GlassCard
          title="최근 배포 내역"
          actions={
            <SegmentedControl
              variant="chips"
              size="sm"
              ariaLabel="배포 상태 필터"
              options={DEPLOY_FILTERS}
              value={filter}
              onChange={setFilter}
            />
          }
        >
          <DeployTable rows={deploys} />
        </GlassCard>

        <GlassCard
          title="실시간 활동 로그"
          actions={
            <StatusPill tone="good" dot="pulse">
              Live Feed
            </StatusPill>
          }
        >
          <ActivityLog items={ACTIVITY} />
        </GlassCard>
      </div>
    </>
  )
}
