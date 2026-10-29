import type { MondayCustomerListItem } from '../entity'

/** 고객 탭 아래 요약 카드의 한 줄. */
export interface MondayHighlightRow {
  phone: string
  name: string
  /** 오른쪽 큰 값(금액·일수·횟수). */
  value: string
  /** 이름 아래 작은 설명. */
  note: string
  /** 막대 길이를 정하는 수(금액·횟수) — 카드 안 1위 대비. 막대가 없는 카드
   * (가장 빨리 산 고객 — 짧을수록 좋아 막대가 뜻이 없다)는 null. */
  amount: number | null
}

export interface MondayHighlights {
  topBuyers: MondayHighlightRow[]
  topBalances: MondayHighlightRow[]
  fastestBuyers: MondayHighlightRow[]
  pondering: MondayHighlightRow[]
}

const LIMIT = 5

const won = (amount: number) => `${amount.toLocaleString('ko-KR')}원`
const nameOf = (customer: MondayCustomerListItem) =>
  customer.names[0] ?? '이름 없음'
const assigneeOf = (customer: MondayCustomerListItem) =>
  customer.summary.assignees[0] ?? '담당자 없음'
const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000)

// 구매가 없어도 "고민 중"으로 보지 않는 상태 — 이미 끝난 상담.
const CLOSED_STATUSES = new Set(['미전환', '오기입'])

/**
 * Monday 고객 탭 아래의 요약 카드 네 개(순수 함수). 고객 전체(검색·분류와
 * 무관) 기준이고, 오기입 고객은 뺀다.
 *
 *   · 이번 달 구매왕 — 이번 달 결제일 기준 구매 금액 합계 순.
 *   · 잔금 TOP — 남은 잔금이 큰 순.
 *   · 가장 빨리 산 고객 — 이번 달 첫 구매 고객 중 첫 문의부터 첫 구매까지
 *     걸린 일수가 짧은 순(같으면 최근 구매가 위). 문의 없이 산 고객은 뺀다.
 *   · 오래 고민 중인 고객 — 구매 없이 상담이 2번 이상이고 아직 끝나지 않은
 *     (미전환·오기입이 아닌) 고객을 상담 횟수 순(같으면 첫 문의가 오래된 순).
 */
export function buildMondayHighlights(
  customers: readonly MondayCustomerListItem[],
  today: string,
): MondayHighlights {
  const month = today.slice(0, 7)
  const valid = customers.filter(
    (customer) => !customer.summary.funnel.misentry,
  )

  const topBuyers = valid
    .map((customer) => ({
      customer,
      amount: customer.summary.purchaseAmountByMonth?.[month] ?? 0,
    }))
    .filter(({ amount }) => amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, LIMIT)
    .map(({ customer, amount }) => ({
      phone: customer.phone,
      name: nameOf(customer),
      value: won(amount),
      note: assigneeOf(customer),
      amount,
    }))

  const topBalances = valid
    .filter((customer) => customer.summary.balanceAmount > 0)
    .sort((a, b) => b.summary.balanceAmount - a.summary.balanceAmount)
    .slice(0, LIMIT)
    .map((customer) => ({
      phone: customer.phone,
      name: nameOf(customer),
      value: won(customer.summary.balanceAmount),
      amount: customer.summary.balanceAmount,
      note: `최근 구매 ${customer.summary.latestPurchaseAt?.slice(0, 10) ?? '-'} · ${assigneeOf(customer)}`,
    }))

  const fastestBuyers = valid
    .flatMap((customer) => {
      const { firstInquiryAt, firstPurchaseAt } = customer.summary.funnel
      if (!firstInquiryAt || !firstPurchaseAt) return []
      if (!firstPurchaseAt.startsWith(month)) return []
      if (firstPurchaseAt < firstInquiryAt) return []
      return [
        {
          customer,
          days: daysBetween(firstInquiryAt, firstPurchaseAt),
          firstPurchaseAt,
        },
      ]
    })
    .sort(
      (a, b) =>
        a.days - b.days || b.firstPurchaseAt.localeCompare(a.firstPurchaseAt),
    )
    .slice(0, LIMIT)
    .map(({ customer, days, firstPurchaseAt }) => ({
      phone: customer.phone,
      name: nameOf(customer),
      value: days === 0 ? '당일' : `${days}일`,
      amount: null,
      note: `${customer.summary.funnel.firstInquiryAt} → ${firstPurchaseAt}`,
    }))

  const pondering = valid
    .filter(
      ({ summary }) =>
        summary.purchaseCount === 0 &&
        summary.consultationCount >= 2 &&
        !CLOSED_STATUSES.has(summary.latestConsultationStatus ?? ''),
    )
    .map((customer) => ({
      customer,
      waited: customer.summary.funnel.firstInquiryAt
        ? daysBetween(customer.summary.funnel.firstInquiryAt, today)
        : 0,
    }))
    .sort(
      (a, b) =>
        b.customer.summary.consultationCount -
          a.customer.summary.consultationCount || b.waited - a.waited,
    )
    .slice(0, LIMIT)
    .map(({ customer, waited }) => ({
      phone: customer.phone,
      name: nameOf(customer),
      value: `상담 ${customer.summary.consultationCount}회`,
      amount: customer.summary.consultationCount,
      note: `첫 문의 후 ${waited}일 · ${customer.summary.latestConsultationStatus ?? '상태 없음'}`,
    }))

  return { topBuyers, topBalances, fastestBuyers, pondering }
}

/** 고객 탭 맨 위 숫자 타일 — 고객 전체(검색·분류와 무관, 오기입 제외) 기준. */
export interface MondayOverview {
  customers: number
  buyers: number
  /** 이번 달 결제일 기준 구매 금액 합계와 그 고객 수. */
  monthAmount: number
  monthBuyers: number
  balanceAmount: number
  balanceCustomers: number
}

export function buildMondayOverview(
  customers: readonly MondayCustomerListItem[],
  today: string,
): MondayOverview {
  const month = today.slice(0, 7)
  const valid = customers.filter(
    (customer) => !customer.summary.funnel.misentry,
  )
  const overview: MondayOverview = {
    customers: valid.length,
    buyers: 0,
    monthAmount: 0,
    monthBuyers: 0,
    balanceAmount: 0,
    balanceCustomers: 0,
  }
  for (const { summary } of valid) {
    if (summary.purchaseCount > 0) overview.buyers += 1
    const monthAmount = summary.purchaseAmountByMonth?.[month] ?? 0
    if (monthAmount > 0) {
      overview.monthAmount += monthAmount
      overview.monthBuyers += 1
    }
    if (summary.balanceAmount > 0) {
      overview.balanceAmount += summary.balanceAmount
      overview.balanceCustomers += 1
    }
  }
  return overview
}
