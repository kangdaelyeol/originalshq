import type { useMondayTrendViewModel } from '@/screens/xtool-lead-manager/view-model'
import { SortButton } from '@/screens/xtool-lead-manager/components'
import {
  formatWon,
  INFLOW_UNIT_LABEL,
  type InflowSortKey,
  type InflowUnit,
} from '@/screens/xtool-lead-manager/utils'

type SalesProps = {
  sales: ReturnType<typeof useMondayTrendViewModel>['state']['sales']
  unit: InflowUnit
  onSort: (key: InflowSortKey) => void
}

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
 */
export const SalesSection = ({ sales, unit, onSort }: SalesProps) => {
  const { summary, columns, periodCount, tableRows, sortKey, sortDirection } =
    sales

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
      <h2>{INFLOW_UNIT_LABEL[unit]} 제품별 판매 수량</h2>

      <div className="stats_tiles trend_tiles">
        <div className="stats_tile">
          <span className="stats_tile_label">판매 수량</span>
          <strong className="stats_tile_value">
            {units(summary.quantity)}
          </strong>
        </div>
        <div className="stats_tile">
          <span className="stats_tile_label">판매 금액</span>
          <strong className="stats_tile_value">
            {formatWon(summary.amount)}
          </strong>
        </div>
        <div className="stats_tile">
          <span className="stats_tile_label">제품 가짓수</span>
          <strong className="stats_tile_value">
            {summary.productCount.toLocaleString('ko-KR')}종
          </strong>
        </div>
        <div className="stats_tile">
          <span
            className="stats_tile_label sales_top_label"
            title={summary.top?.name}
          >
            가장 많이 팔린 제품
            {summary.top && ` - ${summary.top.name}`}
          </span>
          <strong className="stats_tile_value">
            {summary.top ? units(summary.top.quantity) : '-'}
          </strong>
        </div>
      </div>

      {columns.length === 0 ? (
        <p className="sales_empty">이 기간에 판매 기록이 없습니다.</p>
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
                  <td>{point.total.toLocaleString('ko-KR')}</td>
                  {columns.map((column) => (
                    // 안 팔린 날은 0을 흐리게 — 칸이 많아 0이 대부분이라, 팔린
                    // 칸이 눈에 들어오게 한다.
                    <td
                      key={column.name}
                      className={point.boards?.[column.name] ? '' : 'zero'}
                    >
                      {point.boards?.[column.name] ?? 0}
                    </td>
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
    </section>
  )
}
