import { useState, type PropsWithChildren } from 'react'
import { SERIALS_PER_PAGE } from '../constants'
import { ParkeContext } from './parke-context'

/** 검색어를 비교용으로 다듬는다 — 앞뒤 공백을 빼고 소문자로. QR 주소를
 * 통째로 붙여 넣어도 찾을 수 있게 마지막 "/" 뒤(시리얼)만 쓴다. */
const normalizeQuery = (value: string) =>
  value.trim().split('/').filter(Boolean).pop()?.toLowerCase() ?? ''

export const ParkeContextProvider = ({ children }: PropsWithChildren) => {
  const [serialData, setSerialData] = useState(['abcd', 'abce', 'abcf'])
  const [page, setPage] = useState(0)
  const [searchValue, setSearchValue] = useState('')

  // 검색어가 들어 있는 시리얼만(대소문자 무시). 쪽 나누기는 이 결과 기준.
  const query = normalizeQuery(searchValue)
  const filteredSerials = query
    ? serialData.filter((serial) => serial.toLowerCase().includes(query))
    : serialData

  // 목록이 줄어(삭제·검색) 지금 쪽이 범위를 벗어나면 마지막 쪽으로 당긴다.
  const pageCount = Math.max(
    1,
    Math.ceil(filteredSerials.length / SERIALS_PER_PAGE),
  )
  const currentPage = Math.min(page, pageCount - 1)
  const pagedSerials = filteredSerials.slice(
    currentPage * SERIALS_PER_PAGE,
    (currentPage + 1) * SERIALS_PER_PAGE,
  )

  const changeSearch = (value: string) => {
    setSearchValue(value)
    // 검색 결과는 처음부터 보여준다.
    setPage(0)
  }

  const addSerial = (serial: string) => {
    setSerialData((prev) => [...prev, serial])
    // 새 시리얼은 목록 맨 끝에 붙으니, 바로 보이도록 검색을 풀고 마지막
    // 쪽으로 간다(검색 중이면 새 시리얼이 결과에 없을 수 있어서).
    setSearchValue('')
    setPage(Math.floor(serialData.length / SERIALS_PER_PAGE))
  }

  const removeSerial = (serial: string) => {
    setSerialData((prev) => prev.filter((s) => s !== serial))
  }

  return (
    <ParkeContext.Provider
      value={{
        serialList: serialData,
        filteredSerials,
        pagedSerials,
        page: currentPage,
        pageCount,
        setPage,
        searchValue,
        changeSearch,
        addSerial,
        removeSerial,
      }}
    >
      {children}
    </ParkeContext.Provider>
  )
}
