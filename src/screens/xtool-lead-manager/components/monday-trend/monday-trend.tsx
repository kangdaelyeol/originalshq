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
  type useMondayTrendViewModel,
  type useSalesTeamViewModel,
  type useTechStatsViewModel,
} from '@/screens/xtool-lead-manager/view-model'
import {
  INFLOW_UNIT_LABEL,
  PURCHASE_SCOPE_LABEL,
} from '@/screens/xtool-lead-manager/utils'
// 기간 선택은 cmip의 것을 그대로 쓴다 — 프리셋(지난 7일 등)과 달력이 같은
// 방식으로 동작해야 두 화면을 오가며 쓰기 편하다.
import { AutoHeight, LoadingPanel, Segmented } from '@/components/glass'
import { DateRangePicker } from '@/screens/cmip/components/date-range-picker'
import { LiveInflow } from './live-inflow'
import { KpiControls, KpiSection } from './kpi-section'
import { InflowSection } from './inflow-section'
import { SalesSection } from './sales-section'
import { SalesTeamSection } from './sales-team-section'
import { TechSection } from './tech-section'

type MondayTrendProps = ReturnType<typeof useMondayTrendViewModel> & {
  /** 인입통계 맨 위 "오늘 웹 문의 · 실시간"(useLiveInflowViewModel). */
  live: ReturnType<typeof useLiveInflowViewModel>['state']
  /** 인입통계 맨 아래 CS팀 인입 성과(useCsTeamViewModel). */
  csTeam: ReturnType<typeof useCsTeamViewModel>
  /** 기술 통계(useTechStatsViewModel) — 따로 받는 데이터라 불러오는 상태도
   * 따로다. */
  tech: ReturnType<typeof useTechStatsViewModel>
  /** 영업 통계(useSalesTeamViewModel) — 개인 KPI 재료로 만든다. */
  salesTeam: ReturnType<typeof useSalesTeamViewModel>
}

/**
 * 통계 탭 — 소주제 다섯: 인입통계(날짜별 인입 건수, inflow-section.tsx),
 * 판매통계(제품별 판매 수량, sales-section.tsx), 영업 통계, 기술 통계, 개인
 * KPI. 위쪽 줄에서 소주제와 기간을 고른다.
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
  tech,
  salesTeam,
}: MondayTrendProps) => {
  const {
    status,
    range,
    unit,
    section,
    sales,
    neglect,
    kpi,
    tableSorts,
    includeInactive,
    cardViews,
  } = state
  const {
    changeRange,
    changeUnit,
    changeSalesView,
    changeSalesChartMetric,
    changeCardView,
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
  // 기간(단위·시작·끝)이 바뀌면 그래프를 새로 붙여 처음부터 다시 그린다 —
  // 그대로 두면 값만 바뀌어 "그려지는" 움직임이 없다(새로 생긴 줄만 그려진다).
  const drawKey = `${unit}:${range.start}:${range.end}`

  return (
    <>
      <div className="lead_manager_nav monday_stats_nav monday_trend_nav glass_theme">
        <div className="inner">
          {/* 소주제 — 기간은 개인 KPI를 뺀 소주제가 같이 쓴다. */}
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
          {/* 묶는 단위(일/주/월)도 개인 KPI를 뺀 소주제가 같이 쓰고, 판매통계에는
              채널 선택이 더 붙는다. */}
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
        {/* 불러오는 동안은 로딩 판, 다 받으면 화면이 그 높이에서 부드럽게
            자라고(AutoHeight) 카드가 흐릿하게 떠오른다(is-ready —
            _xtool-glass.scss page). 소주제를 바꿀 때는 자라지 않게 새로
            붙인다(key). */}
        <AutoHeight key={section}>
          <div
            className={`wrapper${(section === 'tech' ? tech.state.status : status) === 'ready' ? ' is-ready' : ''}`}
          >
            {/* 기술 통계는 따로 받는 데이터라 불러오는 상태도 스스로 그린다. */}
            {section === 'tech' ? (
              <TechSection tech={tech} unit={unit} drawKey={drawKey} />
            ) : status === 'error' ? (
              <div className="monday_error">
                <p>통계를 불러오지 못했습니다.</p>
                <button type="button" onClick={reload}>
                  다시 시도
                </button>
              </div>
            ) : status === 'idle' || status === 'loading' ? (
              // 실시간 웹 문의는 Monday 통계와 따로 받아, 이쪽이 불러오는
              // 중이어도 오른쪽 자리에 먼저 보인다.
              section === 'inflow' ? (
                <div className="inflow_top_row">
                  <section className="stats_card">
                    <LoadingPanel label="통계를 불러오는 중" minHeight={560} />
                  </section>
                  <LiveInflow live={live} />
                </div>
              ) : (
                <section className="stats_card">
                  <LoadingPanel label="통계를 불러오는 중" minHeight={420} />
                </section>
              )
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
            ) : section === 'team' ? (
              <SalesTeamSection
                team={salesTeam}
                unit={unit}
                drawKey={drawKey}
                neglect={{
                  rows: neglect.sales,
                  today: neglect.today,
                  expanded: neglect.expanded,
                  onToggle: toggleExpanded,
                  sort: tableSorts['neglect:sales'],
                  onSort: (key) => toggleTableSort('neglect:sales', key),
                  view: cardViews['neglect:sales'] ?? 'chart',
                  onView: (next) => changeCardView('neglect:sales', next),
                }}
              />
            ) : section === 'sales' ? (
              <SalesSection
                sales={sales}
                unit={unit}
                onSort={toggleSalesSort}
                onView={changeSalesView}
                onChartMetric={changeSalesChartMetric}
                drawKey={drawKey}
              />
            ) : (
              <InflowSection
                trend={{ state, actions }}
                live={live}
                csTeam={csTeam}
                drawKey={drawKey}
              />
            )}
          </div>
        </AutoHeight>
      </div>
    </>
  )
}
