import '@/screens/xtool-lead-manager/styles/nav.scss'
import '@/screens/xtool-lead-manager/styles/main.scss'
import '@/screens/xtool-lead-manager/styles/monday-stats.scss'
import '@/screens/xtool-lead-manager/styles/monday-trend.scss'
import '@/screens/xtool-lead-manager/styles/glass-theme.scss'
import '@/screens/xtool-lead-manager/styles/monday-inflow-glass.scss'
import {
  TREND_SECTION_LABEL,
  type useCsTeamViewModel,
  type useLiveInflowViewModel,
  type InflowView,
  type useMondayTrendViewModel,
} from '@/screens/xtool-lead-manager/view-model'
import { SortButton } from '@/screens/xtool-lead-manager/components'
import {
  INFLOW_UNIT_AVERAGE,
  INFLOW_UNIT_LABEL,
  INFLOW_UNIT_NOUN,
  PURCHASE_SCOPE_LABEL,
  shortBoardName,
  type InflowSortKey,
  type InflowUnit,
} from '@/screens/xtool-lead-manager/utils'
// 기간 선택은 cmip의 것을 그대로 쓴다 — 프리셋(지난 7일 등)과 달력이 같은
// 방식으로 동작해야 두 화면을 오가며 쓰기 편하다.
import { CalendarDays, FileWarning, Inbox, TrendingUp } from 'lucide-react'
import { Segmented, StatTile } from '@/components/glass'
import { DateRangePicker } from '@/screens/cmip/components/date-range-picker'
import { InflowChart } from './inflow-chart'
import { BoardTrendList } from './board-trend-list'
import { HeatCell } from './heat-cell'
import { LiveInflow } from './live-inflow'
import { CsTeamSection } from './cs-team-section'
import { TrendSkeleton } from './trend-skeleton'
import { KpiControls, KpiSection } from './kpi-section'
import { PipelineSection } from './pipeline-section'
import { SalesSection } from './sales-section'

type MondayTrendProps = ReturnType<typeof useMondayTrendViewModel> & {
  /** 인입통계 맨 위 "오늘 웹 문의 · 실시간"(useLiveInflowViewModel). */
  live: ReturnType<typeof useLiveInflowViewModel>['state']
  /** 인입통계 맨 아래 CS팀 인입 성과(useCsTeamViewModel). */
  csTeam: ReturnType<typeof useCsTeamViewModel>
}

const count = (value: number): string => `${value.toLocaleString('ko-KR')}건`

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

/**
 * 통계 탭 — 소주제 둘: 인입통계(날짜별 인입 건수)와 판매통계(제품별 판매
 * 수량, sales-section.tsx). 위쪽 줄에서 소주제와 기간을 고른다.
 *
 * 인입은 그날 상담 보드(기기별 B2B 보드, B2B 솔루션, 기타 온라인 문의, 기타
 * 오프라인)에 새로 접수된 기록의 수다. 방문체험·샘플테스트·결제는 이미
 * 인입된 고객의 다음 단계라 세지 않는다. 퍼널 통계와 달리 고객이 아니라 기록
 * 단위라서, 한 사람이 두 번 문의하면 2건으로 센다.
 */
