import { createContext } from 'react'

export interface ParkeContextValue {
  serialList: string[]
  /** 지금 쪽에 보이는 시리얼(serialList를 SERIALS_PER_PAGE개씩 자른 것). */
  pagedSerials: string[]
  /** 지금 쪽(0부터) — 항상 0 ~ pageCount-1 안이다. */
  page: number
  pageCount: number
  setPage: (page: number) => void
  addSerial: (v: string) => void
  removeSerial: (v: string) => void
}

export const ParkeContext = createContext({} as ParkeContextValue)
