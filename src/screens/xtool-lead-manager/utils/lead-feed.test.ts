import { describe, expect, it } from 'vitest'
import type { MondayCustomerListItem, MondayLeadFeedRow } from '../entity'
import {
  ALL_BOARDS,
  ALL_CHANNELS,
  ALL_STATUSES,
  customersInOrder,
  firstCallDays,
  formatLeadTime,
  groupByCreative,
  groupLeads,
  leadDate,
  leadFacets,
  leadFeedRange,
  leadKeywords,
  searchLeads,
  sortLeadGroups,
  splitKeywords,
} from './lead-feed'

const row = (patch: Partial<MondayLeadFeedRow> = {}): MondayLeadFeedRow => ({
  itemId: 'i1',
  boardId: 'b1',
  boardName: '[B2B] F2 보드',
  name: '홍길동',
  url: null,
  createdAt: '2026-11-06T05:00:00Z',
  receivedAt: null,
  product: null,
  status: '신규 상담 유입',
  assignee: null,
  probability: null,
  notes: null,
  inquiryMessage: null,
  callbackDates: [],
  callbackStage: 0,
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  phone: '01012345678',
  phoneRaw: '010-1234-5678',
  channel: 'unknown',
  ...patch,
})

describe('splitKeywords', () => {
  it('키워드와 나머지로 나누고, 이어 붙이면 원래 글', () => {
    const text = '렌탈 되나요? 가격이랑 견적, 학교 납품도 문의드려요'
    const parts = splitKeywords(text)
    expect(parts.map((part) => part.text).join('')).toBe(text)
    expect(parts.filter((part) => part.keyword).map((part) => part.text)).toEqual(['렌탈', '가격', '견적', '학교'])
  })

  it('붙어 있는 키워드·글 끝의 키워드·키워드 없는 글', () => {
    expect(splitKeywords('견적가격')).toEqual([
      { text: '견적', keyword: true },
      { text: '가격', keyword: true },
    ])
    expect(splitKeywords('지방 원거리')).toEqual([
      { text: '지방', keyword: true },
      { text: ' ', keyword: false },
      { text: '원거리', keyword: true },
    ])
    expect(splitKeywords('그냥 문의')).toEqual([{ text: '그냥 문의', keyword: false }])
    expect(splitKeywords('')).toEqual([])
  })

  it('띄어쓰기가 들어간 말(먼 거리)도 한 조각', () => {
    expect(splitKeywords('먼 거리라서요').filter((part) => part.keyword)).toEqual([{ text: '먼 거리', keyword: true }])
  })
})

describe('leadKeywords', () => {
  it('문의 원문과 메모에서 찾은 말 — 목록 순서, 한 번씩', () => {
    expect(leadKeywords(row({ inquiryMessage: '견적 주세요. 렌트도 되나요?', notes: '대여 문의, 지방' }))).toEqual([
      '렌탈',
      '원거리',
      '견적',
    ])
    expect(leadKeywords(row())).toEqual([])
  })
})

describe('leadFacets', () => {
  const base = [
    row({ itemId: 'a', boardId: 'b1', status: '신규 상담 유입', channel: 'meta' }),
    row({ itemId: 'b', boardId: 'b1', status: '오기입', channel: 'google' }),
    row({ itemId: 'c', boardId: 'b2', status: '신규 상담 유입', channel: 'meta' }),
    row({ itemId: 'd', boardId: 'b2', status: null, channel: 'unknown' }),
  ]
  const none = { status: ALL_STATUSES, boardId: ALL_BOARDS, channel: ALL_CHANNELS }

  it('거르지 않으면 전부', () => {
    const facets = leadFacets(base, none)
    expect(facets.leads).toHaveLength(4)
    expect(facets.statusCounts).toEqual({ '신규 상담 유입': 2, 오기입: 1, '': 1 })
    expect(facets.boardCounts).toEqual({ b1: 2, b2: 2 })
    expect(facets.channelCounts).toEqual({ meta: 2, google: 1, unknown: 1 })
  })

  it('건수는 위쪽 선택만 반영 — 매체를 골라도 보드·상태 건수는 그대로', () => {
    const facets = leadFacets(base, { ...none, channel: 'meta' })
    expect(facets.leads.map((lead) => lead.itemId)).toEqual(['a', 'c'])
    expect(facets.boardCounts).toEqual({ b1: 2, b2: 2 })
    expect(facets.boardTotal).toBe(4)
    expect(facets.statusCounts).toEqual({ '신규 상담 유입': 2, 오기입: 1, '': 1 })
  })

  it('상태 → 보드 → 매체 순으로 좁힌다', () => {
    const facets = leadFacets(base, { status: '신규 상담 유입', boardId: 'b2', channel: ALL_CHANNELS })
    expect(facets.statusTotal).toBe(4)
    expect(facets.boardCounts).toEqual({ b1: 1, b2: 1 })
    expect(facets.boardTotal).toBe(2)
    expect(facets.channelCounts).toEqual({ meta: 1 })
    expect(facets.channelTotal).toBe(1)
    expect(facets.leads.map((lead) => lead.itemId)).toEqual(['c'])
  })
})

