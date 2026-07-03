import '@/screens/parke/styles/list-header.scss'
import { useParkeContext } from '../context'

export const ListHeader = () => {
  const { serialList } = useParkeContext()
  return (
    <div className="list-header">
      <div className="list-title">Serial Number List</div>
      <div className="list-count" id="listCount">
        {serialList.length}개
      </div>
    </div>
  )
}
