import type { MondayCustomerListItem } from '../entity'

/** 숫자만 저장된 번호를 보기 좋게 끊는다. 서울(02)만 지역번호가 두 자리라
 * 따로 처리한다 — 010-1234-5678 / 02-123-4567 / 031-123-4567. */
export const formatMondayPhone = (phone: string): string => {
  const areaLength = phone.startsWith('02') ? 2 : 3
  const area = phone.slice(0, areaLength)
  const rest = phone.slice(areaLength)
  return `${area}-${rest.slice(0, rest.length - 4)}-${rest.slice(-4)}`
}

/** Monday가 준 날짜에서 날짜 부분만 — "2026-09-17 14:00" 이나
 * "2026-09-29T07:18:08Z" → "2026-09-17". */
export const formatMondayDate = (value: string | null): string =>
  value ? value.slice(0, 10) : '-'

/** 금액 표기 — 12,345,000원. */
export const formatWon = (amount: number): string =>
  `${amount.toLocaleString('ko-KR')}원`

export type MondayCategory =
  | 'all'
  | 'consultation'
  | 'visit'
  | 'purchase'
  | 'online'
  | 'tech'
  | 'balance'
  | 'multiple'

export const MONDAY_CATEGORY_LABEL: Record<MondayCategory, string> = {
  all: '전체',
  consultation: '상담',
  visit: '방문체험',
  purchase: '구매',
  online: '온라인 구매',
  tech: '기술 문의',
  balance: '잔금 있음',
  multiple: '기록 2건 이상',
}

/** 기술지원팀 기록(출장·AS·기술 문의·기타업무) 수 — 예전에 저장된 고객
 * 문서에는 이 값들이 없다. */
export const techRecordCount = (customer: MondayCustomerListItem): number => {
  const { summary } = customer
  return (
    (summary.fieldServiceCount ?? 0) +
    (summary.repairCount ?? 0) +
    (summary.techInquiryCount ?? 0) +
    (summary.techTaskCount ?? 0)
  )
}

export const recordCount = (customer: MondayCustomerListItem): number => {
  const { summary } = customer
  return (
    summary.consultationCount +
    summary.visitCount +
    summary.purchaseCount +
    summary.surveyCount +
    summary.sampleTestCount +
    techRecordCount(customer)
  )
}

export const matchesMondayCategory = (
  customer: MondayCustomerListItem,
  category: MondayCategory,
): boolean => {
  switch (category) {
    case 'consultation':
      return customer.summary.consultationCount > 0
    case 'visit':
      return customer.summary.visitCount > 0
    case 'purchase':
      return customer.summary.purchaseCount > 0
    case 'online':
      return customer.summary.onlinePurchaseCount > 0
    case 'tech':
      return techRecordCount(customer) > 0
    case 'balance':
      return customer.summary.balanceAmount > 0
    case 'multiple':
      return recordCount(customer) > 1
    default:
      return true
  }
}

/** 검색어(공백으로 나눈 낱말 전부)가 이름·번호·이메일·담당자 어딘가에 들어
 * 있는 고객만 남긴다. 번호는 하이픈을 넣어 쳐도 찾도록 숫자끼리도 비교한다. */
export const filterMondayCustomers = (
  customers: MondayCustomerListItem[],
  search: string,
): MondayCustomerListItem[] => {
  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return customers

  return customers.filter((customer) => {
    const text = [
      ...customer.names,
      ...customer.emails,
      ...customer.summary.assignees,
    ]
      .join(' ')
      .toLowerCase()
    const phones = [customer.phone, ...customer.otherPhones].join(' ')

    return words.every((word) => {
      const digits = word.replace(/\D/g, '')
      return text.includes(word) || (digits !== '' && phones.includes(digits))
    })
  })
}

export type MondaySort =
  'updated' | 'records' | 'purchase' | 'amount' | 'consultation'

export const MONDAY_SORT_LABEL: Record<MondaySort, string> = {
  updated: '최근 수정순',
  records: '기록 많은 순',
  consultation: '최근 상담순',
  purchase: '최근 구매순',
  amount: '구매 금액순',
}

/** 이 고객의 상담이 그 보드에서 들어왔으면 그 보드의 최근 상담 — 아니면
 * undefined. 상담 보드 목록이 생기기 전에 동기화된 고객은 늘 undefined. */
const consultationOn = (customer: MondayCustomerListItem, board: string) =>
  customer.summary.consultationBoards?.find((b) => b.boardName === board)

/** 상담 보드 거르기 — board가 null이면 모두. */
export const matchesConsultationBoard = (
  customer: MondayCustomerListItem,
  board: string | null,
) => board === null || consultationOn(customer, board) !== undefined

/** 상담이 들어온 보드와 그 보드의 고객 수 — 많은 순(같으면 이름 순). */
export const countConsultationBoards = (
  customers: readonly MondayCustomerListItem[],
): { boardName: string; count: number }[] => {
  const counts = new Map<string, number>()
  for (const customer of customers)
    for (const { boardName } of customer.summary.consultationBoards ?? [])
      counts.set(boardName, (counts.get(boardName) ?? 0) + 1)
  return [...counts]
    .map(([boardName, count]) => ({ boardName, count }))
    .sort((a, b) => b.count - a.count || a.boardName.localeCompare(b.boardName))
}

const sortKey = (
  customer: MondayCustomerListItem,
  sort: MondaySort,
  board: string | null,
): string | number => {
  switch (sort) {
    case 'records':
      return recordCount(customer)
    case 'purchase':
      return customer.summary.latestPurchaseAt ?? ''
    case 'amount':
      return customer.summary.purchaseAmount
    case 'consultation':
      // 상담 보드를 골랐으면 그 보드의 최근 상담으로 줄 세운다.
      return board === null
        ? (customer.summary.latestConsultationAt ?? '')
        : (consultationOn(customer, board)?.latestAt ?? '')
    default:
      return customer.lastUpdatedAt ?? ''
  }
}

/** 큰 값(최근·많은 것)이 앞에 오도록 — 값이 없는 고객은 맨 뒤로 간다. */
export const sortMondayCustomers = (
  customers: MondayCustomerListItem[],
  sort: MondaySort,
  board: string | null = null,
): MondayCustomerListItem[] =>
  [...customers].sort((a, b) => {
    const keyA = sortKey(a, sort, board)
    const keyB = sortKey(b, sort, board)
    if (typeof keyA === 'number' && typeof keyB === 'number') {
      return keyB - keyA
    }
    return String(keyB).localeCompare(String(keyA))
  })

/** 상태 문구를 뱃지 색 분류로 — 보드마다 문구가 조금씩 달라 낱말로 가린다. */
export const mondayStatusTone = (
  status: string | null,
): 'success' | 'progress' | 'hold' | 'muted' => {
  if (!status) return 'muted'
  if (/결제 ?취소|미전환|오기입|노쇼|취소/.test(status)) return 'muted'
  if (/결제|완료|계약금/.test(status)) return 'success'
  if (/보류|연기|대기/.test(status)) return 'hold'
  return 'progress'
}