export const MondayTrend = ({
  state,
  actions,
  live,
  csTeam,
}: MondayTrendProps) => {
  const {
    status,
    range,
    unit,
    points,
    summary,
    tableRows,
    sortKey,
    sortDirection,
    boardTrends,
    columnMax,
    inflowView,
    section,
    sales,
    neglect,
    kpi,
    tableSorts,
    includeInactive,
    pipeline,
    pipelineView,
    cardViews,
  } = state
  const {
    changeRange,
    changeUnit,
    toggleSort,
    changeInflowView,
    changeSalesView,
    changeCardView,
    changePipelineView,
    reload,
    changeSection,
    changeSalesScope,
    toggleSalesSort,
    toggleExpanded,
    changeKpiUnit,
    changeKpiRange,
    toggleTableSort,
    toggleIncludeInactive,
    selectKpiAssignee,
  } = actions
  const noun = INFLOW_UNIT_NOUN[unit]
  // 기간(단위·시작·끝)이 바뀌면 그래프를 새로 붙여 처음부터 다시 그린다 —
  // 그대로 두면 값만 바뀌어 "그려지는" 움직임이 없다(새로 생긴 줄만 그려진다).
  const drawKey = `${unit}:${range.start}:${range.end}`

  /** 합계를 표의 줄 수로 나눈 평균 — 소수 첫째 자리까지. */
  const average = (total: number): string =>
    points.length === 0
      ? '-'
      : (Math.round((total / points.length) * 10) / 10).toLocaleString('ko-KR')

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
      <div className="lead_manager_nav monday_stats_nav monday_trend_nav glass_theme">
        <div className="inner">
          {/* 소주제 — 인입통계 / 판매통계. 기간은 둘이 같이 쓴다. */}
          <Segmented
            options={TREND_SECTION_LABEL}
            value={section}
            onChange={changeSection}
            label="통계 소주제"
            size="md"
            className="trend_sections"
          />
          {/* 개인 KPI는 단위마다 기간을 따로 고른다. */}
          {section === 'kpi' && (
            <KpiControls
              kpi={kpi}
              onUnit={changeKpiUnit}
              onRange={changeKpiRange}
            />
          )}
          {/* 개인 KPI(방치 포함) — 지금 일하지 않는 담당자 줄은 기본으로 숨긴다. */}
          {section === 'kpi' && (
            <button
              type="button"
              className={['stats_toggle', includeInactive ? 'on' : '']
                .join(' ')
                .trim()}
              aria-pressed={includeInactive}
              onClick={toggleIncludeInactive}
            >
              <span className="stats_toggle_switch" aria-hidden="true" />
              삭제된 팀원·담당자 없음 포함
            </button>
          )}
          {/* 개인 KPI는 자기 기간 선택(위)을 쓰므로 공용 기간·단위를 숨긴다. */}
          {section !== 'kpi' && (
            <DateRangePicker
              dateStart={range.start}
              dateEnd={range.end}
              onChange={changeRange}
            />
          )}
          {/* 묶는 단위(일/주/월)는 두 소주제가 같이 쓰고, 판매통계에는 채널
              선택이 더 붙는다. */}
          {section !== 'kpi' && (
            <Segmented
              options={INFLOW_UNIT_LABEL}
              value={unit}
              onChange={changeUnit}
              label="묶는 단위"
              size="md"
            />
          )}
          {section === 'sales' && (
            <Segmented
              options={PURCHASE_SCOPE_LABEL}
              value={sales.scope}
              onChange={changeSalesScope}
              label="판매 채널"
              size="md"
            />
          )}
        </div>
      </div>

      <div className="xtool-main monday_stats monday_trend glass_theme">
        <div className="wrapper">
          {status === 'error' ? (
            <div className="monday_error">
              <p>통계를 불러오지 못했습니다.</p>
              <button type="button" onClick={reload}>
                다시 시도
              </button>
            </div>
          ) : status === 'idle' || status === 'loading' ? (
            // 실시간 웹 문의는 Monday 통계와 따로 받아, 이쪽이 불러오는
            // 중이어도 오른쪽 자리에 먼저 보인다.
            <TrendSkeleton
              section={section}
              inflowAside={<LiveInflow live={live} />}
            />
          ) : section === 'kpi' ? (
            <KpiSection
              kpi={kpi}
              neglect={neglect}
              sorts={tableSorts}
              onSort={toggleTableSort}
              onSelectAssignee={selectKpiAssignee}
              onToggleNeglect={toggleExpanded}
              views={cardViews}
              onView={changeCardView}
            />
          ) : section === 'sales' ? (
            <SalesSection
              sales={sales}
              unit={unit}
              onSort={toggleSalesSort}
              onView={changeSalesView}
              drawKey={drawKey}
            />
          ) : (
            <>
              {/* 맨 위 한 줄 — 왼쪽 기간 인입 건수(그래프+표), 오른쪽 오늘 웹 문의(실시간). */}
              <div className="inflow_top_row">
                <section className="stats_card inflow_main">
                  <h2>{INFLOW_UNIT_LABEL[unit]} 인입 건수</h2>
                  <p className="stats_desc">
                    같은 고객이 여러 번 문의해도 각각 포함
                  </p>

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
                      value={`${(
                        Math.round(summary.average * 10) / 10
                      ).toLocaleString('ko-KR')}건`}
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
                      <div className="trend_table_scroll">
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
                                  onClick={() => toggleSort(column.key)}
                                >
                                  {column.label}
                                  <SortButton
                                    columnKey={column.key}
                                    sortField={sortKey}
                                    sortDirection={sortDirection}
                                    onSort={toggleSort}
                                  />
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {tableRows.map((point) => (
                              <tr key={point.date}>
                                <td>{point.label}</td>
                                <HeatCell
                                  value={point.total}
                                  max={columnMax.total}
                                />
                                <HeatCell
                                  value={point.misentry}
                                  max={columnMax.misentry}
                                  warn
                                />
                                {summary.boards.map((board) => (
                                  <HeatCell
                                    key={board.name}
                                    value={point.boards?.[board.name] ?? 0}
                                    max={columnMax[`board:${board.name}`]}
                                  />
                                ))}
                              </tr>
                            ))}
                          </tbody>
                          {/* 합계·평균 — 정렬과 무관하게 항상 맨 아래. 평균은 표에
                          보이는 줄 수(일·주·월)로 나눈 값이다. */}
                          <tfoot>
                            <tr>
                              <td>합계</td>
                              <td>{summary.total.toLocaleString('ko-KR')}</td>
                              <td>
                                {summary.misentry.toLocaleString('ko-KR')}
                              </td>
                              {summary.boards.map((board) => (
                                <td key={board.name}>
                                  {board.count.toLocaleString('ko-KR')}
                                </td>
                              ))}
                            </tr>
                            <tr>
                              <td>평균</td>
                              <td>{average(summary.total)}</td>
                              <td>{average(summary.misentry)}</td>
                              {summary.boards.map((board) => (
                                <td key={board.name}>{average(board.count)}</td>
                              ))}
                            </tr>
                          </tfoot>
                        </table>
                      </div>
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
          )}
        </div>
      </div>
    </>
  )
}
