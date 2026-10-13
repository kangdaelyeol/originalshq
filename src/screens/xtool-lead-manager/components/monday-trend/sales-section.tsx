import type { useMondayTrendViewModel } from '@/screens/xtool-lead-manager/view-model'
import { SortButton } from '@/screens/xtool-lead-manager/components'
import {
  formatWon,
  type SalesSortKey,
} from '@/screens/xtool-lead-manager/utils'

type SalesProps = {
  sales: ReturnType<typeof useMondayTrendViewModel>['state']['sales']
  onSort: (key: SalesSortKey) => void
}

/** 그래프에 올릴 제품 수 — 그 아래는 표에서 본다. */
const CHART_LIMIT = 15

const units = (value: number): string => `${value.toLocaleString('ko-KR')}개`

/**
 * 판매통계 — 조회 기간에 제품별로 몇 개가 팔렸는지.
 *
 * 오프라인 결제(Monday 결제 보드의 품목 줄)와 온라인몰(Cafe24) 주문 품목을
 * 합쳐서 센다. 취소된 결제·주문, 취소·반품된 품목, 그리고 제품이 아닌 줄
 * (할인, 계약금·분할납부, 장기 할부 이자)은 빠져 있다.
 *
 * 제품은 이름으로 구분한다. 오프라인과 온라인이 같은 제품을 다른 이름으로
 * 적는 경우가 많아 그런 제품은 두 줄로 따로 나온다.
 */
export const SalesSection = ({ sales, onSort }: SalesProps) => {
  const { scope, products, summary, tableRows, sortKey, sortDirection } = sales
  const charted = products.slice(0, CHART_LIMIT)
  const maxQuantity = Math.max(...charted.map((product) => product.quantity), 1)

  // 채널을 하나만 볼 때는 채널별 수량 칸이 전체 수량과 같아 뺀다.
  const columns: { key: SalesSortKey; label: string }[] = [
    { key: 'name', label: '제품' },
    { key: 'quantity', label: '판매 수량' },
    ...(scope === 'all'
      ? ([
          { key: 'offlineQuantity', label: '오프라인' },
          { key: 'onlineQuantity', label: '온라인' },
        ] as const)
      : []),
    { key: 'amount', label: '판매 금액' },
  ]

  return (
    <>
      <section className="stats_card">
        <h2>제품별 판매 수량</h2>
        <p className="stats_desc">
          취소·반품을 뺀 판매 수량. 제품은 이름으로 구분해서, 오프라인과
          온라인에서 이름이 다르게 적힌 제품은 따로 나옵니다.
        </p>

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

        {charted.length === 0 ? (
          <p className="sales_empty">이 기간에 판매 기록이 없습니다.</p>
        ) : (
          <div className="sales_bars">
            {charted.map((product) => (
              <div
                key={product.name}
                className="sales_bar"
                title={`${product.name}: ${units(product.quantity)} (오프라인 ${product.offlineQuantity} · 온라인 ${product.onlineQuantity})`}
              >
                <span className="sales_bar_label">{product.name}</span>
                <span className="stats_bar_track">
                  <span
                    className="stats_bar_fill"
                    style={{
                      width: `${(product.quantity / maxQuantity) * 100}%`,
                    }}
                  />
                </span>
                <span className="stats_bar_value">
                  {units(product.quantity)}
                </span>
              </div>
            ))}
            {products.length > CHART_LIMIT && (
              <p className="sales_more">
                수량 상위 {CHART_LIMIT}개만 그렸습니다. 나머지{' '}
                {products.length - CHART_LIMIT}종은 아래 표에 있습니다.
              </p>
            )}
          </div>
        )}
      </section>

      <section className="stats_card">
        <h2>제품별 표</h2>
        <div className="trend_table_scroll sales_table_scroll">
          <table className="stats_table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className="sortable"
                    aria-sort={
                      column.key !== sortKey
                        ? 'none'
                        : sortDirection === 'asc'
                          ? 'ascending'
                          : 'descending'
                    }
                    onClick={() => onSort(column.key)}
                  >
                    {column.label}
                    <SortButton
                      columnKey={column.key}
                      sortField={sortKey}
                      sortDirection={sortDirection}
                      onSort={onSort}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((product) => (
                <tr key={product.name}>
                  <td>{product.name}</td>
                  <td>{product.quantity.toLocaleString('ko-KR')}</td>
                  {scope === 'all' && (
                    <>
                      <td>{product.offlineQuantity.toLocaleString('ko-KR')}</td>
                      <td>{product.onlineQuantity.toLocaleString('ko-KR')}</td>
                    </>
                  )}
                  <td>{formatWon(product.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>합계</td>
                <td>{summary.quantity.toLocaleString('ko-KR')}</td>
                {scope === 'all' && (
                  <>
                    <td>
                      {products
                        .reduce((sum, p) => sum + p.offlineQuantity, 0)
                        .toLocaleString('ko-KR')}
                    </td>
                    <td>
                      {products
                        .reduce((sum, p) => sum + p.onlineQuantity, 0)
                        .toLocaleString('ko-KR')}
                    </td>
                  </>
                )}
                <td>{formatWon(summary.amount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </>
  )
}
