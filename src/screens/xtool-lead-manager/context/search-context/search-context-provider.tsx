import { useRef, useState, type PropsWithChildren } from 'react'
import { SearchContext } from './search-context'
import { useOutsideClick } from '../../hooks/use-outside-click'

export const SearchContextProvider = ({ children }: PropsWithChildren) => {
  const [searchActive, setSearchActive] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const searchRef = useRef<HTMLDivElement>(null)

  const resetSearchValue = () => {
    setSearchValue('')
  }

  const activeSearch = () => {
    setSearchActive(true)
  }

  useOutsideClick(searchRef, () => {
    if (searchValue) return
    setSearchActive(false)
    setSearchValue('')
  })

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value)
  }

  return (
    <SearchContext.Provider
      value={{
        searchActive,
        searchRef,
        resetSearchValue,
        activeSearch,
        handleSearchChange,
        searchValue
      }}
    >
      {children}
    </SearchContext.Provider>
  )
}
