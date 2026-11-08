import { describe, expect, it } from 'vitest'
import type { ChannelAdGroups } from './ad-group-insights-client'
import { adGroupSpendOf, buildAdPerformance, metaSpendOf, type AdPerformanceNode } from './ad-performance'
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
const metaRows: AttributionRow[] = [
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
]

const quality: LeadQualityRow[] = [
  ['2026-11-03', 'meta', '소재 A', 10, 8, 4],
  ['2026-11-04', 'meta', '소재 B', 5, 5, 1],
  ['2026-11-04', 'meta', ' 없는 소재 ', 2, 2, 2],
  ['2026-10-30', 'meta', '소재 B', 3, 3, 3],
  ['2026-11-04', 'naver', '검색', 9, 9, 9],
]

/** 줄 하나를 id로 찾는다(어느 깊이든). */
const findNode = (nodes: readonly AdPerformanceNode[], id: string): AdPerformanceNode | undefined => {
  for (const node of nodes) {
    if (node.id === id) return node
    const found = findNode(node.children, id)
    if (found) return found
  }
  return undefined
}

const START = '2026-11-02'
const END = '2026-11-08'
const buildMeta = (scope: 'all' | 'offline' | 'online' = 'all') =>
  buildAdPerformance(metaRows, { meta: metaSpendOf(ads) }, START, END, quality, scope)

describe('buildAdPerformance — Meta(광고 단위)', () => {
  it('매체 > 캠페인 > 광고셋 > 광고, 같은 이름의 광고는 상담일 광고비로 나눈다', () => {
    const { channels } = buildMeta()
    expect(channels.map((channel) => channel.id)).toEqual(['meta'])
    const c1 = findNode(channels, 'meta:campaign:c1')!
    expect(c1.kind).toBe('campaign')
    expect(c1.leads).toBeCloseTo(1)
    expect(c1.visitBooked).toBeCloseTo(1)
    expect(c1.converted).toBeCloseTo(1)
    expect(findNode(channels, 'meta:adset:s1')!.leads).toBeCloseTo(0.75)
    expect(findNode(channels, 'meta:ad:a2')!.leads).toBeCloseTo(0.25)
    const c2 = findNode(channels, 'meta:campaign:c2')!
    expect([c2.leads, c2.visitBooked, c2.converted, c2.buyers, c2.revenue]).toEqual([2, 0, 0, 1, 300_000])
  })

  it('오기입률 재료는 상담 단위로 같은 방법으로 나누고, 기간 밖·다른 매체는 뺀다', () => {
    const { channels, total } = buildMeta()
    const c1 = findNode(channels, 'meta:campaign:c1')!
    expect([c1.consultations, c1.decided, c1.misentry]).toEqual([10, 8, 4])
    const a1 = findNode(channels, 'meta:ad:a1')!
    expect([a1.consultations, a1.decided, a1.misentry]).toEqual([7.5, 6, 3])
    expect([total.consultations, total.decided, total.misentry]).toEqual([15, 13, 5])
    expect(total.leads).toBeCloseTo(3)
  })

  it('못 찾은 utm_campaign은 매체별로, 공백·대소문자를 무시하고 한 줄로', () => {
    const { unmatched, unmatchedTotal, matches } = buildMeta()
    expect(unmatched).toEqual([
      expect.objectContaining({ channel: 'meta', utmCampaign: '없는 소재', leads: 1, consultations: 2, misentry: 2 }),
    ])
    expect(unmatchedTotal.misentry).toBe(2)
    expect(matches.meta?.leads).toEqual({ ad: 3, group: 0, campaign: 0, none: 1 })
    expect(matches.meta?.consultations).toEqual({ ad: 15, group: 0, campaign: 0, none: 2 })
  })

  it('결제 전환은 구매 범위를 따른다(귀속 매출은 그대로)', () => {
    const c1 = (scope: 'all' | 'offline' | 'online') => findNode(buildMeta(scope).channels, 'meta:campaign:c1')!
    expect(c1('offline').converted).toBeCloseTo(1)
    expect(c1('online').converted).toBe(0)
    expect(c1('online').revenue).toBe(c1('all').revenue)
  })

  it('오기입률 재료가 없으면 그 칸만 0건', () => {
    const { total } = buildAdPerformance(metaRows, { meta: metaSpendOf(ads) }, START, END, null)
    expect([total.consultations, total.decided, total.misentry]).toEqual([0, 0, 0])
    expect(total.leads).toBeCloseTo(3)
  })
})

