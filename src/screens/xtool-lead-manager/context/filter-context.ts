import { createContext, useContext } from 'react'
import type { Device } from '@/screens/xtool-lead-manager/entity'

interface FilterContextValue {
  resetSearchValue: () => void
  activeSearch: () => void
  handleSearchChange: (_: React.ChangeEvent<HTMLInputElement>) => void
  searchRef: React.RefObject<HTMLDivElement | null>
  searchActive: boolean
  searchValue: string
  /** 표를 필터링할 기기 다중 선택 — 비어 있으면(기본) 전체 기기를 보여준다.
   * 상담/구매 이력 중 어느 하나라도 선택된 기기와 일치하면 그 고객을 보여준다. */
  selectedDevices: ReadonlySet<Device>
  toggleDevice: (device: Device) => void
}

export const FilterContext = createContext({} as FilterContextValue)

export const useFilterContext = () => useContext(FilterContext)
