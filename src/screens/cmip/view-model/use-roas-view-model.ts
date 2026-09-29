import { useState } from 'react'
import {
  groupByMonth,
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
  onlineRevenue: number
  /** offlineRevenue + onlineRevenue. */
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
  /** 온라인 매출(Cafe24)에서 이미 제외된 배송비 합계 — 순매출은 "총매출 -
   * 배송비 - 적립금"으로 정의돼있어(client/cafe24-revenue-client.ts 참고)
   * 여기 안 포함된다. installmentInterest와 같은 이유로 참고용. */
  onlineShippingFee: number
  /** 온라인 매출(Cafe24)에서 이미 제외된 적립금 사용액 합계 — 매출이 아니라
   * 할인으로 취급한다(onlineShippingFee 주석 참고). */
  onlinePointsSpent: number
  /** 온라인 매출(Cafe24)에서 이미 제외된 쿠폰 등 주문 단위 할인 합계
   * (onlineShippingFee와 같은 이유로 참고용). */
  onlineCouponDiscount: number
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

const toMetrics = (
  offlineRevenue: number,
  onlineRevenue: number,
  spend: number,
  installmentInterest = 0,
  deferredBalance = 0,
  onlineShippingFee = 0,
  onlinePointsSpent = 0,
  onlineCouponDiscount = 0,
): RoasMetrics => ({
  spend,
  offlineRevenue,
  onlineRevenue,
  totalRevenue: offlineRevenue + onlineRevenue,
  roas: calcRoas(offlineRevenue, onlineRevenue, spend),
  installmentInterest,
  deferredBalance,
  onlineShippingFee,
  onlinePointsSpent,
  onlineCouponDiscount,
})

/** "합계" — 조회 기간 전체 기준 총계(grouping과 무관하게 항상 같은 값). ROAS
 * 탭(useRoasViewModel)과 엑셀 ROAS 시트(excel-writer.ts)가 공유한다. */
export function computeRoasTotal(
  combinedInsight: CombinedInsight | null,
  offlineRevenue: OfflineRevenueSummary | null,
  onlineRevenue: Cafe24RevenueSummary | null,
): RoasMetrics {
  return toMetrics(
    offlineRevenue?.total.totalPaid ?? 0,
    onlineRevenue?.total.paymentAmount ?? 0,
    combinedInsight?.total.combined.spend ?? 0,
    offlineRevenue?.total.installmentInterest ?? 0,
    offlineRevenue?.total.deferredBalance ?? 0,
    onlineRevenue?.total.shippingFee ?? 0,
    onlineRevenue?.total.pointsSpent ?? 0,
    onlineRevenue?.total.couponDiscount ?? 0,
  )
}

/** "평균" — 합계를 지금 보이는 행 수로 나눈다. spend/offlineRevenue/
 * onlineRevenue를 먼저 나누고 roas는 그 평균값들에서 다시 계산한다(비율을
 * 그대로 평균 내지 않는다 — 어차피 total.roas와 같은 값이 나오지만, 코드
 * 상으로도 "합계 기준으로 비율을 다시 계산한다"는 원칙을 그대로 따른다). */
export function computeRoasAverage(
  total: RoasMetrics,
  rowCount: number,
): RoasMetrics {
  return rowCount > 0
    ? toMetrics(
        total.offlineRevenue / rowCount,
        total.onlineRevenue / rowCount,
        total.spend / rowCount,
        total.installmentInterest / rowCount,
        0,
        total.onlineShippingFee / rowCount,
        total.onlinePointsSpent / rowCount,
        total.onlineCouponDiscount / rowCount,
      )
    : toMetrics(0, 0, 0)
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
    const onlineByPeriod = new Map(
      (onlineRevenue?.byMonth ?? []).map((m) => [m.period, m.paymentAmount]),
    )
    const interestByPeriod = new Map(
      (offlineRevenue?.byMonth ?? []).map((m) => [
        m.period,
        m.installmentInterest,
      ]),
    )
    const shippingByPeriod = new Map(
      (onlineRevenue?.byMonth ?? []).map((m) => [m.period, m.shippingFee]),
    )
    const pointsByPeriod = new Map(
      (onlineRevenue?.byMonth ?? []).map((m) => [m.period, m.pointsSpent]),
    )
    const couponByPeriod = new Map(
      (onlineRevenue?.byMonth ?? []).map((m) => [m.period, m.couponDiscount]),
    )
    return spendByMonth.map(
      (m): RoasRow => ({
        key: m.period,
        label: m.period,
        metrics: toMetrics(
          offlineByPeriod.get(m.period) ?? 0,
          onlineByPeriod.get(m.period) ?? 0,
          m.spend,
          interestByPeriod.get(m.period) ?? 0,
          0,
          shippingByPeriod.get(m.period) ?? 0,
          pointsByPeriod.get(m.period) ?? 0,
          couponByPeriod.get(m.period) ?? 0,
        ),
      }),
    )
  }

  if (grouping === RoasGrouping.DAY_OF_WEEK) {
    const offlineByDay = new Map(
      (offlineRevenue?.byDayOfWeek ?? []).map((d) => [d.dayOfWeek, d.totalPaid]),
    )
    const onlineByDay = new Map(
      (onlineRevenue?.byDayOfWeek ?? []).map((d) => [
        d.dayOfWeek,
        d.paymentAmount,
      ]),
    )
    const interestByDay = new Map(
      (offlineRevenue?.byDayOfWeek ?? []).map((d) => [
        d.dayOfWeek,
        d.installmentInterest,
      ]),
    )
    const shippingByDay = new Map(
      (onlineRevenue?.byDayOfWeek ?? []).map((d) => [
        d.dayOfWeek,
        d.shippingFee,
      ]),
    )
    const pointsByDay = new Map(
      (onlineRevenue?.byDayOfWeek ?? []).map((d) => [
        d.dayOfWeek,
        d.pointsSpent,
      ]),
    )
    const couponByDay = new Map(
      (onlineRevenue?.byDayOfWeek ?? []).map((d) => [
        d.dayOfWeek,
        d.couponDiscount,
      ]),
    )
    return combinedInsight.series.combined.byDayOfWeek.map(
      (d): RoasRow => ({
        key: d.dayOfWeek,
        label: d.dayOfWeek,
        metrics: toMetrics(
          offlineByDay.get(d.dayOfWeek) ?? 0,
          onlineByDay.get(d.dayOfWeek) ?? 0,
          d.spend,
          interestByDay.get(d.dayOfWeek) ?? 0,
          0,
          shippingByDay.get(d.dayOfWeek) ?? 0,
          pointsByDay.get(d.dayOfWeek) ?? 0,
          couponByDay.get(d.dayOfWeek) ?? 0,
        ),
      }),
    )
  }

  if (grouping === RoasGrouping.WEEK) {
    const offlineByPeriod = new Map(
      (offlineRevenue?.byGroupedWeek ?? []).map((w) => [w.period, w.totalPaid]),
    )
    const onlineByPeriod = new Map(
      (onlineRevenue?.byGroupedWeek ?? []).map((w) => [
        w.period,
        w.paymentAmount,
      ]),
    )
    const interestByPeriod = new Map(
      (offlineRevenue?.byGroupedWeek ?? []).map((w) => [
        w.period,
        w.installmentInterest,
      ]),
    )
    const shippingByPeriod = new Map(
      (onlineRevenue?.byGroupedWeek ?? []).map((w) => [
        w.period,
        w.shippingFee,
      ]),
    )
    const pointsByPeriod = new Map(
      (onlineRevenue?.byGroupedWeek ?? []).map((w) => [
        w.period,
        w.pointsSpent,
      ]),
    )
    const couponByPeriod = new Map(
      (onlineRevenue?.byGroupedWeek ?? []).map((w) => [
        w.period,
        w.couponDiscount,
      ]),
    )
    return combinedInsight.series.combined.byGroupedWeek.map(
      (w): RoasRow => ({
        key: w.period,
        label: w.period,
        metrics: toMetrics(
          offlineByPeriod.get(w.period) ?? 0,
          onlineByPeriod.get(w.period) ?? 0,
          w.spend,
          interestByPeriod.get(w.period) ?? 0,
          0,
          shippingByPeriod.get(w.period) ?? 0,
          pointsByPeriod.get(w.period) ?? 0,
          couponByPeriod.get(w.period) ?? 0,
        ),
      }),
    )
  }

  // byDate
  const offlineByDate = new Map(
    (offlineRevenue?.byDate ?? []).map((d) => [d.date, d.totalPaid]),
  )
  const onlineByDate = new Map(
    (onlineRevenue?.byDate ?? []).map((d) => [d.date, d.paymentAmount]),
  )
  const interestByDate = new Map(
    (offlineRevenue?.byDate ?? []).map((d) => [d.date, d.installmentInterest]),
  )
  const shippingByDate = new Map(
    (onlineRevenue?.byDate ?? []).map((d) => [d.date, d.shippingFee]),
  )
  const pointsByDate = new Map(
    (onlineRevenue?.byDate ?? []).map((d) => [d.date, d.pointsSpent]),
  )
  const couponByDate = new Map(
    (onlineRevenue?.byDate ?? []).map((d) => [d.date, d.couponDiscount]),
  )
  return combinedInsight.series.combined.byDate.map(
    (d): RoasRow => ({
      key: d.date,
      label: formatMD(d.date),
      metrics: toMetrics(
        offlineByDate.get(d.date) ?? 0,
        onlineByDate.get(d.date) ?? 0,
        d.spend,
        interestByDate.get(d.date) ?? 0,
        0,
        shippingByDate.get(d.date) ?? 0,
        pointsByDate.get(d.date) ?? 0,
        couponByDate.get(d.date) ?? 0,
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
