import '@/screens/parke/styles/search-row.scss'
import { useParkeContext } from '@/screens/parke/context'

/** 시리얼 검색 — 입력하는 대로 목록이 걸러진다(대소문자 무시, 일부만 쳐도
 * 된다). Esc나 × 버튼으로 지운다. */
export const SearchRow = () => {
  const { searchValue, changeSearch } = useParkeContext()

  return (
    <div className="search-row">
      <span className="search-icon">⌕</span>
      <input
        type="search"
        className="search-input"
        placeholder="시리얼 번호 검색"
        aria-label="시리얼 번호 검색"
        value={searchValue}
        onChange={(e) => changeSearch(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') changeSearch('')
        }}
      />
      {searchValue && (
        <button
          type="button"
          className="search-clear"
          aria-label="검색어 지우기"
          onClick={() => changeSearch('')}
        >
          ×
        </button>
      )}
    </div>
  )
}
