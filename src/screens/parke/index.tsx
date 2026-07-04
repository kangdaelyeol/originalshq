import {
  Footer,
  Header,
  ListArea,
  ListHeader,
  PaginationBar,
  Panel,
  SearchRow,
} from '@/screens/parke/components'
import { ParkeContextProvider } from '@/screens/parke/context'
import Styles from '@/screens/parke/styles/global.module.scss'

export default function ParkeScreen() {
  return (
    <ParkeContextProvider>
      <div className={Styles.parke}>
        <div className={Styles.wrap}>
          <Header />
          <Panel />
          <SearchRow />
          <ListHeader />
          <ListArea />
          <PaginationBar />
          <Footer />
        </div>
      </div>
    </ParkeContextProvider>
  )
}
