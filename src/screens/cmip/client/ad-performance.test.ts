import { describe, expect, it } from 'vitest'
import { buildAdPerformance } from './ad-performance'
import { convertedWithin, visitBookedWithin, type AttributionRow } from './attribution-client'
import type { LeadQualityRow } from './lead-quality-client'
import type { MetaAdInsights } from './meta-ads-client'

const ads: MetaAdInsights = {
  ads: [
    { id: 'a1', name: '소재 A', adsetId: 's1', adsetName: '광고셋 1', campaignId: 'c1', campaignName: '캠페인 1' },
    { id: 'a2', name: '소재 A', adsetId: 's2', adsetName: '광고셋 2', campaignId: 'c1', campaignName: '캠페인 1' },
    { id: 'a3', name: '소재 B', adsetId: 's3', adsetName: '광고셋 3', campaignId: 'c2', campaignName: '캠페인 2' },
  ],
  // 11/3에 같은 이름의 두 광고가 3:1로 썼다.
  daily: [
    [0, '2026-11-03', 30_000, 1000, 10],
    [1, '2026-11-03', 10_000, 500, 5],
    [2, '2026-11-04', 50_000, 2000, 20],
  ],
}

// [처음 나타난 날, 채널, source, 구매, 리드일, utm_campaign, 방문체험 예약일, 첫 오프라인, 첫 온라인]
const rows: AttributionRow[] = [
  [
    '2026-11-03',
    'meta',
    'facebook',
    [['2026-11-20', 1_000_000]],
    '2026-11-03',
    '소재 A',
    '2026-11-05',
    '2026-11-20',
    '',
  ],
  ['2026-11-04', 'meta', 'facebook', [], '2026-11-04', '소재 B', '', '', ''],
  // 리드 전에 이미 산 고객 — 결제 전환이 아니다.
  ['2026-10-01', 'meta', 'facebook', [['2026-10-01', 500]], '2026-11-04', '소재 B', '', '2026-10-01', ''],
  // 기간 전 리드의 기간 안 구매 — 귀속 매출엔 들어가고 리드 쪽 숫자엔 안 들어간다.
  ['2026-10-20', 'meta', 'facebook', [['2026-11-05', 300_000]], '2026-10-20', '소재 B', '', '2026-11-05', ''],
  ['2026-11-05', 'meta', 'facebook', [], '2026-11-05', '없는 소재', '', '', ''],
  ['2026-11-05', 'google', 'google', [], '2026-11-05', '소재 B', '', '', ''],
]

const quality: LeadQualityRow[] = [
  ['2026-11-03', 'meta', '소재 A', 10, 8, 4],
  ['2026-11-04', 'meta', '소재 B', 5, 5, 1],
  ['2026-11-04', 'meta', ' 없는 소재 ', 2, 2, 2],
  ['2026-10-30', 'meta', '소재 B', 3, 3, 3],
  ['2026-11-04', 'naver', '소재 B', 9, 9, 9],
]

const build = (scope: 'all' | 'offline' | 'online' = 'all') =>
  buildAdPerformance(rows, ads, '2026-11-02', '2026-11-08', quality, scope)

describe('buildAdPerformance — 광고 성과표', () => {
  it('유효 리드·방문체험 예약·결제 전환은 기간에 들어온 리드만, 같은 이름의 광고는 상담일 광고비로 나눈다', () => {
    const [c2, c1] = [...build().campaigns].sort((a, b) => a.id.localeCompare(b.id)).reverse()
    expect(c1.id).toBe('c1')
    expect(c1.leads).toBeCloseTo(1)
    expect(c1.visitBooked).toBeCloseTo(1)
    expect(c1.converted).toBeCloseTo(1)
    const [s1, s2] = [...c1.children].sort((a, b) => a.id.localeCompare(b.id))
    expect(s1.leads).toBeCloseTo(0.75)
    expect(s2.leads).toBeCloseTo(0.25)

    expect(c2.leads).toBe(2)
    expect(c2.visitBooked).toBe(0)
    expect(c2.converted).toBe(0)
    expect(c2.buyers).toBe(1)
    expect(c2.revenue).toBe(300_000)
  })

  it('오기입률 재료는 상담 단위로 같은 방법으로 나누고, 기간 밖·다른 매체는 뺀다', () => {
    const { campaigns, total } = build()
    const c1 = campaigns.find((campaign) => campaign.id === 'c1')!
    expect([c1.consultations, c1.decided, c1.misentry]).toEqual([10, 8, 4])
    const a1 = c1.children.flatMap((adset) => adset.children).find((ad) => ad.id === 'a1')!
    expect([a1.consultations, a1.decided, a1.misentry]).toEqual([7.5, 6, 3])
    expect([total.consultations, total.decided, total.misentry]).toEqual([15, 13, 5])
    expect(total.leads).toBeCloseTo(3)
  })

  it('광고를 못 찾은 utm_campaign은 공백·대소문자를 무시하고 한 줄로', () => {
    const { unmatched, unmatchedTotal } = build()
    expect(unmatched).toHaveLength(1)
    expect(unmatched[0]).toMatchObject({
      utmCampaign: '없는 소재',
      leads: 1,
      consultations: 2,
      decided: 2,
      misentry: 2,
    })
    expect(unmatchedTotal.misentry).toBe(2)
  })

  it('결제 전환은 구매 범위를 따른다(귀속 매출은 그대로)', () => {
    const c1 = (scope: 'all' | 'offline' | 'online') => build(scope).campaigns.find((c) => c.id === 'c1')!
    expect(c1('offline').converted).toBeCloseTo(1)
    expect(c1('online').converted).toBe(0)
    expect(c1('online').revenue).toBe(c1('all').revenue)
  })

  it('오기입률 재료가 없으면 그 칸만 0건', () => {
    const { total } = buildAdPerformance(rows, ads, '2026-11-02', '2026-11-08', null)
    expect([total.consultations, total.decided, total.misentry]).toEqual([0, 0, 0])
    expect(total.leads).toBeCloseTo(3)
  })
})

describe('convertedWithin · visitBookedWithin', () => {
  const row: AttributionRow = [
    '2026-01-01',
    'meta',
    'facebook',
    [['2026-02-15', 1]],
    '2026-02-01',
    '소재',
    '2026-01-20',
    '',
    '2026-02-15',
  ]
  it('리드일부터 N일 안(당일 포함)의 첫 구매만', () => {
    expect(convertedWithin(row, 'all', 14)).toBe(false)
    expect(convertedWithin(row, 'all', 15)).toBe(true)
    expect(convertedWithin(row, 'online', 30)).toBe(true)
    expect(convertedWithin(row, 'offline', 90)).toBe(false)
  })
  it('리드 전 예약·예전 형식(재료 없음)은 예약이 아니다', () => {
    expect(visitBookedWithin(row, 90)).toBe(false)
    expect(visitBookedWithin(['2026-02-01', 'meta', 'facebook', [], '2026-02-01', '소재'], 90)).toBe(false)
  })
})
