import { useUsageTracking } from '@/hooks'
import { FilterContextProvider } from '@/screens/xtool-lead-manager/context'
import {
  Main,
  MondayMain,
  MondayNav,
  MondayStats,
  MondayTrend,
  GaTracking,
  Nav,
} from '@/screens/xtool-lead-manager/components'
import {
  useCreateLeadViewModel,
  useCsTeamViewModel,
  useGaTrackingViewModel,
  useLeadMondayMatchViewModel,
  useLiveInflowViewModel,
  useMainViewModel,
  useMondayStatsViewModel,
  useMondayTrendViewModel,
  useMondayViewModel,
  usePageTabViewModel,
} from '@/screens/xtool-lead-manager/view-model'

// view-model 훅은 전부 여기서만 부르고, 결과를 컴포넌트로 내려보낸다 — 훅이
// 다른 훅을 안에서 부르지 않게 해서, 어떤 데이터가 어디서 오는지 이 파일
// 하나로 따라갈 수 있게 한다. 훅 사이에 필요한 것(수기 등록이 쓰는 목록
// 갱신·토스트)도 여기서 꺼내 넘긴다.
//
// useMainViewModel은 내부에서 useFilterContext()를 쓰므로 FilterContextProvider의
// 자식이어야 한다(Provider를 렌더하는 컴포넌트 자신은 그 값을 못 본다) — 그래서
// XtoolLeadManager가 아니라 Provider 안의 이 컴포넌트에서 호출한다.
const XtoolLeadManagerScreen = () => {
  const main = useMainViewModel()
  const createLead = useCreateLeadViewModel({
    fetchLeads: main.actions.fetchLeads,
    showToast: main.actions.showToast,
  })

  // 최상위 탭 — 리드(이 화면에서 직접 관리하는 데이터) / Monday 고객(Monday
  // CRM 보드들을 번호 기준으로 통합한 읽기 전용 데이터). Monday 목록은 그 탭이나
  // 퍼널 통계 탭을 처음 열 때 받아온다.
  const pageTab = usePageTabViewModel()
  const { tab } = pageTab.state
  // 고객 목록은 Monday 고객 탭과 퍼널 통계 탭이 쓴다(통계 탭은 따로 받는
  // 날짜별 집계만 쓴다).
  const monday = useMondayViewModel(tab === 'monday' || tab === 'stats')
  const trend = useMondayTrendViewModel(tab === 'trend')
  // 인입통계 맨 아래 CS팀 인입 성과 — 명단은 각자 브라우저에, 숫자는 통계 데이터로.
  const csTeam = useCsTeamViewModel(
    trend.state.consultations,
    trend.state.range,
  )
  // 인입통계 맨 위의 오늘 웹 문의(실시간) — 그 화면을 보고 있을 때만 받는다.
  const live = useLiveInflowViewModel(
    tab === 'trend' && trend.state.section === 'inflow',
    trend.state.syncedAt,
  )
  // 오기입 추적 — BigQuery를 부르는 조회라 그 탭을 처음 열 때만 받는다.
  const gaTracking = useGaTrackingViewModel(tab === 'tracking')
  // 퍼널 통계는 Monday 고객 목록을 그대로 집계한다.
  const stats = useMondayStatsViewModel(monday.state.customers)

  // 사용 분석(/log) — 지금 보고 있는 탭. 통계 탭은 소주제까지 나눠 남긴다.
  useUsageTracking(
    'xtool',
    tab === 'trend' ? `trend/${trend.state.section}` : tab,
  )

  // 리드 상세가 열려 있으면 같은 전화번호의 Monday 고객을 찾아 둔다 — 두
  // 탭의 데이터는 따로 살고, 이 번호 대조가 둘을 잇는 유일한 연결이다.
  const mondayMatch = useLeadMondayMatchViewModel(main.state.detail?.ph ?? null)

  /** 리드 상세의 Monday 패널에서 "전체 기록 보기" — Monday 고객 탭으로 넘어가
   * 그 고객의 상세를 연다. */
  const openInMonday = (phone: string) => {
    main.actions.hideDetail()
    pageTab.actions.selectTab('monday')
    monday.actions.openDetail(phone)
  }

  if (tab === 'tracking') {
    return <GaTracking state={gaTracking.state} actions={gaTracking.actions} />
  }

  if (tab === 'trend') {
    return (
      <MondayTrend
        state={trend.state}
        actions={trend.actions}
        live={live.state}
        csTeam={csTeam}
      />
    )
  }

  if (tab === 'stats') {
    return (
      <MondayStats
        {...stats}
        status={monday.state.status}
        onReload={monday.actions.reload}
        onOpenCustomer={(phone) => {
          pageTab.actions.selectTab('monday')
          monday.actions.openDetail(phone)
        }}
      />
    )
  }

  if (tab === 'monday') {
    return (
      <>
        <MondayNav state={monday.state} actions={monday.actions} />
        <MondayMain state={monday.state} actions={monday.actions} />
      </>
    )
  }

  return (
    <>
      <Nav state={main.state} actions={main.actions} />
      <Main
        {...main}
        createLead={createLead}
        mondayMatch={mondayMatch.state}
        onOpenInMonday={openInMonday}
      />
    </>
  )
}

export default function XtoolLeadManager() {
  return (
    <FilterContextProvider>
      <XtoolLeadManagerScreen />
    </FilterContextProvider>
  )
}
