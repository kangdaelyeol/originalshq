import { Main, Nav } from './components'
import { FilterContextProvider } from './context/filter-context'

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
