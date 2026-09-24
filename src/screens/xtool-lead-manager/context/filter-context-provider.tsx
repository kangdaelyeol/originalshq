import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react'
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

  const activeSearch = useCallback(() => setSearchActive(true), [])
  const resetSearchValue = useCallback(() => setSearchValue(''), [])
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setSearchValue(e.target.value),
    [],
  )

  // 검색창 입력마다 이 value 객체를 새로 만들면 참조가 매번 바뀌어, 표처럼
  // 무거운 하위 트리까지 memo 여부와 무관하게 컨텍스트 재구독으로 다시
  // 그려진다 — 실제로 바뀐 값이 있을 때만 새 객체를 만들도록 묶는다.
  const value = useMemo(
    () => ({
      searchActive,
      searchValue,
      searchRef,
      activeSearch,
      resetSearchValue,
      handleSearchChange,
      deviceFilter,
      setDeviceFilter,
    }),
    [
      searchActive,
      searchValue,
      activeSearch,
      resetSearchValue,
      handleSearchChange,
      deviceFilter,
    ],
  )

  return (
    <FilterContext.Provider value={value}>{children}</FilterContext.Provider>
  )
}
