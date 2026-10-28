import { createContext } from 'react'

export interface ParkeContextValue {
  serialList: string[]
  /** 검색어에 맞는 시리얼 전체(검색어가 없으면 serialList 그대로). */
  filteredSerials: string[]
  /** 지금 쪽에 보이는 시리얼(filteredSerials를 SERIALS_PER_PAGE개씩 자른 것). */
  pagedSerials: string[]
  /** 지금 쪽(0부터) — 항상 0 ~ pageCount-1 안이다. */
  page: number
  pageCount: number
  setPage: (page: number) => void
  /** 시리얼 검색어(입력창 그대로). */
  searchValue: string
  changeSearch: (value: string) => void
  addSerial: (v: string) => void
  removeSerial: (v: string) => void
}

export const ParkeContext = createContext({} as ParkeContextValue)
