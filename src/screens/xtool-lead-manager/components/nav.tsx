import '@/screens/xtool-lead-manager/styles/nav.scss'
import { useFilterContext } from '@/screens/xtool-lead-manager/context/filter-context'
import { SearchIcon } from '@/screens/xtool-lead-manager/illustration'
import { CloseIcon } from './close-icon'
import { DeviceFilter } from './device-filter'

export const Nav = () => {
  const {
    searchActive,
    searchRef,
    searchValue,
    resetSearchValue,
    activeSearch,
    handleSearchChange,
    deviceFilter,
    setDeviceFilter,
  } = useFilterContext()

  const typed = searchValue?.trim() !== ''

  return (
    <div className="lead_manager_nav">
      <div className="inner">
        <div className="search-box">
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
        <DeviceFilter value={deviceFilter} onChange={setDeviceFilter} />
      </div>
    </div>
  )
}
