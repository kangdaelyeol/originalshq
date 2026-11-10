import { Banknote, Boxes, Package, Trophy } from 'lucide-react'
import { Segmented, StatTile } from '@/components/glass'
import type {
  InflowView,
  useMondayTrendViewModel,
} from '@/screens/xtool-lead-manager/view-model'
import {
  formatWon,
  INFLOW_UNIT_AVERAGE,
  INFLOW_UNIT_LABEL,
  INFLOW_UNIT_NOUN,
  SALES_CHANNEL_LABEL,
  SALES_CHART_METRIC_LABEL,
  splitSalesKey,
  type InflowSortKey,
  type InflowUnit,
  type SalesChartMetric,
} from '@/screens/xtool-lead-manager/utils'
import { BoardTrendList } from './board-trend-list'
import { HeatmapTable } from './heatmap-table'
import { InflowChart, type InflowSplit } from './inflow-chart'

type SalesProps = {
  sales: ReturnType<typeof useMondayTrendViewModel>['state']['sales']
  unit: InflowUnit
  onSort: (key: InflowSortKey) => void
  onView: (view: InflowView) => void
  onChartMetric: (metric: SalesChartMetric) => void
  /** 기간이 바뀌면 그래프를 새로 그리게 하는 키(monday-trend.tsx). */
  drawKey: string
}

const VIEW_LABEL: Record<InflowView, string> = {
  trend: '제품별 추이',
  table: '표',
}

// 그래프 툴팁의 이름·단위 — 금액은 만원으로 그린다(원은 자릿수가 너무 길다).
const CHART_METRIC: Record<SalesChartMetric, { name: string; unit: string }> = {
  quantity: { name: '판매', unit: '개' },
  amount: { name: '판매', unit: '만원' },
}

// 그래프 툴팁 — 제품마다 오프라인·온라인 표시를 단다(같은 이름이면 한 줄로).
const CHANNEL_SPLIT: InflowSplit = {
  keyOf: (key) => {
    const { channel, name } = splitSalesKey(key)
    return { name, tag: SALES_CHANNEL_LABEL[channel] }
  },
  tags: [SALES_CHANNEL_LABEL.offline, SALES_CHANNEL_LABEL.online],
}

// 제품별 추이에 보여 줄 제품 수 — 제품이 백 개가 넘어 목록이 너무 길어진다.
const TREND_LIMIT = 15

const units = (value: number): string => `${value.toLocaleString('ko-KR')}개`

/**
 * 판매통계 — 조회 기간에 제품별로 몇 개가 팔렸는지를 기간(일/주/월)별 표로.
 * 줄이 기간, 칸이 제품이다(인입통계 표의 "줄 = 기간, 칸 = 보드"와 같은 모양).
 *
 * 오프라인 결제(Monday 결제 보드의 품목 줄)와 온라인몰(Cafe24) 주문 품목을
 * 합쳐서 센다. 취소된 결제·주문, 취소·반품된 품목, 그리고 제품이 아닌 줄
 * (할인, 계약금·분할납부, 장기 할부 이자)은 빠져 있다.
 *
 * 제품은 이름으로 구분한다. 오프라인과 온라인이 같은 제품을 다른 이름으로
 * 적는 경우가 많아 그런 제품은 두 칸으로 따로 나온다.
 *
 * 인입통계와 같은 모양 — 숫자 타일, 기간별 판매 그래프([수량 | 금액]), 그
 * 아래 제품 현황([제품별 추이 | 표] — 늘 수량).
 */
