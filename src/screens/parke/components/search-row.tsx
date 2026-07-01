import '@/screens/parke/styles/search-row.scss'

export const SearchRow = () => {
  return (
    <div className="search-row">
      <span className="search-icon">⌕</span>
      <input type="text" id="searchInput" placeholder="시리얼 번호 검색" />
    </div>
  )
}
