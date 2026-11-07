import { describe, expect, it } from 'vitest'
import type { AttributionRow } from './attribution-client'
import { buildLeadCohorts } from './lead-cohort'

const lead = (date: string, purchases: [string, number][] = [], visit = '', channel: 'meta' | 'google' = 'meta') =>
  [date, channel, 'facebook', purchases, date, '소재', visit, purchases[0]?.[0] ?? '', ''] as AttributionRow

const rows: AttributionRow[] = [
  lead('2026-09-10', [['2026-09-20', 1]]),
  lead('2026-09-25', [['2026-11-05', 1]]),
  lead('2026-10-15', [], '2026-10-16'),
  lead('2026-11-02'),
  lead('2026-10-01', [['2026-10-02', 1]], '', 'google'),
  lead('2026-08-31', [['2026-09-01', 1]]),
]

describe('buildLeadCohorts — 유입월 결제 전환', () => {
  const cohorts = buildLeadCohorts(rows, 'meta', '2026-11-08', 3, 'all', '2026-11-08')

  it('끝 날짜의 달까지 최근 N개월, 최근 달이 위 — 다른 채널·범위 밖 달은 뺀다', () => {
    expect(cohorts.map((cohort) => [cohort.month, cohort.leads])).toEqual([
      ['2026-11', 1],
      ['2026-10', 1],
      ['2026-09', 2],
    ])
    expect(cohorts[1].visitBooked).toBe(1)
  })

  it('리드일부터 30·60·90일 안의 첫 구매', () => {
    const september = cohorts[2]
    expect(september.cells[30].converted).toBe(1)
    expect(september.cells[60].converted).toBe(2)
    expect(september.cells[30].rate).toBe(50)
  })

  it('기간이 얼마나 찼는지 — 마지막 리드까지 찼으면 확정, 첫 리드도 안 찼으면 집계 전', () => {
    const status = (index: number) => [30, 60, 90].map((window) => cohorts[index].cells[window as 30].status)
    expect(status(2)).toEqual(['complete', 'partial', 'pending'])
    expect(status(1)).toEqual(['partial', 'pending', 'pending'])
    expect(status(0)).toEqual(['pending', 'pending', 'pending'])
  })
})
