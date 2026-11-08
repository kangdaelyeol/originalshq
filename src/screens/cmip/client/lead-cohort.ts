/**
 * 유입월 결제 전환(광고 성과표 — 공통 정의 D1·D3·D4) — 고른 채널의 유효 리드를 리드일(UTM 상담 접수일)의
 * 달로 묶고, 리드일부터 30·60·90일 안에 (구매 범위의) 첫 구매를 한 비율을 낸다. 결제는 문의 뒤 몇 주
 * 지나 일어나서(중앙값 22일), 같은 달에 들어온 리드끼리 기간이 다 찬 값을 견준다. 달은 조회 기간과
 * 상관없이 달 전체를 센다.
 */
import type { ISODate } from '../types'
import { addDays, addMonths, startOfMonth, todayISO } from '../utils'
import {
  AD_ATTRIBUTION_DAYS,
  convertedWithin,
  leadDateOf,
  visitBookedWithin,
  type AttributionChannel,
  type AttributionRow,
  type PurchaseScope,
} from './attribution-client'

export const LEAD_COHORT_WINDOWS = [30, 60, 90] as const
export type LeadCohortWindow = (typeof LEAD_COHORT_WINDOWS)[number]

export interface LeadCohortCell {
  /** 기간 안에 첫 구매를 한 유효 리드 수. */
  converted: number
  /** converted ÷ 그 달 유효 리드(퍼센트) — 리드가 없으면 NaN. */
  rate: number
  /** 기간이 얼마나 지났는지.
   *   · complete — 그 달 마지막 리드까지 기간이 다 찼다(값 확정).
   *   · partial  — 일부 리드만 찼다(값이 아직 오른다).
   *   · pending  — 그 달 첫 리드도 아직 안 찼다. */
  status: 'complete' | 'partial' | 'pending'
}

export interface LeadCohortRow {
  /** YYYY-MM */
  month: string
  leads: number
  /** 리드일부터 90일 안에 방문체험을 예약한 유효 리드 수. */
  visitBooked: number
  cells: Record<LeadCohortWindow, LeadCohortCell>
}

/**
 * @param endDate 이 날짜의 달이 마지막 달 — 그 앞으로 months개월.
 * @returns 최근 달이 위.
 */
export function buildLeadCohorts(
  rows: readonly AttributionRow[],
  channels: ReadonlySet<AttributionChannel>,
  endDate: ISODate,
  months: number,
  scope: PurchaseScope,
  today: ISODate = todayISO(),
): LeadCohortRow[] {
  const lastMonth = startOfMonth(endDate)
  const cohorts = new Map<string, LeadCohortRow>()
  for (let index = months - 1; index >= 0; index -= 1) {
    const month = addMonths(lastMonth, -index).slice(0, 7)
    const blank = (): LeadCohortCell => ({ converted: 0, rate: NaN, status: 'pending' })
    cohorts.set(month, { month, leads: 0, visitBooked: 0, cells: { 30: blank(), 60: blank(), 90: blank() } })
  }

  for (const row of rows) {
    if (!channels.has(row[1])) continue
    const cohort = cohorts.get(leadDateOf(row).slice(0, 7))
    if (!cohort) continue
    cohort.leads += 1
    if (visitBookedWithin(row, AD_ATTRIBUTION_DAYS)) cohort.visitBooked += 1
    for (const window of LEAD_COHORT_WINDOWS) {
      if (convertedWithin(row, scope, window)) cohort.cells[window].converted += 1
    }
  }

  return [...cohorts.values()].reverse().map((cohort) => {
    const first = `${cohort.month}-01`
    // 그 달의 마지막 리드일 — 진행 중인 달은 오늘까지.
    const lastDay = addDays(addMonths(first, 1), -1)
    const last = lastDay < today ? lastDay : today
    for (const window of LEAD_COHORT_WINDOWS) {
      const cell = cohort.cells[window]
      cell.rate = cohort.leads > 0 ? (cell.converted / cohort.leads) * 100 : NaN
      // 리드일 d의 기간은 [d, d + window - 1] — 오늘 전에 끝났으면 다 찼다.
      cell.status =
        addDays(last, window - 1) < today ? 'complete' : addDays(first, window - 1) < today ? 'partial' : 'pending'
    }
    return cohort
  })
}
