import { Download } from 'lucide-react'
import { useState } from 'react'
import { ActivityHeatmap, TopContributors } from './activity-panels'
import {
  D15_ACTIVITY,
  D15_CONTRIBUTORS,
  D15_PAGE_HEAD,
  D15_RANGE_DATA,
  D15_RANGES,
  D15_SPARKS,
  D15_THROUGHPUT,
  D15_TIME_PROJECTS,
  type D15Range,
} from './design15-data'
import { KpiTile } from './kpi-tile'
import { PageHead } from './page-head'
import { PillTabs } from './pill-tabs'
import { ThroughputChart } from './throughput-chart'
import { TimeDonut } from './time-donut'

/**
 * Analytics(F590~F700) — 기간 알약(7D·30D·90D)·KPI 넷·처리량·프로젝트별 시간·활동·기여자.
 * 처음은 30D(F574~F596에 0에서 오른다), 90D를 누르면 숫자·고리·그래프가 지금 값에서 새 값으로 옮겨 간다(F597~F680).
 */
export function AnalyticsPage() {
  const [range, setRange] = useState<D15Range>('30D')
  const data = D15_RANGE_DATA[range]
  const days = D15_THROUGHPUT.slice(-data.days)
  const head = D15_PAGE_HEAD.analytics
  return (
    <div className="d15-analytics">
      <PageHead
        title={head.title}
        sub={head.sub}
        actions={
          <>
            <PillTabs
              options={D15_RANGES}
              value={range}
              onChange={setRange}
              tourId="range"
              className="is-compact"
              label="Range"
            />
            <button type="button" className="d15-btn d15-btn--ghost">
              <Download aria-hidden strokeWidth={2.2} />
              Export CSV
            </button>
          </>
        }
      />
      <div className="d15-analytics__grid">
        <div className="d15-analytics__kpis">
          {data.kpis.map((kpi, k) => (
            <KpiTile key={kpi.label} kpi={kpi} range={range} spark={D15_SPARKS[k]} index={k} />
          ))}
        </div>
        <ThroughputChart days={days} index={4} />
        <TimeDonut
          items={D15_TIME_PROJECTS.map((p, k) => ({ ...p, hours: data.hours[k] }))}
          caption={`tracked · ${range.toLowerCase()}`}
          index={5}
        />
        <ActivityHeatmap levels={D15_ACTIVITY} index={6} />
        <TopContributors rows={D15_CONTRIBUTORS} index={7} />
      </div>
    </div>
  )
}
