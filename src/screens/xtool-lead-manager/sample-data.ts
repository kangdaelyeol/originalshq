// sample-leads.ts
import type { Device, Lead, LeadState } from './types'

const LAST_NAMES = [
  '김',
  '이',
  '박',
  '최',
  '정',
  '강',
  '조',
  '윤',
  '장',
  '임',
  '한',
  '오',
  '서',
  '신',
  '권',
  '황',
  '안',
  '송',
  '전',
  '홍',
]
const FIRST_NAMES = [
  '민수',
  '서연',
  '지훈',
  '유진',
  '하늘',
  '도윤',
  '세훈',
  '채영',
  '현우',
  '예은',
  '가은',
  '태양',
  '나윤',
  '승민',
  '은서',
  '재현',
  '수아',
  '지민',
  '동현',
  '소율',
  '준서',
  '아린',
  '건우',
  '다인',
  '시우',
  '해린',
  '민재',
  '수빈',
  '태민',
  '유나',
]

const UTM_SOURCES = [
  'facebook',
  'google',
  'naver',
  'instagram',
  'kakao',
  'direct',
] as const

const CAMPAIGNS_BY_SOURCE: Record<
  (typeof UTM_SOURCES)[number],
  { campaign: string; medium: string }[]
> = {
  facebook: [
    { campaign: 'summer_promo_2025', medium: 'cpc' },
    { campaign: 'brand_awareness_q3', medium: 'cpc' },
  ],
  google: [
    { campaign: 'brand_search', medium: 'cpc' },
    { campaign: 'competitor_keyword', medium: 'cpc' },
  ],
  naver: [
    { campaign: 'metalfab_launch', medium: 'organic' },
    { campaign: 'blog_review', medium: 'organic' },
  ],
  instagram: [
    { campaign: 'instagram_reels_q3', medium: 'social' },
    { campaign: 'influencer_collab', medium: 'social' },
  ],
  kakao: [{ campaign: 'kakao_talk_channel', medium: 'referral' }],
  direct: [{ campaign: '', medium: '' }],
}

const USER_AGENTS = [
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; SM-S928N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edg/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Linux; Android 14; SM-A536N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
]

const DEVICE_OPTIONS: Device[] = [
  'F2Ultra',
  'F2UltraUV',
  'P3',
  'DTF',
  'Metalfab',
]

const DAY_MS = 1000 * 60 * 60 * 24

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomIp(): string {
  return `${randomInt(1, 223)}.${randomInt(0, 255)}.${randomInt(0, 255)}.${randomInt(1, 254)}`
}

function randomPhone(): string {
  const mid = randomInt(1000, 9999)
  const end = randomInt(1000, 9999)
  return `010${mid}${end}`
}

function randomFbParam(prefix: 'fbc' | 'fbp', ts: number): string {
  const hash = Math.random().toString(36).slice(2, 12)
  return prefix === 'fbc'
    ? `fb.1.${ts}.IwAR${hash}`
    : `fb.1.${ts}.${randomInt(100000000, 999999999)}`
}

// state 분포: new 55%, contacted 30%, purchased 15%
function randomState(): LeadState {
  const r = Math.random()
  if (r < 0.55) return 'new'
  if (r < 0.85) return 'contacted'
  return 'purchased'
}

function createLead(index: number): Lead {
  const daysAgo = randomInt(0, 30)
  const createdAt = Date.now() - daysAgo * DAY_MS - randomInt(0, DAY_MS)

  const source = pick(UTM_SOURCES)
  const { campaign, medium } = pick(CAMPAIGNS_BY_SOURCE[source])
  const hasFbParams = source !== 'direct' && Math.random() > 0.15

  const state = randomState()
  const isPurchased = state === 'purchased'

  return {
    id: `lead_${String(index + 1).padStart(4, '0')}`,
    createdAt,
    utm_campaign: campaign,
    utm_medium: medium,
    utm_source: source,
    ip: randomIp(),
    fbc: hasFbParams
      ? randomFbParam('fbc', createdAt - randomInt(0, 60000))
      : '',
    fbp: hasFbParams
      ? randomFbParam('fbp', createdAt - randomInt(60000, 3600000))
      : '',
    user_agent: pick(USER_AGENTS),
    fn: `${pick(LAST_NAMES)}${pick(FIRST_NAMES)}`,
    ph: randomPhone(),
    price: isPurchased ? randomInt(50, 500) * 10000 : 0,
    purchasedAt: isPurchased ? createdAt + randomInt(DAY_MS, DAY_MS * 3) : 0,
    state,
    device: pick(DEVICE_OPTIONS),
  }
}

export function generateSampleLeads(count = 200): Lead[] {
  return Array.from({ length: count }, (_, i) => createLead(i))
}

export const sampleLeads: Lead[] = generateSampleLeads(200)
