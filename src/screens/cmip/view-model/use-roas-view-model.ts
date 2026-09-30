import { useState } from 'react'
import {
  groupByMonth,
  type Cafe24RevenueMetrics,
  type Cafe24RevenueSummary,
  type CombinedInsight,
  type OfflineRevenueSummary,
} from '../client'
import { formatMD } from '../utils'

export const RoasGrouping = {
  DATE: 'byDate',
  DAY_OF_WEEK: 'byDayOfWeek',
  WEEK: 'byGroupedWeek',
  MONTH: 'byMonth',
} as const

export type RoasGrouping = (typeof RoasGrouping)[keyof typeof RoasGrouping]

export interface RoasMetrics {
  spend: number
  offlineRevenue: number
  /** ROAS 계산용 온라인 매출 — onlineRevenueCafe24(카페24 화면과 맞춘 순매출,
   * 배송비 포함)에서 배송비(onlineShippingFee)와 순 적립금 사용액
   * (onlinePointsSpent - onlinePointsRefunded)을 뺀다. 배송비는 택배사로
   * 나가는 실비 통과항목, 적립금 결제는 광고 성과로 새로 들어온 돈이 아니라
   * 이미 쌓여있던 포인트를 쓴 것뿐이라 광고비 대비 성과(ROAS)를 볼 때는 둘 다
   * 매출에서 빼는 게 맞다는 판단 — cafe24MetricsSummary.paymentAmount가 카페24
   * 화면 기준(배송비 포함)으로 바뀌면서(9/30 5/24 매출 대조 조사) ROAS용
   * 매출까지 따라 올라가지 않도록 여기서 배송비를 다시 빼게 됐다("모든 사람이
   * 봐야 하는" 카페24 온라인 매출 표와는 별도로, ROAS는 항상 배송비 제외
   * 기준을 유지해야 한다는 요구사항). totalRevenue/roas 계산에 이 값을 쓴다. */
  onlineRevenue: number
  /** 카페24 매출액 — 관리자 화면 "일별 매출내역"과 원 단위까지 맞춘 순매출
   * (= onlineGrossPayment - onlineRefundAmount, 배송비·적립금 포함). ROAS
   * 계산에는 안 쓰고(대신 배송비를 뺀 onlineRevenue를 쓴다) 참고용으로만
   * 보여준다(onlineRevenue 주석 참고). */
  onlineRevenueCafe24: number
  /** offlineRevenue + onlineRevenue(ROAS용). */
  totalRevenue: number
  /** 광고비 대비 (오프라인+온라인) 매출 — 퍼센트(예: 250은 250%, 광고비의
   * 2.5배). 광고비가 0이면 나눌 수 없어 0으로 둔다. */
  roas: number
  /** 오프라인 매출(Monday CRM)에서 이미 제외된 장기 할부 이자(12/24/36개월)
   * 합계 — 고객이 할부로 결제해 카드사에 내는 이자라 매출이 아니다.
   * offlineRevenue/roas 계산엔 영향 없고, 참고용으로만 같이 보여준다. */
  installmentInterest: number
  /** 미수금 — 오프라인 매출(Monday CRM)에서 이미 제외된 "계약금/분할납부"
   * 잔금(총 계약금액 중 아직 안 걷고 나중에 분할로 받을 금액) 합계. 음수
   * 값 그대로라 보통 0 이하다. 계약 체결 시점 한 번만 의미 있는 값이라
   * roas-panel.tsx는 "ROAS 요약"(total)에만 표시하고 기간별 표/평균에는
   * 안 쓴다 — computeRoasRows/computeRoasAverage는 항상 0으로 둔다. */
  deferredBalance: number
  /** 온라인 매출(Cafe24)에서 그 기간에 "결제"로 귀속된 금액 합계(총 결제액,
   * 배송비·적립금 포함, 환불 차감 전) — Cafe24RevenueMetrics.grossPayment
   * 그대로. */
  onlineGrossPayment: number
  /** 온라인 매출(Cafe24)에서 그 기간에 "환불"로 귀속된 금액 합계(환불액,
   * 적립금/예치금 환불분 포함) — Cafe24RevenueMetrics.refundAmount 그대로. */
  onlineRefundAmount: number
  /** 온라인 매출(Cafe24)에 포함된 배송비 합계 — 참고용. */
  onlineShippingFee: number
  /** 온라인 매출(Cafe24)에 포함된 적립금 사용액 합계(결제일 기준, 환불 전) —
   * 참고용. */
  onlinePointsSpent: number
  /** 온라인 매출(Cafe24)의 환불에 포함된 적립금 환불액 합계(환불완료일
   * 기준) — 참고용. 순 적립금 사용액 = onlinePointsSpent - onlinePointsRefunded. */
  onlinePointsRefunded: number
  /** 온라인 매출(Cafe24)에서 이미 제외된 쿠폰 등 주문 단위 할인 합계 —
   * 참고용. */
  onlineCouponDiscount: number
  /** 온라인 매출(Cafe24)에서 이미 제외된 "상품 할인"(쿠폰과 별도, 구조화된
   * 필드에 안 잡히는 할인) 합계 — 참고용. */
  onlineItemDiscount: number
}

