import '@/screens/xtool-lead-manager/styles/nav.scss'
import '@/screens/xtool-lead-manager/styles/main.scss'
import '@/screens/xtool-lead-manager/styles/monday-stats.scss'
import '@/screens/xtool-lead-manager/styles/monday-trend.scss'
import {
  TREND_SECTION_LABEL,
  type TrendSection,
  type useMondayTrendViewModel,
} from '@/screens/xtool-lead-manager/view-model'
import { Loading, SortButton } from '@/screens/xtool-lead-manager/components'
import {
  INFLOW_UNIT_AVERAGE,
  INFLOW_UNIT_LABEL,
  INFLOW_UNIT_NOUN,
  PURCHASE_SCOPE_LABEL,
  shortBoardName,
  type InflowSortKey,
  type InflowUnit,
  type PurchaseScope,
} from '@/screens/xtool-lead-manager/utils'
// 기간 선택은 cmip의 것을 그대로 쓴다 — 프리셋(지난 7일 등)과 달력이 같은
// 방식으로 동작해야 두 화면을 오가며 쓰기 편하다.
import { DateRangePicker } from '@/screens/cmip/components/date-range-picker'
import { InflowChart } from './inflow-chart'
import { KpiControls, KpiSection } from './kpi-section'
import { SalesSection } from './sales-section'

type MondayTrendProps = ReturnType<typeof useMondayTrendViewModel>

const count = (value: number): string => `${value.toLocaleString('ko-KR')}건`

/**
 * 통계 탭 — 소주제 둘: 인입통계(날짜별 인입 건수)와 판매통계(제품별 판매
 * 수량, sales-section.tsx). 위쪽 줄에서 소주제와 기간을 고른다.
 *
 * 인입은 그날 상담 보드(기기별 B2B 보드, B2B 솔루션, 기타 온라인 문의, 기타
 * 오프라인)에 새로 접수된 기록의 수다. 방문체험·샘플테스트·결제는 이미
 * 인입된 고객의 다음 단계라 세지 않는다. 퍼널 통계와 달리 고객이 아니라 기록
 * 단위라서, 한 사람이 두 번 문의하면 2건으로 센다.
 */
export const MondayTrend = ({ state, actions }: MondayTrendProps) => {
  const {
    status,
    range,
    unit,
    points,
    summary,
    tableRows,
    sortKey,
    sortDirection,
    section,
    sales,
    neglect,
    kpi,
    tableSorts,
    includeInactive,
  } = state
  const {
    changeRange,
    changeUnit,
    toggleSort,
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
      <div className="lead_manager_nav monday_stats_nav monday_trend_nav">
        <div className="inner">
          {/* 소주제 — 인입통계 / 판매통계. 기간은 둘이 같이 쓴다. */}
          <div
            className="stats_scope trend_sections"
            role="tablist"
            aria-label="통계 소주제"
          >
            {(Object.keys(TREND_SECTION_LABEL) as TrendSection[]).map(
              (each) => (
                <button
                  key={each}
                  type="button"
                  role="tab"
                  aria-selected={each === section}
                  className={each === section ? 'active' : ''}
                  onClick={() => changeSection(each)}
                >
                  {TREND_SECTION_LABEL[each]}
                </button>
              ),
            )}
          </div>
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
            <div className="stats_scope" role="tablist" aria-label="묶는 단위">
              {(Object.keys(INFLOW_UNIT_LABEL) as InflowUnit[]).map((each) => (
                <button
                  key={each}
                  type="button"
                  role="tab"
                  aria-selected={each === unit}
                  className={each === unit ? 'active' : ''}
                  onClick={() => changeUnit(each)}
                >
                  {INFLOW_UNIT_LABEL[each]}
                </button>
              ))}
            </div>
          )}
          {section === 'sales' && (
            <div className="stats_scope" role="tablist" aria-label="판매 채널">
              {(Object.keys(PURCHASE_SCOPE_LABEL) as PurchaseScope[]).map(
                (each) => (
                  <button
                    key={each}
                    type="button"
                    role="tab"
                    aria-selected={each === sales.scope}
                    className={each === sales.scope ? 'active' : ''}
                    onClick={() => changeSalesScope(each)}
                  >
                    {PURCHASE_SCOPE_LABEL[each]}
                  </button>
                ),
              )}
            </div>
          )}
        </div>
      </div>

      <div className="xtool-main monday_stats monday_trend">
        <div className="wrapper">
          {status === 'error' ? (
            <div className="monday_error">
              <p>통계를 불러오지 못했습니다.</p>
              <button type="button" onClick={reload}>
                다시 시도
              </button>
            </div>
          ) : section === 'kpi' ? (
            <KpiSection
              kpi={kpi}
              neglect={neglect}
              sorts={tableSorts}
              onSort={toggleTableSort}
              onSelectAssignee={selectKpiAssignee}
              onToggleNeglect={toggleExpanded}
            />
          ) : section === 'sales' ? (
            <SalesSection sales={sales} unit={unit} onSort={toggleSalesSort} />
          ) : (
            <>
              <section className="stats_card">
                <h2>{INFLOW_UNIT_LABEL[unit]} 인입 건수</h2>
                <p className="stats_desc">
                  같은 고객이 여러 번 문의해도 각각 포함
                </p>

                <div className="stats_tiles trend_tiles">
                  <div className="stats_tile">
                    <span className="stats_tile_label">전체 인입</span>
                    <strong className="stats_tile_value">
                      {count(summary.total)}
                    </strong>
                  </div>
                  <div className="stats_tile">
                    <span className="stats_tile_label">
                      {INFLOW_UNIT_AVERAGE[unit]}
                    </span>
                    <strong className="stats_tile_value">
                      {(Math.round(summary.average * 10) / 10).toLocaleString(
                        'ko-KR',
                      )}
                      건
                    </strong>
                  </div>
                  <div className="stats_tile">
                    {/* 어느 날(주·달)인지는 이름 옆에 붙인다 — 값 아래에 따로
                        두면 이 칸만 한 줄 길어져 네 칸의 높이가 같이 늘어난다. */}
                    <span className="stats_tile_label">
                      가장 많은 {noun}
                      {summary.peak && ` - ${summary.peak.label}`}
                    </span>
                    <strong className="stats_tile_value">
                      {summary.peak ? count(summary.peak.total) : '-'}
                    </strong>
                  </div>
                  <div className="stats_tile">
                    <span className="stats_tile_label">오기입</span>
                    <strong className="stats_tile_value">
                      {count(summary.misentry)}
                    </strong>
                  </div>
                </div>

                <InflowChart points={points} average={summary.average} />
              </section>

              <section className="stats_card">
                <h2>{INFLOW_UNIT_LABEL[unit]} 표</h2>
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
                          <td>{point.total}</td>
                          <td>{point.misentry}</td>
                          {summary.boards.map((board) => (
                            <td key={board.name}>
                              {point.boards?.[board.name] ?? 0}
                            </td>
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
                        <td>{summary.misentry.toLocaleString('ko-KR')}</td>
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
              </section>
            </>
          )}
        </div>
        {status === 'loading' && <Loading />}
      </div>
    </>
  )
}
