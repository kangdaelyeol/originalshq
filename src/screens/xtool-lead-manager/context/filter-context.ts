import { createContext, useContext } from 'react'
import type { DeviceFilterLabel } from '@/screens/xtool-lead-manager/types'

interface FilterContextValue {
  resetSearchValue: () => void
  activeSearch: () => void
  handleSearchChange: (_: React.ChangeEvent<HTMLInputElement>) => void
  searchRef: React.RefObject<HTMLDivElement | null>
  searchActive: boolean
  searchValue: string
  deviceFilter: DeviceFilterLabel
  setDeviceFilter: (device: DeviceFilterLabel) => void
}

export const FilterContext = createContext({} as FilterContextValue)

export const useFilterContext = () => useContext(FilterContext)