export interface RoasRow {
  key: string
  label: string
  metrics: RoasMetrics
}

const calcRoas = (
  offlineRevenue: number,
  onlineRevenue: number,
  spend: number,
): number => (spend > 0 ? ((offlineRevenue + onlineRevenue) / spend) * 100 : 0)

/** toMetrics 입력 — offlineRevenue/onlineRevenueCafe24/spend만 필수고 나머지는
 * 전부 참고용 항목이라 기본값 0을 둔다. 필드가 계속 늘어나서(할부이자,
 * 미수금, 배송비, 적립금×2, 쿠폰할인, 상품할인, 총결제액, 환불액...) 위치로
 * 구분하는 positional 인자 대신 객체로 받는다 — 순서를 헷갈려 엉뚱한 값이
 * 들어가는 실수를 막기 위해서다. */
interface ToMetricsInput {
  offlineRevenue: number
  /** 카페24 화면 기준 순매출(= grossPayment - refundAmount, 배송비·적립금
   * 포함) — 여기서 배송비와 순 적립금을 뺀 값이 RoasMetrics.onlineRevenue
   * (ROAS용)가 된다. */
  onlineRevenueCafe24: number
  spend: number
  installmentInterest?: number
  deferredBalance?: number
  onlineGrossPayment?: number
  onlineRefundAmount?: number
  onlineShippingFee?: number
  onlinePointsSpent?: number
  onlinePointsRefunded?: number
  onlineCouponDiscount?: number
  onlineItemDiscount?: number
}

const toMetrics = (input: ToMetricsInput): RoasMetrics => {
  const {
    offlineRevenue,
    onlineRevenueCafe24,
    spend,
    installmentInterest = 0,
    deferredBalance = 0,
    onlineGrossPayment = 0,
    onlineRefundAmount = 0,
    onlineShippingFee = 0,
    onlinePointsSpent = 0,
    onlinePointsRefunded = 0,
    onlineCouponDiscount = 0,
    onlineItemDiscount = 0,
  } = input
  const netPointsSpent = onlinePointsSpent - onlinePointsRefunded
  const onlineRevenue = onlineRevenueCafe24 - onlineShippingFee - netPointsSpent
  return {
    spend,
    offlineRevenue,
    onlineRevenue,
    onlineRevenueCafe24,
    totalRevenue: offlineRevenue + onlineRevenue,
    roas: calcRoas(offlineRevenue, onlineRevenue, spend),
    installmentInterest,
    deferredBalance,
    onlineGrossPayment,
    onlineRefundAmount,
    onlineShippingFee,
    onlinePointsSpent,
    onlinePointsRefunded,
    onlineCouponDiscount,
    onlineItemDiscount,
  }
}