describe('buildAdPerformance — 광고그룹 단위 매체(소재·광고그룹·캠페인 이름 순으로 찾기)', () => {
  const google: ChannelAdGroups = {
    adGroups: [
      { id: 'g1', name: '브랜드_PC', campaignId: 'gc1', campaignName: '브랜드검색' },
      { id: 'g2', name: '브랜드_MO', campaignId: 'gc1', campaignName: '브랜드검색' },
      { id: 'campaign:gc2', name: '(광고그룹 없음)', campaignId: 'gc2', campaignName: 'pmax_f2' },
      // 캠페인 이름과 같은 광고그룹 이름 — 광고그룹이 먼저다.
      { id: 'g4', name: '중복이름', campaignId: 'gc3', campaignName: '중복이름' },
      { id: 'g5', name: '다른 그룹', campaignId: 'gc3', campaignName: '중복이름' },
    ],
    daily: [
      [0, '2026-11-03', 20_000, 100, 10],
      [1, '2026-11-03', 60_000, 100, 10],
      [2, '2026-11-04', 40_000, 100, 10],
      [3, '2026-11-04', 10_000, 100, 10],
      [4, '2026-11-04', 10_000, 100, 10],
    ],
    ads: [],
  }
  const openai: ChannelAdGroups = {
    adGroups: [
      { id: 'o1', name: '그룹 1', campaignId: 'oc1', campaignName: 'ChatGPT 캠페인' },
      { id: 'o2', name: '그룹 2', campaignId: 'oc1', campaignName: 'ChatGPT 캠페인' },
    ],
    daily: [
      [0, '2026-11-05', 5_000, 10, 1],
      [1, '2026-11-05', 5_000, 10, 1],
    ],
    // 소재 이름 → 광고그룹(o9는 기간에 광고비가 없어 이을 곳이 없다).
    ads: [
      { name: '소재_X', adGroupId: 'o2' },
      { name: '소재_Y', adGroupId: 'o9' },
    ],
  }
  const lead = (channel: 'google' | 'openai' | 'naver', date: string, campaign: string): AttributionRow => [
    date,
    channel,
    channel,
    [],
    date,
    campaign,
    '',
    '',
    '',
  ]
  const rows: AttributionRow[] = [
    lead('google', '2026-11-03', '브랜드검색'),
    lead('google', '2026-11-03', '브랜드_MO'),
    lead('google', '2026-11-04', 'PMAX_F2'),
    lead('google', '2026-11-04', '중복이름'),
    lead('google', '2026-11-04', '알수없음'),
    lead('openai', '2026-11-05', '소재_X'),
    lead('openai', '2026-11-05', '소재_Y'),
    lead('naver', '2026-11-05', '검색'),
  ]
  const result = buildAdPerformance(
    rows,
    { google: adGroupSpendOf(google), openai: adGroupSpendOf(openai) },
    START,
    END,
    quality,
  )

  it('캠페인 이름은 그 캠페인 광고그룹들에 상담일 광고비로, 광고그룹 이름은 그 광고그룹에', () => {
    const g1 = findNode(result.channels, 'google:adgroup:g1')!
    const g2 = findNode(result.channels, 'google:adgroup:g2')!
    // 브랜드검색(캠페인) 1명을 1:3으로 + 브랜드_MO(광고그룹) 1명.
    expect(g1.leads).toBeCloseTo(0.25)
    expect(g2.leads).toBeCloseTo(1.75)
    expect(findNode(result.channels, 'google:campaign:gc1')!.leads).toBeCloseTo(2)
    expect(findNode(result.channels, 'google:adgroup:campaign:gc2')!.leads).toBe(1)
  })

  it('광고그룹 이름과 캠페인 이름이 같으면 광고그룹이 먼저', () => {
    expect(findNode(result.channels, 'google:adgroup:g4')!.leads).toBe(1)
    expect(findNode(result.channels, 'google:adgroup:g5')?.leads ?? 0).toBe(0)
  })

  it('소재 이름은 그 소재의 광고그룹에 — 광고비가 없는 광고그룹의 소재는 못 찾음', () => {
    expect(findNode(result.channels, 'openai:adgroup:o2')!.leads).toBe(1)
    expect(findNode(result.channels, 'openai:adgroup:o1')!.leads).toBe(0)
    expect(result.unmatched.map((row) => [row.channel, row.utmCampaign])).toEqual([
      ['google', '알수없음'],
      ['openai', '소재_Y'],
    ])
  })

  it('찾은 방법을 매체마다 센다 — utm_campaign에 무엇이 들어오는지 보는 진단', () => {
    expect(result.matches.google?.leads).toEqual({ ad: 0, group: 2, campaign: 2, none: 1 })
    expect(result.matches.openai?.leads).toEqual({ ad: 1, group: 0, campaign: 0, none: 1 })
  })

  it('광고비 데이터가 없는 매체는 빼고 그 매체 리드·상담도 세지 않는다', () => {
    expect(result.channels.map((channel) => channel.id)).toEqual(['google', 'openai'])
    expect(result.matches.naver).toBeUndefined()
    expect(result.unmatched.some((row) => row.channel === 'naver')).toBe(false)
    expect(result.total.spend).toBe(150_000)
  })
})

