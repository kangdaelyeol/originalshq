import { FilterContextProvider } from '@/screens/xtool-lead-manager/context'
import { Main, Nav } from '@/screens/xtool-lead-manager/components'
import {
  useCreateLeadViewModel,
  useMainViewModel,
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

  return (
    <>
      <Nav state={main.state} actions={main.actions} />
      <Main {...main} createLead={createLead} />
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
