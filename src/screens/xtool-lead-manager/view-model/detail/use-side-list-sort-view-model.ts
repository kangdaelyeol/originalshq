import { useMemo, useState } from 'react'
import type { Lead } from '@/screens/xtool-lead-manager/entity'
import type { SortDirection } from '@/screens/xtool-lead-manager/types'

export const SideListSortField = {
  PHONE: 'ph',
  FIRST_NAME: 'fn',
  REMARKS: 'remarks',
} as const

// ''는 "아직 정렬 버튼을 안 눌렀다"는 뜻 — leads가 이미 메인 표의 정렬이
// 적용된 순서라, 굳이 기본값으로 한 컬럼을 골라 다시 정렬하지 않는다.
export type SideListSortField =
  (typeof SideListSortField)[keyof typeof SideListSortField] | ''

/** 상세 모달 왼쪽 고객 목록의 정렬 — 목록 컴포넌트가 아니라 모달이 들고
 * 있는다. 고객을 지웠을 때 "화면에서 바로 위 고객"으로 넘어가려면 모달도
 * 목록이 보여주는 순서를 알아야 하기 때문. */
export const useSideListSortViewModel = (leads: Lead[]) => {
  const [sortField, setSortField] = useState<SideListSortField>('')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

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

  return { sortField, sortDirection, sortedLeads, toggleSort }
}

/** leadId를 지운 뒤 보여줄 고객 — 목록에서 바로 위, 맨 위였다면 바로 아래.
 * 남는 고객이 없으면 null(모달을 닫는다). */
export const neighborAfterDelete = (
  sortedLeads: Lead[],
  leadId: string,
): string | null => {
  const index = sortedLeads.findIndex((lead) => lead.id === leadId)
  if (index === -1) return null
  return (sortedLeads[index - 1] ?? sortedLeads[index + 1])?.id ?? null
}
