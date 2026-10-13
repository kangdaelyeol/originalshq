import { FilterContextProvider } from '@/screens/xtool-lead-manager/context'
import {
  Main,
  MondayMain,
  MondayNav,
  MondayStats,
  Nav,
} from '@/screens/xtool-lead-manager/components'
import {
  useCreateLeadViewModel,
  useLeadMondayMatchViewModel,
  useMainViewModel,
  useMondayStatsViewModel,
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
  const monday = useMondayViewModel(tab !== 'leads')
  // 퍼널 통계는 Monday 고객 목록을 그대로 집계한다.
  const stats = useMondayStatsViewModel(monday.state.customers)

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

  if (tab === 'stats') {
    return (
      <MondayStats
        {...stats}
        status={monday.state.status}
        onReload={monday.actions.reload}
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
