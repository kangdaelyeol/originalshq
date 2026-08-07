import '@/screens/xtool-lead-manager/styles/main.scss'
import { SearchIcon } from '../illustration'
import { RefObject, useEffect, useRef, useState } from 'react'

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
            <div className="search-container">
              <input
                className="search-input"
                type="text"
                name="search"
                id="search"
                autoFocus
              />
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
