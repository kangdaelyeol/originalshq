import { useRef, useState, type PropsWithChildren } from 'react'
import { FilterContext } from './filter-context'
import { useOutsideClick } from '../../hooks/use-outside-click'
import type { DeviceFilter } from '../../types'

export const FilterContextProvider = ({ children }: PropsWithChildren) => {
  const [searchActive, setSearchActive] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [deviceFilter, setDeviceFilter] = useState<DeviceFilter>('all')
  const searchRef = useRef<HTMLDivElement>(null)

  useOutsideClick(searchRef, () => {
    if (searchValue) return
    setSearchActive(false)
  })

  const activeSearch = () => setSearchActive(true)
  const resetSearchValue = () => setSearchValue('')
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setSearchValue(e.target.value)

  return (
    <FilterContext.Provider
      value={{
        searchActive,
        searchValue,
        searchRef,
        activeSearch,
        resetSearchValue,
        handleSearchChange,
        deviceFilter,
        setDeviceFilter,
      }}
    >
      {children}
    </FilterContext.Provider>
  )
}
