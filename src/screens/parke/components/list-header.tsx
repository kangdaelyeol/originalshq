import '@/screens/parke/styles/list-header.scss'

export const ListHeader = () => {
  return (
    <div className="list-header">
      <div className="list-title">Serial Number List</div>
      <div className="list-count" id="listCount">
        0개
      </div>
    </div>
  )
}
