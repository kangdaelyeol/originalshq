import { FilterContextProvider } from '@/screens/xtool-lead-manager/context'
import { Main, Nav } from '@/screens/xtool-lead-manager/components'

export default function XtoolLeadManager() {
  return (
    <>
      <FilterContextProvider>
        <Nav />
        <Main />
      </FilterContextProvider>
    </>
  )
}
