import { Channel } from '../types'
/**
 * 컬럼 별칭 사전 — Python `src/core/csv_importer.py`의 ALIASES / 정규식 상수 이관.
 * 매체별 CSV 헤더가 어떤 이름으로 오든 표준 필드로 매핑한다.
 * 실측 별칭 전부 포함 (네이버 `구매완료 전환매출액(원)`, 구글 `리드 수익 전체`,
 * 메타 `결과 유형`/`지출 금액 (KRW)`, 당근 `비용 (VAT 포함)` 등).
 */

export const FieldName = [
  'date',
  'campaign',
  'adgroup',
  'keyword',
  'impressions',
  'clicks',
  'cost',
  'conversion',
  'conv_indirect',
  'conv_purchase',
  'revenue',
  'result_type',
  'ctr',
  'cpc',
  'cpm',
] as const

export type FieldName = (typeof FieldName)[number]

export const ALIASES: Record<FieldName, readonly string[]> = {
  date: [
    '일별',
    '일',
    '날짜',
    'date',
    'day',
    '기간',
    '보고 시작',
    '보고시작',
    '보고 기간 시작',
    '일자',
  ],
  campaign: [
    '캠페인',
    '캠페인 이름',
    '캠페인명',
    'campaign',
    '광고 계정 이름',
    '계정 이름',
  ],
  adgroup: [
    '광고그룹',
    '광고 그룹',
    '광고 세트 이름',
    '광고세트',
    '광고 세트',
    'ad group',
    'adgroup',
    'ad set',
  ],
  keyword: ['키워드', 'keyword', '검색어'],
  impressions: [
    '노출수',
    '노출 수',
    '노출',
    'impressions',
    'impr',
    'impression',
  ],
  clicks: [
    '클릭수',
    '클릭 수',
    '클릭',
    'clicks',
    '링크 클릭',
    '링크클릭',
    'link clicks',
    '상호작용수',
    '상호작용 수',
  ],
  cost: [
    '총비용(vat포함,원)',
    '총비용',
    '소진액',
    '소진금액',
    '비용',
    'cost',
    '지출 금액 (krw)',
    '지출 금액',
    '지출금액',
    '지출',
    'amount spent',
    '비용 (vat 포함)',
    '비용(vat 포함)',
  ],
  conversion: [
    '총 전환수',
    '전환수',
    '전환',
    'conversions',
    '결과',
    '구매완료 수',
    '구매완료수',
    '구매완료 전환수',
    '구매',
    '구매수',
    '웹사이트 구매',
    '리드',
    '잠재 고객',
    'db',
    '거래수',
    '판매',
    '전환 수',
  ],
  conv_indirect: ['간접전환수', '간접 전환수'],
  conv_purchase: ['구매완료 전환수', '구매완료 수', '구매완료수'],
  revenue: [
    '전환매출액(원)',
    '전환매출액',
    '구매완료 전환매출액(원)',
    '구매완료 전환매출액',
    '구매완료 전환매출',
    '구매 전환값',
    '구매 전환값 (krw)',
    '전환값',
    '구매값',
    'conv. value',
    'conversion value',
    '전환 가치',
    '매출',
    '수익',
    '판매액',
    '리드 수익 전체',
    '리드수익',
    '리드 수익',
    '리드 매출',
  ],
  result_type: ['결과 유형', '결과유형'],
  ctr: ['클릭률(%)', '클릭률', 'ctr', '상호작용 발생률', '상호작용발생률'],
  cpc: [
    '평균클릭비용(vat포함,원)',
    '평균클릭비용',
    '평균 cpc',
    'avg cpc',
    'cpc',
    '클릭당 비용(cpc)',
    '클릭당비용',
    '평균비용',
  ],
  cpm: [
    'cpm',
    '평균 cpm',
    'avg cpm',
    '노출당 비용(cpm)',
    '노출당비용',
    '평균cpm',
  ],
}

export const SUMMARY_RE =
  /^(all|total|sum|overall|aggregate|모두|전체|합계|총합|총계|전체기간|전체 캠페인|전체광고세트|전체 광고세트)$/

export const HEADER_KEYWORDS = [
  'date',
  '날짜',
  '일',
  '기간',
  '일별',
  'campaign',
  '캠페인',
  'adgroup',
  '광고그룹',
  '광고 세트',
  'impressions',
  '노출',
  '클릭',
  'clicks',
  'cost',
  '비용',
  '지출',
  '총비용',
] as const

export type HeaderKeyword = (typeof HEADER_KEYWORDS)[number]

export const FILENAME_HINTS: ReadonlyArray<
  readonly [Channel, readonly string[]]
> = [
  ['naver', ['naver', '네이버']],
  ['meta', ['meta', 'facebook', '페이스북', '인스타']],
  ['google', ['google', '구글', 'gads', 'google_ads']],
  ['daangn', ['daangn', 'danggeun', '당근']],
  ['smartstore', ['smartstore', '스마트스토어', '스토어']],
]

// 기간 추출용 (날짜 컬럼 없는 집계형)
export const FN_RANGE_RE = /(\d{8})[_-](\d{8})/

export const TXT_RANGE_RE = new RegExp(
  '(\\d{4})\\s*[.\\-/년]\\s*(\\d{1,2})\\s*[.\\-/월]\\s*(\\d{1,2})\\s*일?' +
    '\\s*[-~]\\s*' +
    '(\\d{4})\\s*[.\\-/년]\\s*(\\d{1,2})\\s*[.\\-/월]\\s*(\\d{1,2})\\s*일?',
)

export { Channel }
