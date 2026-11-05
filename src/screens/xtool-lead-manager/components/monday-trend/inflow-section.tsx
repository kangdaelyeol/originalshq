import { CalendarDays, FileWarning, Inbox, TrendingUp } from 'lucide-react'
import { Segmented, StatTile } from '@/components/glass'
import type {
  InflowView,
  useCsTeamViewModel,
  useLiveInflowViewModel,
  useMondayTrendViewModel,
} from '@/screens/xtool-lead-manager/view-model'
import {
  INFLOW_UNIT_AVERAGE,
  INFLOW_UNIT_LABEL,
  INFLOW_UNIT_NOUN,
  shortBoardName,
  type InflowSortKey,
  type InflowUnit,
} from '@/screens/xtool-lead-manager/utils'
import { BoardTrendList } from './board-trend-list'
import { CsTeamSection } from './cs-team-section'
import { HeatmapTable } from './heatmap-table'
import { InflowChart } from './inflow-chart'
import { LiveInflow } from './live-inflow'
import { PipelineSection } from './pipeline-section'

const INFLOW_VIEW_LABEL: Record<InflowView, string> = {
  trend: '보드별 추이',
  table: '표',
}

/** 평균 타일의 "n일 기준" — 표의 줄 수를 세는 단위. */
const INFLOW_UNIT_COUNT: Record<InflowUnit, string> = {
  day: '일',
  week: '주',
  month: '개월',
}

const count = (value: number): string => `${value.toLocaleString('ko-KR')}건`

/**
 * 인입통계 — 맨 위 한 줄(기간 인입 건수의 그래프·표 + 오늘 웹 문의 실시간),
 * 현재 파이프라인, CS팀 인입 성과. 데이터는 통계 탭(useMondayTrendViewModel)이
 * 받아 둔 것이다.
 */
export const InflowSection = ({
  trend: { state, actions },
  live,
  csTeam,
  drawKey,
}: {
  trend: Pick<ReturnType<typeof useMondayTrendViewModel>, 'state' | 'actions'>
  live: ReturnType<typeof useLiveInflowViewModel>['state']
  csTeam: ReturnType<typeof useCsTeamViewModel>
  /** 기간이 바뀌면 그래프를 새로 그리게 하는 키(monday-trend.tsx). */
  drawKey: string
}) => {
  const {
    unit,
    points,
    summary,
    tableRows,
    sortKey,
    sortDirection,
    boardTrends,
    columnMax,
    inflowView,
    neglect,
    tableSorts,
    pipeline,
    pipelineView,
  } = state
  const {
    toggleSort,
    changeInflowView,
    changePipelineView,
    toggleExpanded,
    toggleTableSort,
  } = actions
  const noun = INFLOW_UNIT_NOUN[unit]

  // 표의 컬럼 — 날짜(기간), 전체 인입, 오기입, 그리고 이 기간에 인입이 있던
  // 보드들(많은 순). 컬럼마다 머리글을 눌러 정렬한다.
  const columns: { key: InflowSortKey; label: string }[] = [
    { key: 'date', label: unit === 'day' ? '날짜' : '기간' },
    { key: 'total', label: '전체 인입' },
    { key: 'misentry', label: '오기입' },
    ...summary.boards.map((board) => ({
      key: `board:${board.name}` as InflowSortKey,
      label: shortBoardName(board.name),
    })),
  ]

  return (
    <>
      {/* 맨 위 한 줄 — 왼쪽 기간 인입 건수(그래프+표), 오른쪽 오늘 웹 문의(실시간). */}
      <div className="inflow_top_row">
        <section className="stats_card inflow_main">
          <h2>{INFLOW_UNIT_LABEL[unit]} 인입 건수</h2>
          <p className="stats_desc">같은 고객이 여러 번 문의해도 각각 포함</p>

          <div className="stats_tiles trend_tiles">
            <StatTile
              icon={Inbox}
              label="전체 인입"
              value={count(summary.total)}
              sub={`인입 있던 보드 ${summary.boards.length}개`}
            />
            <StatTile
              icon={CalendarDays}
              label={INFLOW_UNIT_AVERAGE[unit]}
              value={`${(Math.round(summary.average * 10) / 10).toLocaleString(
                'ko-KR',
              )}건`}
              sub={`${points.length}${INFLOW_UNIT_COUNT[unit]} 기준`}
            />
            <StatTile
              icon={TrendingUp}
              label={`가장 많은 ${noun}`}
              value={summary.peak ? count(summary.peak.total) : '-'}
              sub={summary.peak?.label}
            />
            <StatTile
              icon={FileWarning}
              label="오기입"
              value={count(summary.misentry)}
              sub={
                summary.total > 0
                  ? `전체 인입의 ${((summary.misentry / summary.total) * 100).toFixed(1)}%`
                  : undefined
              }
              to={{ search: '?tab=tracking' }}
              linkLabel="오기입 추적 탭으로"
            />
          </div>

          <InflowChart
            key={drawKey}
            points={points}
            average={summary.average}
          />
          {/* 같은 기간의 표 — 그래프와 한 카드에 둔다. */}
          <div className="inflow_table_block">
            <div className="inflow_table_head">
              <h3>보드별 {INFLOW_UNIT_LABEL[unit]} 현황</h3>
              <Segmented
                options={INFLOW_VIEW_LABEL}
                value={inflowView}
                onChange={changeInflowView}
                label="보드 현황 보기"
              />
            </div>
            {inflowView === 'trend' ? (
              <BoardTrendList
                key={drawKey}
                trends={boardTrends.boards}
                extra={boardTrends.misentry}
                points={points}
                columns={{ name: '보드', peak: `가장 많은 ${noun}` }}
                empty="이 기간에 인입이 없습니다."
              />
            ) : (
              <HeatmapTable
                heads={columns}
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={toggleSort}
                rows={tableRows}
                columns={summary.boards}
                columnMax={columnMax}
                total={summary.total}
                misentry={summary.misentry}
                periodCount={points.length}
              />
            )}
          </div>
        </section>
        <LiveInflow live={live} />
      </div>

      <PipelineSection
        pipeline={pipeline}
        sort={tableSorts.pipeline}
        onSort={(key) => toggleTableSort('pipeline', key)}
        view={pipelineView}
        onView={changePipelineView}
      />

      <CsTeamSection
        csTeam={csTeam}
        sorts={tableSorts}
        onSort={toggleTableSort}
        neglectExpanded={neglect.expanded}
        onToggleNeglect={toggleExpanded}
        today={neglect.today}
      />
    </>
  )
}
