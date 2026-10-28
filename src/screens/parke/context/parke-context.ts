import { createContext } from 'react'

export interface ParkeToast {
  id: number
  tone: 'success' | 'error'
  message: string
  /** 되돌리기 같은 버튼 — 누르면 토스트가 닫힌다. */
  action?: { label: string; run: () => void }
}

export interface ParkeContextValue {
  /** 로그인한 관리자 이메일 — 삭제 기록 등에 남긴다. */
  adminEmail: string
  /** 시리얼 목록(DB allow/)을 받는 중·받음·실패. */
  listStatus: 'loading' | 'ready' | 'error'
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
  /** 새 시리얼을 DB에 등록한다 — 성공 여부를 돌려준다. */
  addSerial: (v: string) => Promise<boolean>
  /** 삭제 확인 모달을 띄운다(바로 지우지 않는다). */
  removeSerial: (v: string) => void
  /** 확인 모달이 떠 있는 시리얼. */
  pendingDelete: string | null
  confirmDelete: () => Promise<void>
  cancelDelete: () => void
  deleting: boolean
  /** 삭제 기록에서 되돌리기. */
  restore: (logId: string, serial: string) => Promise<void>
  toasts: ParkeToast[]
  dismissToast: (id: number) => void
}

export const ParkeContext = createContext({} as ParkeContextValue)
