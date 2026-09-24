import { FilterContextProvider } from '@/screens/xtool-lead-manager/context'
import { Main, Nav } from '@/screens/xtool-lead-manager/components'
import { useMainViewModel } from '@/screens/xtool-lead-manager/view-model'

// useMainViewModel은 내부에서 useFilterContext()를 쓰므로 FilterContextProvider의
// 자식이어야 한다(Provider를 렌더하는 컴포넌트 자신은 그 값을 못 본다) — 그래서
// XtoolLeadManager가 아니라 Provider 안의 이 컴포넌트에서 한 번만 호출해
// Nav·Main 둘 다에 내려준다(둘이 표 페이지네이션 상태를 공유해야 해서).
const XtoolLeadManagerScreen = () => {
  const viewModel = useMainViewModel()

  return (
    <>
      <Nav state={viewModel.state} actions={viewModel.actions} />
      <Main {...viewModel} />
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
