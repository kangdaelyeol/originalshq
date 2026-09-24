import { useEffect, useMemo, useRef, useState } from 'react'
import { formatPhoneNumber } from '@/screens/xtool-lead-manager/utils'
import type { Lead } from '@/screens/xtool-lead-manager/entity'
import type { SortDirection } from '@/screens/xtool-lead-manager/types'
import { SortButton } from '@/screens/xtool-lead-manager/components'

const SideListSortField = {
  PHONE: 'ph',
  FIRST_NAME: 'fn',
  REMARKS: 'remarks',
} as const

// ''는 "아직 정렬 버튼을 안 눌렀다"는 뜻 — leads가 이미 메인 표의 정렬이
// 적용된 순서라, 굳이 기본값으로 한 컬럼을 골라 다시 정렬하지 않는다.
type SideListSortField = (typeof SideListSortField)[keyof typeof SideListSortField] | ''

const FOCUSABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

/** 상세 모달 왼쪽의 고객 목록 — 지금 검색/정렬/기기 필터가 걸린 전체 고객
 * (메인 표와 같은 데이터, 페이지네이션 전)을 전화번호/고객명/비고만 간략히
 * 보여준다. 행을 클릭하면 모달을 닫았다 다시 여는 대신 그 고객으로 상세
 * 내용만 바뀐다 — 여러 고객을 이어서 훑어볼 때 편하도록. 위/아래 방향키로도
 * 같은 식으로 이전/다음 고객으로 넘어갈 수 있다. */
export const DetailSideList = ({
  leads,
  activeLeadId,
  onSelect,
}: {
  leads: Lead[]
  activeLeadId: string
  onSelect: (rowId: string) => void
}) => {
  const [sortField, setSortField] = useState<SideListSortField>('')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const scrollRef = useRef<HTMLDivElement>(null)

  const toggleSort = (field: SideListSortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const sortedLeads = useMemo(() => {
    if (!sortField) return leads
    const sorted = [...leads]
    sorted.sort((a, b) => {
      const res = a[sortField].localeCompare(b[sortField], 'ko')
      return sortDirection === 'asc' ? res : -res
    })
    return sorted
  }, [leads, sortField, sortDirection])

  // 상세 폼 안의 입력창(고객명 수정, 기기 선택 등)에 포커스가 있을 때
  // 방향키를 누르면 그건 그 입력창에서 커서 이동 등으로 써야 하는 키라
  // 가로채지 않는다.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
      const target = e.target as HTMLElement | null
      if (target && FOCUSABLE_TAGS.has(target.tagName)) return

      const currentIndex = sortedLeads.findIndex((l) => l.id === activeLeadId)
      if (currentIndex === -1) return

      const nextIndex =
        e.key === 'ArrowUp'
          ? Math.max(0, currentIndex - 1)
          : Math.min(sortedLeads.length - 1, currentIndex + 1)

      if (nextIndex === currentIndex) return
      e.preventDefault()
      onSelect(sortedLeads[nextIndex].id)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [sortedLeads, activeLeadId, onSelect])

  // 방향키로 넘어간 행이 스크롤 영역 밖에 있으면 안 보이니 시야 안으로 끌어온다.
  useEffect(() => {
    const activeRow = scrollRef.current?.querySelector('tr.active')
    activeRow?.scrollIntoView({ block: 'nearest' })
  }, [activeLeadId])

  return (
    <div className="detail_side_list">
      <div className="detail_side_list_head">
        <span className="title">검색된 고객</span>
        <span className="count">{leads.length}건</span>
      </div>
      <div className="detail_side_list_scroll" ref={scrollRef}>
        <table className="detail_side_list_table">
          <thead>
            <tr>
              <th className="col-ph">
                전화번호
                <SortButton
                  columnKey={SideListSortField.PHONE}
                  sortField={sortField}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                />
              </th>
              <th>
                고객명
                <SortButton
                  columnKey={SideListSortField.FIRST_NAME}
                  sortField={sortField}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                />
              </th>
              <th>
                비고
                <SortButton
                  columnKey={SideListSortField.REMARKS}
                  sortField={sortField}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedLeads.map((row) => (
              <tr
                key={row.id}
                className={row.id === activeLeadId ? 'active' : ''}
                onClick={() => onSelect(row.id)}
              >
                <td className="col-ph">{formatPhoneNumber(row.ph)}</td>
                <td>{row.fn || '이름 없음'}</td>
                <td>{row.remarks || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
