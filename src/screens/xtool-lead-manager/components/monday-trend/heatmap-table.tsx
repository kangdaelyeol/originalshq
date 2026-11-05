import { SortButton } from '@/screens/xtool-lead-manager/components'
import type { SortDirection } from '@/screens/xtool-lead-manager/types'
import type {
  InflowPoint,
  InflowSortKey,
} from '@/screens/xtool-lead-manager/utils'
import { HeatCell } from './heat-cell'

/**
 * 기간(줄) × 보드·제품(칸) 히트맵 표 — 인입통계의 보드 현황과 판매통계의 제품
 * 현황이 같이 쓴다. 칸(열)마다 가장 큰 값이 가장 진하고, 머리글을 눌러 정렬한다.
 * 합계·평균은 정렬과 무관하게 항상 맨 아래이고, 평균은 기간 수로 나눈 값이다.
 */
export const HeatmapTable = ({
  heads,
  sortKey,
  sortDirection,
  onSort,
  rows,
  columns,
  columnMax,
  total,
  misentry,
  periodCount,
  wide = false,
}: {
  /** 머리글 — 기간, 전체, (오기입), 보드·제품들 순. */
  heads: { key: InflowSortKey; label: string }[]
  sortKey: InflowSortKey
  sortDirection: SortDirection
  onSort: (key: InflowSortKey) => void
  /** 정렬된 줄(기간). */
  rows: InflowPoint[]
  /** 보드·제품 칸 — 이름과 기간 합계. */
  columns: { name: string; count: number }[]
  /** 칸마다의 최댓값(히트맵 세기) — total, misentry, board:이름. */
  columnMax: Record<string, number>
  /** 전체 칸의 기간 합계. */
  total: number
  /** 오기입 칸(인입통계만)의 기간 합계 — 없으면 그 칸을 그리지 않는다. */
  misentry?: number
  /** 평균을 낼 기간 수. */
  periodCount: number
  /** 칸 이름이 긴 표(판매통계의 제품) — 머리글을 줄이고 마우스를 올리면
   * 전체 이름을 보인다. */
  wide?: boolean
}) => {
  /** 합계를 기간 수로 나눈 평균 — 소수 첫째 자리까지. */
  const average = (sum: number): string =>
    periodCount === 0
      ? '-'
      : (Math.round((sum / periodCount) * 10) / 10).toLocaleString('ko-KR')

  return (
    <div
      className={
        wide ? 'trend_table_scroll sales_table_scroll' : 'trend_table_scroll'
      }
    >
      <table className="stats_table">
        <thead>
          <tr>
            {heads.map((head) => (
              <th
                key={head.key}
                className="sortable"
                title={wide ? head.label : undefined}
                aria-sort={
                  head.key !== sortKey
                    ? 'none'
                    : sortDirection === 'asc'
                      ? 'ascending'
                      : 'descending'
                }
                onClick={() => onSort(head.key)}
              >
                {wide ? (
                  <span className="sales_head_label">{head.label}</span>
                ) : (
                  head.label
                )}
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
          {rows.map((point) => (
            <tr key={point.date}>
              <td>{point.label}</td>
              <HeatCell value={point.total} max={columnMax.total} />
              {misentry !== undefined && (
                <HeatCell
                  value={point.misentry}
                  max={columnMax.misentry}
                  warn
                />
              )}
              {columns.map((column) => (
                // 칸마다 가장 많은 기간이 가장 진하다. 0인 칸은 흐리게 — 칸이
                // 많은 판매통계는 0이 대부분이다.
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
            <td>{total.toLocaleString('ko-KR')}</td>
            {misentry !== undefined && (
              <td>{misentry.toLocaleString('ko-KR')}</td>
            )}
            {columns.map((column) => (
              <td key={column.name}>{column.count.toLocaleString('ko-KR')}</td>
            ))}
          </tr>
          <tr>
            <td>평균</td>
            <td>{average(total)}</td>
            {misentry !== undefined && <td>{average(misentry)}</td>}
            {columns.map((column) => (
              <td key={column.name}>{average(column.count)}</td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
