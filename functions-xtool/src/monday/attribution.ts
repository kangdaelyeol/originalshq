import { MondayAttributionRow, MondayCustomer } from './types'

/** 유입 경로(UTM source 또는 방문체험 유입경로)를 광고 채널로 묶는다.
 *   · meta / google / naver — 광고 채널로 확인된 고객
 *   · other   — 경로는 적혀 있지만 광고가 아님(영업전환, 자연유입 등)
 *   · unknown — 경로가 비어 있음(문의 없이 산 고객 포함) */
export const attributionChannel = (
  source: string | null,
): MondayAttributionRow[1] => {
  if (!source) return 'unknown'
  const value = source.trim().toLowerCase()
  if (/facebook|instagram|^fb$|^ig$|^meta$/.test(value)) return 'meta'
  if (/google|youtube|gdn/.test(value)) return 'google'
  if (/naver/.test(value)) return 'naver'
  return 'other'
}

/**
 * 광고 기여 ROAS 재료 — 고객 1명당 한 줄(순수 함수). cmip ROAS 탭이 광고비와
 * 맞춰 "광고로 확인된 신규 고객 매출"(ROAS 하한)과 고객 유입 월 코호트
 * ROAS를 계산한다. 오기입 고객과 처음 나타난 날을 모르는 고객은 뺀다.
 */
export const buildAttributionRows = (
  customers: MondayCustomer[],
): MondayAttributionRow[] =>
  customers.flatMap((customer): MondayAttributionRow[] => {
    const { firstContactAt, source, misentry } = customer.summary.funnel
    if (misentry || !firstContactAt) return []
    const byDate = new Map<string, number>()
    for (const purchase of customer.purchases) {
      if (purchase.cancelled || !purchase.paidAt) continue
      byDate.set(
        purchase.paidAt,
        (byDate.get(purchase.paidAt) ?? 0) + purchase.amount,
      )
    }
    const purchases = [...byDate.entries()].sort((a, b) =>
      a[0].localeCompare(b[0]),
    )
    return [
      [firstContactAt, attributionChannel(source), source ?? '', purchases],
    ]
  })