describe('buildAdPerformance — 나눌 비율(그날 → 그 전 7일 → 전체 기간 → 똑같이)', () => {
  const naver: ChannelAdGroups = {
    adGroups: [
      { id: 'n1', name: '그룹 1', campaignId: 'nc', campaignName: '파워링크' },
      { id: 'n2', name: '그룹 2', campaignId: 'nc', campaignName: '파워링크' },
      { id: 'n3', name: '그룹 3', campaignId: 'nc2', campaignName: '안 쓰는 캠페인' },
      { id: 'n4', name: '그룹 4', campaignId: 'nc2', campaignName: '안 쓰는 캠페인' },
    ],
    daily: [
      // 11/2에만 1:3 — 11/6 리드는 그날 쓴 곳이 없어 그 전 7일(11/2 포함)로.
      [0, '2026-11-02', 10_000, 1, 1],
      [1, '2026-11-02', 30_000, 1, 1],
      // 9/1에만 4:1 — 11/6 리드는 그 전 7일에도 없어 받은 기간 전체로.
      [2, '2026-09-01', 40_000, 1, 1],
      [3, '2026-09-01', 10_000, 1, 1],
    ],
    ads: [],
  }
  const lead = (campaign: string): AttributionRow => [
    '2026-11-06',
    'naver',
    'naver',
    [],
    '2026-11-06',
    campaign,
    '',
    '',
    '',
  ]
  const { channels } = buildAdPerformance(
    [lead('파워링크'), lead('안 쓰는 캠페인')],
    { naver: adGroupSpendOf(naver) },
    START,
    END,
  )
  it('그날 쓴 곳이 없으면 그 전 7일 광고비로', () => {
    expect(findNode(channels, 'naver:adgroup:n1')!.leads).toBeCloseTo(0.25)
    expect(findNode(channels, 'naver:adgroup:n2')!.leads).toBeCloseTo(0.75)
  })
  it('그 전 7일에도 없으면 받은 기간 전체 광고비로', () => {
    expect(findNode(channels, 'naver:adgroup:n3')!.leads).toBeCloseTo(0.8)
    expect(findNode(channels, 'naver:adgroup:n4')!.leads).toBeCloseTo(0.2)
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
