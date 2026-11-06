import { Search } from 'lucide-react'
import { cx } from '../../../lib/cx'

interface SearchFieldProps {
  placeholder: string
  /** 오른쪽 단축키 칸(⌘K) */
  kbd?: string
  className?: string
}

/** 알약 검색 칸 — 돋보기·흐린 안내 글·단축키 칸. 사이드바(16px 높이)와 주문 도구줄(18px)이 같이 쓴다. */
export function SearchField({ placeholder, kbd, className }: SearchFieldProps) {
  return (
    <label className={cx('d16-search', 'd16-hov', className)}>
      <Search className="d16-search__icon" strokeWidth={2} aria-hidden />
      <input className="d16-search__input" placeholder={placeholder} aria-label={placeholder} />
      {kbd && <kbd className="d16-search__kbd">{kbd}</kbd>}
    </label>
  )
}
