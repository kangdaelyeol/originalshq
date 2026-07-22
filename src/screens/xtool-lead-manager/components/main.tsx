import '@/screens/xtool-lead-manager/styles/main.scss'
import { SearchIcon } from '../illustration'

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
  return (
    <div className="xtool-main">
      <div className="wrapper">
        <div className="nav">
          <button className="search-btn">
            <SearchIcon /> 검색
          </button>
        </div>
        <div className="group"></div>
      </div>
    </div>
  )
}
