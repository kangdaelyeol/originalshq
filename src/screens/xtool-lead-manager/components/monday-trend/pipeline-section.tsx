import type {
  PipelineView,
  useMondayTrendViewModel,
} from '@/screens/xtool-lead-manager/view-model'
import {
  shortBoardName,
  type TableSort,
} from '@/screens/xtool-lead-manager/utils'
import { SortableTh } from './sortable-th'
import { StackedBars, Segmented, type StackSegment } from '@/components/glass'

type Pipeline = ReturnType<typeof useMondayTrendViewModel>['state']['pipeline']

const VIEW_LABEL: Record<PipelineView, string> = {
  chart: '그래프',
  table: '표',
}

/** 단계 색 — 신규 → 콜백 1~4는 순서라 청록 한 색의 옅은→진한 색(--pipe-0~4),
 * 보류·기타는 성격이 달라 회색(scss .stack 참고). */
const stageColor = (stage: string, index: number): string =>
  /보류/.test(stage)
    ? 'var(--pipe-hold)'
    : /기타|없음/.test(stage)
      ? 'var(--pipe-other)'
      : `var(--pipe-${index})`

const share = (count: number, total: number): string =>
  total === 0 ? '-' : `${((count / total) * 100).toFixed(1)}%`

/**
 * 현재 파이프라인 — 지금 진행 중인 상담이 단계별로 몇 건인지, 보드마다.
 * 줄이 보드, 칸이 단계(신규 → 콜백 1~4 → 보류)이고 맨 아래에 단계별 합계와
 * 전체 대비 비율. 기간 선택과 무관한 오늘 기준이다.
 */
export const PipelineSection = ({
  pipeline,
  sort,
  onSort,
  view,
  onView,
}: {
  pipeline: Pipeline
  sort: TableSort | undefined
  onSort: (key: string) => void
  view: PipelineView
  onView: (next: PipelineView) => void
}) => {
  const { stages, rows, sum } = pipeline
  const segments: StackSegment[] = stages.map((stage, index) => ({
    key: stage,
    label: stage,
    color: stageColor(stage, index),
  }))

  return (
    <section className="stats_card">
      <div className="kpi_head">
        <div>
          <h2>
            현재 파이프라인 <span className="neglect_total">{sum.total}건</span>
          </h2>
          <p className="stats_desc">
            기간 선택과 무관. 결제, 미전환, 오기입, 완료 그룹은 제외.
          </p>
        </div>
        <Segmented
          options={VIEW_LABEL}
          value={view}
          onChange={onView}
          label="파이프라인 보기"
        />
      </div>
      {view === 'chart' ? (
        <StackedBars
          segments={segments}
          // 그래프는 늘 많은 보드부터(표의 정렬과 따로).
          rows={[...rows]
            .sort((a, b) => b.total - a.total)
            .map((row) => ({
              key: row.board,
              label: shortBoardName(row.board),
              title: row.board,
              values: row.counts,
              total: row.total,
            }))}
          sum={{ values: sum.counts, total: sum.total }}
          sumLabel="전체"
        />
      ) : (
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
      )}
    </section>
  )
}
