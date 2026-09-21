import { latestIntakeAt, type Lead } from '@/screens/xtool-lead-manager/entity'
import {
  DeviceFilterLabel,
  SortField,
  type SortDirection,
} from '@/screens/xtool-lead-manager/types'

export const filterLeadsByKeywords = (rows: Lead[], keyword: string) => {
  const trimmed = keyword.trim().toLowerCase()
  if (!trimmed) return rows
  return rows.filter((row) => row.fn.toLowerCase().includes(trimmed))
}

export const sortLeads = (
  rows: Lead[],
  sortField: SortField,
  sortDirection: SortDirection,
) => {
  const sorted = [...rows]
  sorted.sort((a, b) => {
    let res: number
    if (sortField === SortField.CREATED_AT) {
      // Lead 최상위엔 더 이상 createdAt이 없다(intakes 배열로 옮김) — 가장
      // 최근 접수 시각을 기준으로 정렬한다.
      res = latestIntakeAt(a) - latestIntakeAt(b)
    } else {
      res = a[sortField].localeCompare(b[sortField], 'ko')
    }
    return sortDirection === 'asc' ? res : -res
  })

  return sorted
}

// 상담/구매 어느 기록에서든 해당 기기가 한 번이라도 등장하면 그 고객을 보여준다
// — 기기가 이제 리드 공통 필드가 아니라 상담/구매 기록마다 따로 있어서다.
export const filterLeadsByDevice = (
  rows: Lead[],
  deviceFilter: DeviceFilterLabel,
) => {
  if (deviceFilter === DeviceFilterLabel.ALL) return rows
  return rows.filter(
    (row) =>
      (row.consultations ?? []).some((c) => c.device === deviceFilter) ||
      (row.purchases ?? []).some((p) => p.device === deviceFilter),
  )
}