describe('groupByCreative', () => {
  const leads = [
    row({ itemId: '1', channel: 'unknown', createdAt: '2026-11-06T09:00:00Z' }),
    row({ itemId: '2', channel: 'meta', utmCampaign: '소재 A', createdAt: '2026-11-06T01:00:00Z' }),
    row({ itemId: '3', channel: 'meta', utmCampaign: ' 소재 A ', createdAt: '2026-11-06T03:00:00Z' }),
    row({ itemId: '4', channel: 'google', utmCampaign: '소재 A', createdAt: '2026-11-06T02:00:00Z' }),
    row({ itemId: '5', channel: 'naver', utmCampaign: '검색', createdAt: '2026-11-06T08:00:00Z' }),
    row({ itemId: '6', channel: 'unknown', createdAt: '2026-11-06T07:00:00Z' }),
  ]

  it('리드 많은 소재부터(같으면 최근 리드 순), 공백은 같은 소재, 매체가 다르면 따로, UTM 없음은 맨 뒤', () => {
    const groups = groupByCreative(leads, 'desc')
    expect(groups.map((group) => [group.channel, group.campaign, group.leads.map((lead) => lead.itemId)])).toEqual([
      ['meta', '소재 A', ['3', '2']],
      ['naver', '검색', ['5']],
      ['google', '소재 A', ['4']],
      ['unknown', null, ['1', '6']],
    ])
  })

  it('묶음 안은 정렬 방향을 따른다', () => {
    expect(groupByCreative(leads, 'asc')[0].leads.map((lead) => lead.itemId)).toEqual(['2', '3'])
  })
})

describe('groupLeads · sortLeadGroups', () => {
  it('같은 번호는 한 묶음(맨 앞이 가장 최근), 번호 없는 리드는 혼자', () => {
    const rows = [
      row({ itemId: 'new', phone: '01011112222', createdAt: '2026-11-06T09:00:00Z' }),
      row({ itemId: 'x', phone: null, createdAt: '2026-11-06T08:00:00Z' }),
      row({ itemId: 'old', phone: '01011112222', createdAt: '2026-11-01T09:00:00Z' }),
    ]
    const groups = groupLeads(rows)
    expect(groups.map((group) => [group.head.itemId, group.rest.map((lead) => lead.itemId)])).toEqual([
      ['new', ['old']],
      ['x', []],
    ])
    expect(sortLeadGroups(groups, 'asc').map((group) => group.head.itemId)).toEqual(['x', 'new'])
  })
})

describe('customersInOrder', () => {
  it('표 순서대로, 고객 목록에 있는 번호만 한 번씩', () => {
    const customer = (phone: string) => ({ phone }) as MondayCustomerListItem
    const customers = [customer('01011112222'), customer('01033334444')]
    const rows = [
      row({ phone: '01033334444' }),
      row({ phone: '01099990000' }),
      row({ phone: null }),
      row({ phone: '01011112222' }),
      row({ phone: '01033334444' }),
    ]
    expect(customersInOrder(rows, customers).map((each) => each.phone)).toEqual(['01033334444', '01011112222'])
  })
})

describe('날짜', () => {
  it('인입 날짜·시각 — 만든 시각을 못 읽으면 접수일로', () => {
    expect(leadDate(row())).toBe('2026-11-06')
    expect(formatLeadTime(row())).toBe('11/6 14:00')
    const broken = row({ createdAt: '잘못된 값', receivedAt: '2026-11-05' })
    expect(leadDate(broken)).toBe('2026-11-05')
    expect(formatLeadTime(broken)).toBe('2026-11-05')
    expect(formatLeadTime(row({ createdAt: null }))).toBe('-')
  })

  it('첫 콜까지 일수 — 가장 이른 콜백 날, 날짜가 아니면 계산 안 함', () => {
    expect(firstCallDays(row({ callbackDates: ['2026-11-08', '2026-11-07'] }))).toBe(1)
    expect(firstCallDays(row({ callbackDates: ['2026-11-06'] }))).toBe(0)
    expect(firstCallDays(row())).toBeNull()
    expect(firstCallDays(row({ callbackDates: ['메모'] }))).toBeNull()
  })

  it('이번 주는 월요일부터, 전체는 범위 없음', () => {
    expect(leadFeedRange('week', '2026-11-07')).toEqual(['2026-11-02', '2026-11-07'])
    expect(leadFeedRange('week', '2026-11-02')).toEqual(['2026-11-02', '2026-11-02'])
    expect(leadFeedRange('week', '2026-11-08')).toEqual(['2026-11-02', '2026-11-08'])
    expect(leadFeedRange('yesterday', '2026-11-01')).toEqual(['2026-10-31', '2026-10-31'])
    expect(leadFeedRange('all', '2026-11-07')).toBeNull()
  })
})

describe('searchLeads', () => {
  it('이름은 글자로, 번호는 숫자만 떼어 — 낱말마다 모두 맞아야', () => {
    const rows = [
      row({ itemId: 'a', name: '김철수', phone: '01012345678', phoneRaw: '010-1234-5678' }),
      row({ itemId: 'b', name: '이영희', phone: null, phoneRaw: '02-555-0000' }),
    ]
    const ids = (search: string) => searchLeads(rows, search).map((lead) => lead.itemId)
    expect(ids('철수')).toEqual(['a'])
    expect(ids('1234-5678')).toEqual(['a'])
    expect(ids('555')).toEqual(['b'])
    expect(ids('김 5678')).toEqual(['a'])
    expect(ids('김 555')).toEqual([])
    expect(ids('  ')).toEqual(['a', 'b'])
  })
})
