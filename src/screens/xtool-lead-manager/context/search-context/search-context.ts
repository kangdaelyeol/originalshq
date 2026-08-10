import { createContext, useContext } from 'react'

interface SearchContextValue {
  resetSearchValue: () => void
  activeSearch: () => void
  handleSearchChange: (_: React.ChangeEvent<HTMLInputElement>) => void
  searchRef: React.RefObject<HTMLDivElement | null>
  searchActive: boolean
  searchValue: string
}

export const SearchContext = createContext({} as SearchContextValue)

export const useSearchContext = () => useContext(SearchContext)
