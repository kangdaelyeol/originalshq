import { useState, type PropsWithChildren } from 'react'
import { SERIALS_PER_PAGE } from '../constants'
import { ParkeContext } from './parke-context'

export const ParkeContextProvider = ({ children }: PropsWithChildren) => {
  const [serialData, setSerialData] = useState(['abcd', 'abce', 'abcf'])
  const [page, setPage] = useState(0)

  // 목록이 줄어(삭제) 지금 쪽이 범위를 벗어나면 마지막 쪽으로 당긴다.
  const pageCount = Math.max(1, Math.ceil(serialData.length / SERIALS_PER_PAGE))
  const currentPage = Math.min(page, pageCount - 1)
  const pagedSerials = serialData.slice(
    currentPage * SERIALS_PER_PAGE,
    (currentPage + 1) * SERIALS_PER_PAGE,
  )

  const addSerial = (serial: string) => {
    setSerialData((prev) => [...prev, serial])
    // 새 시리얼은 목록 맨 끝에 붙으니, 바로 보이도록 마지막 쪽으로 간다.
    setPage(Math.floor(serialData.length / SERIALS_PER_PAGE))
    return
  }

  const removeSerial = (serial: string) => {
    setSerialData((prev) => prev.filter((s) => s !== serial))
    return
  }

  return (
    <ParkeContext.Provider
      value={{
        serialList: serialData,
        pagedSerials,
        page: currentPage,
        pageCount,
        setPage,
        addSerial,
        removeSerial,
      }}
    >
      {children}
    </ParkeContext.Provider>
  )
}
