import { useRef, useState, type PropsWithChildren } from 'react'
import { useOutsideClick } from '@/screens/xtool-lead-manager/hooks'
import { FilterContext } from '@/screens/xtool-lead-manager/context'
import { DeviceFilterLabel } from '@/screens/xtool-lead-manager/types'

export const FilterContextProvider = ({ children }: PropsWithChildren) => {
  const [searchActive, setSearchActive] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [deviceFilter, setDeviceFilter] = useState<DeviceFilterLabel>(
    DeviceFilterLabel.ALL,
  )
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
