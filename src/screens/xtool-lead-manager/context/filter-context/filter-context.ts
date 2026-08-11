import { createContext, useContext } from 'react'
import type { DeviceFilter } from '../../types'

interface FilterContextValue {
  resetSearchValue: () => void
  activeSearch: () => void
  handleSearchChange: (_: React.ChangeEvent<HTMLInputElement>) => void
  searchRef: React.RefObject<HTMLDivElement | null>
  searchActive: boolean
  searchValue: string

  deviceFilter: DeviceFilter
  setDeviceFilter: (device: DeviceFilter) => void
}

export const FilterContext = createContext({} as FilterContextValue)

export const useFilterContext = () => useContext(FilterContext)
