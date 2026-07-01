import {
  Header,
  ListArea,
  ListHeader,
  Panel,
  SearchRow,
} from '@/screens/parke/components'
import '@/screens/parke/styles/global.scss'
import { ParkeContextProvider } from '@/screens/parke/context'

export default function ParkeScreen() {
  return (
    <ParkeContextProvider>
      <div className="wrap">
        <Header />
        <Panel />
        <SearchRow />
        <ListHeader />
        <ListArea />
      </div>
    </ParkeContextProvider>
  )
}
