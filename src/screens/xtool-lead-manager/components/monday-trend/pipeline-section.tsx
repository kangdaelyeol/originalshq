import type { useMondayTrendViewModel } from '@/screens/xtool-lead-manager/view-model'
import {
  shortBoardName,
  type TableSort,
} from '@/screens/xtool-lead-manager/utils'
import { SortableTh } from './sortable-th'

type Pipeline = ReturnType<typeof useMondayTrendViewModel>['state']['pipeline']

const share = (count: number, total: number): string =>
  total === 0 ? '-' : `${((count / total) * 100).toFixed(1)}%`

/**
 * 현재 파이프라인 — 지금 진행 중인 상담이 단계별로 몇 건인지, 보드마다.
 * 줄이 보드, 칸이 단계(신규 → 콜백 1~4 → 보류)이고 맨 아래에 단계별 합계와
 * 전체 대비 비율. 기간 선택과 무관한 오늘 기준이다.
 */
export const PipelineSection = ({
  pipeline,
  today,
  sort,
  onSort,
}: {
  pipeline: Pipeline
  today: string
  sort: TableSort | undefined
  onSort: (key: string) => void
}) => {
  const { stages, rows, sum } = pipeline

  return (
    <section className="stats_card">
      <h2>
        현재 파이프라인 <span className="neglect_total">{sum.total}건</span>
      </h2>
      <p className="stats_desc">
        진행 중인 상담의 단계별 건수 — {today} 기준, 위 기간 선택과 무관합니다.
        결제·미전환·오기입과 완료 그룹은 빠지고, 보류 상태이거나 보류 그룹에
        있는 건은 보류로 셉니다.
      </p>
      <div className="trend_table_scroll pipeline_table_scroll">
        <table className="stats_table">
          <thead>
            <tr>
              <SortableTh columnKey="board" sort={sort} onSort={onSort}>
                보드
              </SortableTh>
              {stages.map((stage) => (
                <SortableTh
                  key={stage}
                  columnKey={stage}
                  sort={sort}
                  onSort={onSort}
                >
                  {stage}
                </SortableTh>
              ))}
              <SortableTh columnKey="total" sort={sort} onSort={onSort}>
                합계
              </SortableTh>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.board}>
                <td title={row.board}>{shortBoardName(row.board)}</td>
                {stages.map((stage) => (
                  <td key={stage}>{row.counts[stage]}</td>
                ))}
                <td>{row.total}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>합계</td>
              {stages.map((stage) => (
                <td key={stage}>{sum.counts[stage]}</td>
              ))}
              <td>{sum.total}</td>
            </tr>
            <tr>
              <td>비율</td>
              {stages.map((stage) => (
                <td key={stage}>{share(sum.counts[stage], sum.total)}</td>
              ))}
              <td>{sum.total === 0 ? '-' : '100%'}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}
