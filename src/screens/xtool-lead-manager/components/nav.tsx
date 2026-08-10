import { CloseIcon } from './close-icon'
import { useSearchContext } from '../context/search-context'
import { SearchIcon } from '../illustration'
import '../styles/nav.scss'

export const Nav = () => {
  const {
    searchActive,
    searchRef,
    searchValue,
    resetSearchValue,
    activeSearch,
    handleSearchChange,
  } = useSearchContext()

  const typed = searchValue?.trim() === ''

  return (
    <div className="lead_manager_nav">
      <div className="inner">
        <SearchIcon />
        {searchActive ? (
          <div className="search-container" ref={searchRef}>
            <input
              className={['search-input', typed ? 'typed' : ''].join(' ')}
              type="text"
              name="search"
              id="search"
              autoFocus
              value={searchValue}
              onChange={handleSearchChange}
            />
            {typed && (
              <div className="reset-btn">
                <CloseIcon onClick={resetSearchValue} />
              </div>
            )}
          </div>
        ) : (
          <button className="search-btn" onClick={activeSearch}>
            검색
          </button>
        )}
      </div>
    </div>
  )
}
