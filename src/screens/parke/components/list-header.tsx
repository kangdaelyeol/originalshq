import '@/screens/parke/styles/list-header.scss'
import { useParkeContext } from '../context'

export const ListHeader = () => {
  const { serialList, filteredSerials, searchValue } = useParkeContext()
  const searching = searchValue.trim() !== ''
  return (
    <div className="list-header">
      <div className="list-title">Serial Number List</div>
      <div className="list-count" id="listCount">
        {/* 검색 중이면 "찾은 개수 / 전체" */}
        {searching
          ? `${filteredSerials.length} / ${serialList.length}개`
          : `${serialList.length}개`}
      </div>
    </div>
  )
}