export const SalesSection = ({
  sales,
  unit,
  onSort,
  onView,
  onChartMetric,
  drawKey,
}: SalesProps) => {
  const {
    summary,
    columns,
    periodCount,
    tableRows,
    sortKey,
    sortDirection,
    points,
    chartMetric,
    chartPoints,
    trends,
    columnMax,
    view,
  } = sales
  const noun = INFLOW_UNIT_NOUN[unit]
  const chartTotal = chartPoints.reduce((sum, point) => sum + point.total, 0)

  /** 합계를 표의 줄 수로 나눈 평균 — 소수 첫째 자리까지. */
  const average = (total: number): string =>
    periodCount === 0
      ? '-'
      : (Math.round((total / periodCount) * 10) / 10).toLocaleString('ko-KR')

  // 칸 — 기간, 전체 수량, 그리고 이 기간에 팔린 제품들(수량 많은 순).
  const heads: { key: InflowSortKey; label: string }[] = [
    { key: 'date', label: unit === 'day' ? '날짜' : '기간' },
    { key: 'total', label: '전체 수량' },
    ...columns.map((column) => ({
      key: `board:${column.name}` as InflowSortKey,
      label: column.name,
    })),
  ]

  return (
    <section className="stats_card">
      <div className="kpi_head">
        <div>
          <h2>
            {INFLOW_UNIT_LABEL[unit]} 판매{' '}
            {SALES_CHART_METRIC_LABEL[chartMetric]}
          </h2>
          <p className="stats_desc">
            오프라인 결제와 온라인몰 주문 품목 · 취소·반품과 제품이 아닌 줄 제외
            {chartMetric === 'amount' &&
              ' · 그래프는 만원 단위, 제품 현황은 수량'}
          </p>
        </div>
        <Segmented
          options={SALES_CHART_METRIC_LABEL}
          value={chartMetric}
          onChange={onChartMetric}
          label="그래프 기준"
        />
      </div>

      <div className="stats_tiles trend_tiles">
        <StatTile
          icon={Package}
          label="판매 수량"
          value={units(summary.quantity)}
          sub={`${INFLOW_UNIT_AVERAGE[unit]} ${average(summary.quantity)}개`}
        />
        <StatTile
          icon={Banknote}
          label="판매 금액"
          value={formatWon(summary.amount)}
          sub={
            summary.quantity > 0
              ? `개당 평균 ${formatWon(Math.round(summary.amount / summary.quantity))}`
              : undefined
          }
        />
        <StatTile
          icon={Boxes}
          label="제품 가짓수"
          value={`${summary.productCount.toLocaleString('ko-KR')}종`}
          sub="이 기간에 한 번이라도 팔린 제품"
        />
        <StatTile
          icon={Trophy}
          label="가장 많이 팔린 제품"
          value={summary.top ? units(summary.top.quantity) : '-'}
          sub={
            summary.top && (
              <span className="sales_top_label" title={summary.top.name}>
                {summary.top.name}
              </span>
            )
          }
        />
      </div>

      {columns.length > 0 && (
        <InflowChart
          key={`${drawKey}:${chartMetric}`}
          points={chartPoints}
          average={periodCount === 0 ? 0 : chartTotal / periodCount}
          metric={CHART_METRIC[chartMetric]}
          split={CHANNEL_SPLIT}
        />
      )}

      <div className="inflow_table_block">
        <div className="inflow_table_head">
          <h3>제품별 {INFLOW_UNIT_LABEL[unit]} 현황</h3>
          <Segmented
            options={VIEW_LABEL}
            value={view}
            onChange={onView}
            label="제품 현황 보기"
          />
        </div>
        {columns.length === 0 ? (
          <p className="sales_empty">이 기간에 판매 기록이 없습니다.</p>
        ) : view === 'trend' ? (
          <BoardTrendList
            key={drawKey}
            trends={trends}
            points={points}
            columns={{ name: '제품', peak: `가장 많이 팔린 ${noun}` }}
            unit="개"
            limit={TREND_LIMIT}
            wideName
          />
        ) : (
          <HeatmapTable
            heads={heads}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSort={onSort}
            rows={tableRows}
            columns={columns}
            columnMax={columnMax}
            total={summary.quantity}
            periodCount={periodCount}
            wide
          />
        )}
      </div>
    </section>
  )
}