/** "합계" — 조회 기간 전체 기준 총계(grouping과 무관하게 항상 같은 값). ROAS
 * 탭(useRoasViewModel)과 엑셀 ROAS 시트(excel-writer.ts)가 공유한다. */
export function computeRoasTotal(
  combinedInsight: CombinedInsight | null,
  offlineRevenue: OfflineRevenueSummary | null,
  onlineRevenue: Cafe24RevenueSummary | null,
): RoasMetrics {
  return toMetrics({
    offlineRevenue: offlineRevenue?.total.totalPaid ?? 0,
    onlineRevenueCafe24: onlineRevenue?.total.paymentAmount ?? 0,
    spend: combinedInsight?.total.combined.spend ?? 0,
    installmentInterest: offlineRevenue?.total.installmentInterest ?? 0,
    deferredBalance: offlineRevenue?.total.deferredBalance ?? 0,
    onlineGrossPayment: onlineRevenue?.total.grossPayment ?? 0,
    onlineRefundAmount: onlineRevenue?.total.refundAmount ?? 0,
    onlineShippingFee: onlineRevenue?.total.shippingFee ?? 0,
    onlinePointsSpent: onlineRevenue?.total.pointsSpent ?? 0,
    onlinePointsRefunded: onlineRevenue?.total.pointsRefunded ?? 0,
    onlineCouponDiscount: onlineRevenue?.total.couponDiscount ?? 0,
    onlineItemDiscount: onlineRevenue?.total.itemDiscount ?? 0,
  })
}

/** "평균" — 합계를 지금 보이는 행 수로 나눈다. spend/offlineRevenue/
 * onlineRevenueCafe24를 먼저 나누고 roas는 그 평균값들에서 다시 계산한다
 * (비율을 그대로 평균 내지 않는다 — 어차피 total.roas와 같은 값이 나오지만,
 * 코드 상으로도 "합계 기준으로 비율을 다시 계산한다"는 원칙을 그대로
 * 따른다). */
export function computeRoasAverage(
  total: RoasMetrics,
  rowCount: number,
): RoasMetrics {
  if (rowCount <= 0) {
    return toMetrics({ offlineRevenue: 0, onlineRevenueCafe24: 0, spend: 0 })
  }
  return toMetrics({
    offlineRevenue: total.offlineRevenue / rowCount,
    onlineRevenueCafe24: total.onlineRevenueCafe24 / rowCount,
    spend: total.spend / rowCount,
    installmentInterest: total.installmentInterest / rowCount,
    onlineGrossPayment: total.onlineGrossPayment / rowCount,
    onlineRefundAmount: total.onlineRefundAmount / rowCount,
    onlineShippingFee: total.onlineShippingFee / rowCount,
    onlinePointsSpent: total.onlinePointsSpent / rowCount,
    onlinePointsRefunded: total.onlinePointsRefunded / rowCount,
    onlineCouponDiscount: total.onlineCouponDiscount / rowCount,
    onlineItemDiscount: total.onlineItemDiscount / rowCount,
  })
}

/** onlineRevenue(Cafe24RevenueSummary)의 한 grouping 배열(byMonth/byDayOfWeek/
 * byGroupedWeek/byDate)에서 ToMetricsInput의 online* 필드들을 뽑아 기간 키로
 * 조회할 수 있는 Map 묶음을 만든다 — computeRoasRows의 4개 분기가 반복하던
 * "필드마다 Map 하나씩"을 한 번에 만들어 공유한다. T를
 * Cafe24RevenueMetrics(모든 그룹핑 요약이 공통으로 extends하는 타입)로
 * 제약해서 필드 접근에 타입 캐스트가 필요 없게 한다. */
const ONLINE_METRICS_FIELDS = [
  'paymentAmount',
  'grossPayment',
  'refundAmount',
  'shippingFee',
  'pointsSpent',
  'pointsRefunded',
  'couponDiscount',
  'itemDiscount',
] as const

