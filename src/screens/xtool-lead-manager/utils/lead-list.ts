import {
  latestConsultationAt,
  latestIntakeAt,
  latestPurchaseAt,
  type Device,
  type Lead,
} from '@/screens/xtool-lead-manager/entity'
import {
  DeviceFilterLabel,
  SortField,
  type SortDirection,
} from '@/screens/xtool-lead-manager/types'

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

/** 상담 기기 서머리 표의 한 행 — 상담 이력 1건 + 그 상담을 한 고객 정보. */
export type ConsultationSummaryRow = {
  leadId: string
  recordId: string
  fn: string
  ph: string
  remarks: string
  device: Device
  at: number
}

/** 선택된 기기로 상담한 이력을 전부 펼친다 — 리드 하나가 같은(또는 다른)
 * 기기로 여러 번 상담했을 수 있어, 리드 단위가 아니라 상담 기록 단위로 한
 * 행씩 보여준다(같은 리드가 여러 행에 걸쳐 나올 수 있음). 정렬은 별도
 * (sortConsultationSummaryRows)로 뺐다 — 컬럼 헤더에서 바꿀 수 있어야 해서. */
export const buildConsultationSummaryRows = (
  leads: readonly Lead[],
  selectedDevices: ReadonlySet<Device>,
): ConsultationSummaryRow[] => {
  const rows: ConsultationSummaryRow[] = []
  for (const lead of leads) {
    for (const c of lead.consultations ?? []) {
      if (!selectedDevices.has(c.device)) continue
      rows.push({
        leadId: lead.id,
        recordId: c.id,
        fn: lead.fn,
        ph: lead.ph,
        remarks: lead.remarks,
        device: c.device,
        at: c.at,
      })
    }
  }
  return rows
}

export const ConsultationSummarySortField = {
  FIRST_NAME: 'fn',
  PHONE: 'ph',
  DEVICE: 'device',
  AT: 'at',
  REMARKS: 'remarks',
} as const

export type ConsultationSummarySortField =
  (typeof ConsultationSummarySortField)[keyof typeof ConsultationSummarySortField]

/** 상담 기기 서머리 표의 컬럼 정렬 — AT(상담 일시)만 숫자 비교, 나머지는
 * 문자열(가나다) 비교. 메인 표의 sortLeads와 같은 결. */
export const sortConsultationSummaryRows = (
  rows: readonly ConsultationSummaryRow[],
  sortField: ConsultationSummarySortField,
  sortDirection: SortDirection,
): ConsultationSummaryRow[] => {
  const sorted = [...rows]
  sorted.sort((a, b) => {
    const res =
      sortField === ConsultationSummarySortField.AT
        ? a.at - b.at
        : a[sortField].localeCompare(b[sortField], 'ko')
    return sortDirection === 'asc' ? res : -res
  })
  return sorted
}
