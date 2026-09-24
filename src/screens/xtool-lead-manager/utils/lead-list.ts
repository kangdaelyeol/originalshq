import {
  latestConsultationAt,
  latestIntakeAt,
  latestPurchaseAt,
  type Device,
  type Lead,
} from '@/screens/xtool-lead-manager/entity'
import { SortField, type SortDirection } from '@/screens/xtool-lead-manager/types'

/** 이름/비고는 입력 그대로(대소문자만 무시) 부분일치, 전화번호는 숫자만
 * 남겨서 비교한다 — ph는 저장 시점에 이미 숫자만 남아있어서, "010-1234"처럼
 * 하이픈을 섞어 검색해도 매치되게 하려면 검색어 쪽도 숫자만 뽑아야 한다.
 * 검색어에 숫자가 하나도 없으면(순수 이름/비고 검색) 전화번호 비교는 건너뛴다
 * — 안 그러면 빈 문자열이 모든 ph의 부분 문자열로 잡혀 전부 매치돼버린다. */
export const filterLeadsByKeywords = (rows: Lead[], keyword: string) => {
  const trimmed = keyword.trim().toLowerCase()
  if (!trimmed) return rows
  const digitsOnly = trimmed.replace(/\D/g, '')
  return rows.filter(
    (row) =>
      row.fn.toLowerCase().includes(trimmed) ||
      row.remarks.toLowerCase().includes(trimmed) ||
      (digitsOnly !== '' && row.ph.includes(digitsOnly)),
  )
}

export const sortLeads = (
  rows: Lead[],
  sortField: SortField,
  sortDirection: SortDirection,
) => {
  const sorted = [...rows]
  sorted.sort((a, b) => {
    let res: number
    switch (sortField) {
      // Lead 최상위엔 더 이상 createdAt이 없다(intakes 배열로 옮김) — 접수/
      // 상담/구매 모두 여러 건일 수 있어, 가장 최근 시각을 기준으로 정렬한다.
      case SortField.CREATED_AT:
        res = latestIntakeAt(a) - latestIntakeAt(b)
        break
      case SortField.CONSULTATION_AT:
        res = latestConsultationAt(a) - latestConsultationAt(b)
        break
      case SortField.PURCHASE_AT:
        res = latestPurchaseAt(a) - latestPurchaseAt(b)
        break
      default:
        res = a[sortField].localeCompare(b[sortField], 'ko')
    }
    return sortDirection === 'asc' ? res : -res
  })

  return sorted
}

// 상담/구매 어느 기록에서든 선택된 기기 중 하나라도 등장하면 그 고객을
// 보여준다 — 기기가 리드 공통 필드가 아니라 상담/구매 기록마다 따로 있어서다.
// 아무 것도 선택하지 않았으면(기본) 필터링하지 않고 전체를 보여준다.
export const filterLeadsByDevice = (
  rows: Lead[],
  selectedDevices: ReadonlySet<Device>,
) => {
  if (selectedDevices.size === 0) return rows
  return rows.filter(
    (row) =>
      (row.consultations ?? []).some((c) => selectedDevices.has(c.device)) ||
      (row.purchases ?? []).some((p) => selectedDevices.has(p.device)),
  )
}