function buildOnlineMaps<T extends Cafe24RevenueMetrics>(
  rows: readonly T[],
  keyOf: (row: T) => string,
): Record<(typeof ONLINE_METRICS_FIELDS)[number], Map<string, number>> {
  const maps = {} as Record<
    (typeof ONLINE_METRICS_FIELDS)[number],
    Map<string, number>
  >
  for (const field of ONLINE_METRICS_FIELDS) {
    maps[field] = new Map(rows.map((row) => [keyOf(row), row[field]]))
  }
  return maps
}

function toMetricsFromOnlineMaps(
  offlineRevenue: number,
  spend: number,
  installmentInterest: number,
  key: string,
  online: ReturnType<typeof buildOnlineMaps>,
): RoasMetrics {
  return toMetrics({
    offlineRevenue,
    onlineRevenueCafe24: online.paymentAmount.get(key) ?? 0,
    spend,
    installmentInterest,
    onlineGrossPayment: online.grossPayment.get(key) ?? 0,
    onlineRefundAmount: online.refundAmount.get(key) ?? 0,
    onlineShippingFee: online.shippingFee.get(key) ?? 0,
    onlinePointsSpent: online.pointsSpent.get(key) ?? 0,
    onlinePointsRefunded: online.pointsRefunded.get(key) ?? 0,
    onlineCouponDiscount: online.couponDiscount.get(key) ?? 0,
    onlineItemDiscount: online.itemDiscount.get(key) ?? 0,
  })
}

/**
 * combinedInsight(광고비, Meta+Google+Naver 이미 합산됨), offlineRevenue
 * (Monday CRM 오프라인 매출)와 onlineRevenue(Cafe24 온라인 매출, 둘 다 별도
 * 조회)를 날짜/요일/주차/월 키로 짝지어 grouping 하나에 대한 ROAS 행을
 * 계산한다. ROAS 탭(useRoasViewModel)과 엑셀 ROAS 시트(excel-writer.ts —
 * 화면과 달리 4개 grouping을 전부 시트에 쌓는다)가 공유한다.
 *
 * 키(날짜/요일/주차)는 항상 combinedInsight.series.combined 쪽(seriesFromByDate가
 * 조회 범위 전체를 0으로 채워 만든 완전한 시리즈)을 기준으로 순회하고,
 * 오프라인/온라인 매출은 그 키로 Map 조회해 없으면 0으로 둔다 — 광고 집행이
 * 없던 날에도 매출이 있을 수 있고, 반대로 매출이 0인 날도 표에서 빠지면 안
 * 되기 때문에 어느 한쪽 매출 배열을 기준으로 순회하지 않는다(월별 집계는
 * combinedInsight.series에 자체 필드가 없어 원래도 groupByMonth로 광고비 쪽을
 * 직접 파생시켜 기준으로 썼다 — 나머지 grouping도 그와 같은 방식으로 통일한다).
 */
