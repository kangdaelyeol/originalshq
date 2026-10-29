import { Banknote, Boxes, Package, Trophy } from 'lucide-react'
import { Segmented, StatTile } from '@/components/glass'
import type {
  InflowView,
  useMondayTrendViewModel,
} from '@/screens/xtool-lead-manager/view-model'
import { SortButton } from '@/screens/xtool-lead-manager/components'
import {
  formatWon,
  INFLOW_UNIT_AVERAGE,
  INFLOW_UNIT_LABEL,
  INFLOW_UNIT_NOUN,
  type InflowSortKey,
  type InflowUnit,
} from '@/screens/xtool-lead-manager/utils'
import { BoardTrendList } from './board-trend-list'
import { HeatCell } from './heat-cell'
import { InflowChart } from './inflow-chart'

type SalesProps = {
  sales: ReturnType<typeof useMondayTrendViewModel>['state']['sales']
  unit: InflowUnit
  onSort: (key: InflowSortKey) => void
  onView: (view: InflowView) => void
  /** 기간이 바뀌면 그래프를 새로 그리게 하는 키(monday-trend.tsx). */
  drawKey: string
}

const VIEW_LABEL: Record<InflowView, string> = {
  trend: '제품별 추이',
  table: '표',
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
 * 인입통계와 같은 모양 — 숫자 타일, 기간별 판매 수량 그래프, 그 아래 제품
 * 현황([제품별 추이 | 표]).
 */
export const SalesSection = ({
  sales,
  unit,
  onSort,
  onView,
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
    trends,
    columnMax,
    view,
  } = sales
  const noun = INFLOW_UNIT_NOUN[unit]

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
      <h2>{INFLOW_UNIT_LABEL[unit]} 판매 수량</h2>
      <p className="stats_desc">
        오프라인 결제와 온라인몰 주문 품목 · 취소·반품과 제품이 아닌 줄 제외
      </p>

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
          key={drawKey}
          points={points}
          average={periodCount === 0 ? 0 : summary.quantity / periodCount}
          metric={{ name: '판매', unit: '개' }}
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
          <div className="trend_table_scroll sales_table_scroll">
            <table className="stats_table">
              <thead>
                <tr>
                  {heads.map((head) => (
                    <th
                      key={head.key}
                      className="sortable"
                      title={head.label}
                      aria-sort={
                        head.key !== sortKey
                          ? 'none'
                          : sortDirection === 'asc'
                            ? 'ascending'
                            : 'descending'
                      }
                      onClick={() => onSort(head.key)}
                    >
                      <span className="sales_head_label">{head.label}</span>
                      <SortButton
                        columnKey={head.key}
                        sortField={sortKey}
                        sortDirection={sortDirection}
                        onSort={onSort}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((point) => (
                  <tr key={point.date}>
                    <td>{point.label}</td>
                    <HeatCell value={point.total} max={columnMax.total} />
                    {columns.map((column) => (
                      // 칸(제품)마다 가장 많이 팔린 기간이 가장 진하다. 안 팔린
                      // 칸은 0을 흐리게 — 칸이 많아 0이 대부분이다.
                      <HeatCell
                        key={column.name}
                        value={point.boards?.[column.name] ?? 0}
                        max={columnMax[`board:${column.name}`]}
                      />
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>합계</td>
                  <td>{summary.quantity.toLocaleString('ko-KR')}</td>
                  {columns.map((column) => (
                    <td key={column.name}>
                      {column.count.toLocaleString('ko-KR')}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>평균</td>
                  <td>{average(summary.quantity)}</td>
                  {columns.map((column) => (
                    <td key={column.name}>{average(column.count)}</td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
