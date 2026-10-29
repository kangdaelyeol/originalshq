import type { ReactNode } from 'react'
import { Segmented } from '@/components/glass'
import type {
  KpiCell,
  KpiResult,
  KpiUnit,
  TableSort,
} from '@/screens/xtool-lead-manager/utils'
import { formatKpi, periodLabel } from '@/screens/xtool-lead-manager/utils'
import type { KpiPairSortBy } from '@/screens/xtool-lead-manager/view-model'
import { SortableTh } from './sortable-th'

const SORT_BY_LABEL: Record<KpiPairSortBy, string> = {
  count: '건수 순',
  rate: '비율 순',
}

/** 건수·비율 글자 — 정렬 기준인 쪽을 위(크게), 나머지를 아래(작게) 둔다. */
const pairValues = (cell: KpiCell, sortBy: KpiPairSortBy) => {
  const count = (cell.num ?? 0).toLocaleString('ko-KR')
  const rate = formatKpi(cell, 'percent')
  return sortBy === 'count' ? [count, rate] : [rate, count]
}

/** 한 칸 — 위에 정렬 기준 값, 아래에 나머지. 마우스를 올리면 "건수 / 상담 수". */
const PairCell = ({
  cell,
  sortBy,
  className,
}: {
  cell: KpiCell
  sortBy: KpiPairSortBy
  className?: string
}) => {
  const [main, sub] = pairValues(cell, sortBy)
  return (
    <td className={className} title={`${cell.num ?? 0} / ${cell.den ?? 0}`}>
      <span className="kpi_pair_main">{main}</span>
      <span className="kpi_pair_sub">{sub}</span>
    </td>
  )
}

/**
 * 건수와 비율을 한 표에 — 비율 지표(KpiResult) 하나가 분자(건수)·분모를 다
 * 갖고 있어서 그것만으로 그린다. 줄은 담당자, 칸은 기간, 맨 오른쪽이 조회
 * 기간 전체, 맨 아래가 모든 담당자 합. 정렬 기준(건수/비율)은 오른쪽 위에서
 * 고른다.
 */
export const KpiPairCard = ({
  each,
  unit,
  periods,
  sort,
  onSort,
  sortBy,
  onSortBy,
  aside,
  body,
}: {
  each: KpiResult & { sortBy: KpiPairSortBy }
  unit: KpiUnit
  periods: string[]
  sort: TableSort | undefined
  onSort: (key: string) => void
  sortBy: KpiPairSortBy
  onSortBy: (by: KpiPairSortBy) => void
  /** 정렬 기준 옆에 덧붙이는 것(보기 전환 등). */
  aside?: ReactNode
  /** 표 대신 그릴 것(그래프 보기) — 없으면 표. */
  body?: ReactNode
}) => (
  <section className="stats_card kpi_card kpi_pair_card">
    <div className="kpi_head">
      <div>
        <h2>{each.title}</h2>
        <p className="stats_desc">{each.description}</p>
      </div>
      <div className="kpi_pair_side">
        <strong
          className="kpi_total"
          title={`${each.sum.total.num ?? 0} / ${each.sum.total.den ?? 0}`}
        >
          {sortBy === 'count' ? (
            <>
              {(each.sum.total.num ?? 0).toLocaleString('ko-KR')}건
              <span> · {formatKpi(each.sum.total, 'percent')}</span>
            </>
          ) : (
            <>
              {formatKpi(each.sum.total, 'percent')}
              <span>
                {' '}
                · {(each.sum.total.num ?? 0).toLocaleString('ko-KR')}건
              </span>
            </>
          )}
        </strong>
        {/* 정렬 기준과 보기 전환(aside)을 한 줄에. */}
        <div className="kpi_pair_controls">
          <Segmented
            options={SORT_BY_LABEL}
            value={sortBy}
            onChange={onSortBy}
            label="정렬 기준"
            role="buttons"
          />
          {aside}
        </div>
      </div>
    </div>
    {body ??
      (each.rows.length === 0 ? (
        <p className="kpi_empty">이 기간에 기록이 없습니다.</p>
      ) : (
        <div className="trend_table_scroll">
          <table className="stats_table kpi_table">
            <thead>
              <tr>
                <SortableTh columnKey="assignee" sort={sort} onSort={onSort}>
                  담당자
                </SortableTh>
                {periods.map((key) => (
                  <SortableTh
                    key={key}
                    columnKey={key}
                    sort={sort}
                    onSort={onSort}
                  >
                    {periodLabel(key, unit)}
                  </SortableTh>
                ))}
                <SortableTh
                  columnKey="total"
                  sort={sort}
                  onSort={onSort}
                  className="kpi_total_col"
                >
                  전체
                </SortableTh>
              </tr>
            </thead>
            <tbody>
              {each.rows.map((row) => (
                <tr key={row.assignee}>
                  <td>{row.assignee}</td>
                  {row.byPeriod.map((cell, i) => (
                    <PairCell key={periods[i]} cell={cell} sortBy={sortBy} />
                  ))}
                  <PairCell
                    cell={row.total}
                    sortBy={sortBy}
                    className="kpi_total_col"
                  />
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>합계</td>
                {each.sum.byPeriod.map((cell, i) => (
                  <PairCell key={periods[i]} cell={cell} sortBy={sortBy} />
                ))}
                <PairCell
                  cell={each.sum.total}
                  sortBy={sortBy}
                  className="kpi_total_col"
                />
              </tr>
            </tfoot>
          </table>
        </div>
      ))}
  </section>
)