export function computeRoasRows(
  grouping: RoasGrouping,
  combinedInsight: CombinedInsight | null,
  offlineRevenue: OfflineRevenueSummary | null,
  onlineRevenue: Cafe24RevenueSummary | null,
): RoasRow[] {
  if (!combinedInsight) return []

  if (grouping === RoasGrouping.MONTH) {
    const spendByMonth = groupByMonth(combinedInsight.series.combined.byDate)
    const offlineByPeriod = new Map(
      (offlineRevenue?.byMonth ?? []).map((m) => [m.period, m.totalPaid]),
    )
    const interestByPeriod = new Map(
      (offlineRevenue?.byMonth ?? []).map((m) => [
        m.period,
        m.installmentInterest,
      ]),
    )
    const online = buildOnlineMaps(onlineRevenue?.byMonth ?? [], (m) => m.period)
    return spendByMonth.map(
      (m): RoasRow => ({
        key: m.period,
        label: m.period,
        metrics: toMetricsFromOnlineMaps(
          offlineByPeriod.get(m.period) ?? 0,
          m.spend,
          interestByPeriod.get(m.period) ?? 0,
          m.period,
          online,
        ),
      }),
    )
  }

  if (grouping === RoasGrouping.DAY_OF_WEEK) {
    const offlineByDay = new Map(
      (offlineRevenue?.byDayOfWeek ?? []).map((d) => [d.dayOfWeek, d.totalPaid]),
    )
    const interestByDay = new Map(
      (offlineRevenue?.byDayOfWeek ?? []).map((d) => [
        d.dayOfWeek,
        d.installmentInterest,
      ]),
    )
    const online = buildOnlineMaps(
      onlineRevenue?.byDayOfWeek ?? [],
      (d) => d.dayOfWeek,
    )
    return combinedInsight.series.combined.byDayOfWeek.map(
      (d): RoasRow => ({
        key: d.dayOfWeek,
        label: d.dayOfWeek,
        metrics: toMetricsFromOnlineMaps(
          offlineByDay.get(d.dayOfWeek) ?? 0,
          d.spend,
          interestByDay.get(d.dayOfWeek) ?? 0,
          d.dayOfWeek,
          online,
        ),
      }),
    )
  }

  if (grouping === RoasGrouping.WEEK) {
    const offlineByPeriod = new Map(
      (offlineRevenue?.byGroupedWeek ?? []).map((w) => [w.period, w.totalPaid]),
    )
    const interestByPeriod = new Map(
      (offlineRevenue?.byGroupedWeek ?? []).map((w) => [
        w.period,
        w.installmentInterest,
      ]),
    )
    const online = buildOnlineMaps(
      onlineRevenue?.byGroupedWeek ?? [],
      (w) => w.period,
    )
    return combinedInsight.series.combined.byGroupedWeek.map(
      (w): RoasRow => ({
        key: w.period,
        label: w.period,
        metrics: toMetricsFromOnlineMaps(
          offlineByPeriod.get(w.period) ?? 0,
          w.spend,
          interestByPeriod.get(w.period) ?? 0,
          w.period,
          online,
        ),
      }),
    )
  }

  // byDate
  const offlineByDate = new Map(
    (offlineRevenue?.byDate ?? []).map((d) => [d.date, d.totalPaid]),
  )
  const interestByDate = new Map(
    (offlineRevenue?.byDate ?? []).map((d) => [d.date, d.installmentInterest]),
  )
  const online = buildOnlineMaps(onlineRevenue?.byDate ?? [], (d) => d.date)
  return combinedInsight.series.combined.byDate.map(
    (d): RoasRow => ({
      key: d.date,
      label: formatMD(d.date),
      metrics: toMetricsFromOnlineMaps(
        offlineByDate.get(d.date) ?? 0,
        d.spend,
        interestByDate.get(d.date) ?? 0,
        d.date,
        online,
      ),
    }),
  )
}

/**
 * ROAS(광고비 대비 오프라인+온라인 매출) 탭 — 세 데이터 모두 이미
 * useChannelInsightViewModel이 같은 dateStart/dateEnd로 조회해 갖고 있어
 * (period-test 탭처럼) 이 훅 자체는 새 네트워크 호출을 하지 않고 computeRoasTotal/
 * computeRoasRows/computeRoasAverage(위)를 grouping state와 엮어 순수 파생만
 * 한다. 이 세 함수는 엑셀 ROAS 시트(excel-writer.ts)도 그대로 가져다 쓴다 —
 * 화면과 엑셀이 서로 다른 계산 결과를 보여주지 않도록 로직을 한 곳에 둔다.
 */
export const useRoasViewModel = (
  combinedInsight: CombinedInsight | null,
  offlineRevenue: OfflineRevenueSummary | null,
  onlineRevenue: Cafe24RevenueSummary | null,
) => {
  const [grouping, setGrouping] = useState<RoasGrouping>(RoasGrouping.DATE)

  const total = computeRoasTotal(combinedInsight, offlineRevenue, onlineRevenue)
  const rows = computeRoasRows(
    grouping,
    combinedInsight,
    offlineRevenue,
    onlineRevenue,
  )
  const average = computeRoasAverage(total, rows.length)

  return { grouping, setGrouping, total, average, rows }
}
