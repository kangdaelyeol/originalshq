import {
  Header,
  ListArea,
  ListHeader,
  Panel,
  SearchRow,
} from '@/screens/parke/components'
import './styles/global.scss'

export default function ParkeScreen() {
  return (
    <div className="wrap">
      <Header />
      <Panel />
      <SearchRow />
      <ListHeader />
      <ListArea />
    </div>
  )
}
