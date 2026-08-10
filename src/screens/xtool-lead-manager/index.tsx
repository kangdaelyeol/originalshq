import { Main, Nav } from './components'
import { SearchContextProvider } from './context/search-context'

export default function XtoolLeadManager() {
  return (
    <>
      <SearchContextProvider>
        <Nav />
        <Main />
      </SearchContextProvider>
    </>
  )
}
