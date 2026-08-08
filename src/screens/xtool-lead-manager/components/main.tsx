import '@/screens/xtool-lead-manager/styles/main.scss'
import { SearchIcon } from '../illustration'
import { useEffect, useRef, useState } from 'react'
import { CloseIcon } from './close-icon'
import { useOutsideClick } from '../hooks/use-outside-click'

const DayMill = 1000 * 60 * 60 * 24

const data = [
  {
    id: 1,
    fn: 'rkdeofuf',
    ph: '01024130510',
    device: 'metalfab',
    createdAt: Date.now(),
  },
  {
    id: 2,
    fn: 'rkdeofuf',
    ph: '01024130510',
    device: 'metalfab',
    createdAt: Date.now() + DayMill,
  },
  {
    id: 3,
    fn: 'rkdeofuf',
    ph: '01024130510',
    device: 'metalfab',
    createdAt: Date.now() + DayMill * 2,
  },
  {
    id: 4,
    fn: 'rkdeofuf',
    ph: '01024130510',
    device: 'metalfab',
    createdAt: Date.now() + DayMill * 3,
  },
]

export const Main = () => {
  const [searchActive, setSearchActive] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const searchRef = useRef<HTMLDivElement>(null)
  useOutsideClick(searchRef, () => {
    if (searchValue) return
    setSearchActive(false)
    setSearchValue('')
  })

  const typed = !!searchValue

  const activeSearch = () => {
    setSearchActive(true)
  }

  const inactiveSearch = () => {
    setSearchActive(false)
  }

  useEffect(() => {
    return () => {}
  }, [])

  return (
    <div className="xtool-main">
      <div className="wrapper">
        <div className="nav">
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
                onChange={(e) => setSearchValue(e.target.value)}
              />
              {typed && (
                <div className="reset-btn">
                  <CloseIcon
                    onClick={() => {
                      setSearchValue('')
                    }}
                  />
                </div>
              )}
            </div>
          ) : (
            <button className="search-btn" onClick={activeSearch}>
              검색
            </button>
          )}
        </div>
        <div className="group"></div>
      </div>
    </div>
  )
}
