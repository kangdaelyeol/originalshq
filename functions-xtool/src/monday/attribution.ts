import { koreaDate } from './fields'
import {
  MondayAttributionChannel,
  MondayAttributionRow,
  MondayConsultation,
  MondayCustomer,
} from './types'

// Meta 광고셋 이름이 utm_source에 그대로 들어간 값 — 일부 광고의 URL
// 파라미터가 utm_source={{adset.name}}처럼 잡혀 있어 생긴다(예:
// "장바구니_3065M_INT_F1울트라", "트래픽_3040MF_non_P2", "전환_맞춤유사_프로모션").
const META_ADSET_NAME = /^(장바구니|트래픽|전환|결제시작)_/

/** UTM source를 광고 채널로 묶는다 — ROAS 하한은 이 값이 광고 채널인 고객만
 * 센다.
 *   · meta / google / naver / openai / daangn — UTM이 광고 채널. OpenAI(ChatGPT
 *     광고)는 'gpt', 당근은 'daangn'으로 잡혀 있다(2026-11-03 실제 값 확인 —
 *     둘 다 utm_campaign에 광고 이름이 있고 광고 시작 뒤에만 나온다).
 *   · other   — UTM은 있지만 광고비를 모으지 않는 곳(threads 등). chatgpt.com은
 *               ChatGPT가 일반 답변 링크에도 붙이는 값이라(광고 전인 6월부터
 *               있고 캠페인 이름이 없다) 광고로 세지 않는다.
 *   · unknown — UTM이 없음(문의 없이 산 고객, UTM 없이 들어온 문의 포함) */
export const attributionChannel = (
  utmSource: string | null,
): MondayAttributionRow[1] => {
  if (!utmSource) return 'unknown'
  const value = utmSource.trim().toLowerCase()
  if (
    /facebook|instagram|igshopping|^fb$|^ig$|^meta$|^an$/.test(value) ||
    META_ADSET_NAME.test(utmSource.trim())
  ) {
    return 'meta'
  }
  if (/google|youtube|gdn/.test(value)) return 'google'
  if (/naver/.test(value)) return 'naver'
  if (value === 'gpt' || /openai|chatgpt_ads/.test(value)) return 'openai'
  if (/daangn|karrot|당근/.test(value)) return 'daangn'
  return 'other'
}

/** 광고비가 있는 채널 — 광고 성과표 재료(leadOutcomes)를 붙이는 고객. */
const AD_CHANNELS: ReadonlySet<MondayAttributionChannel> = new Set([
  'meta',
  'google',
  'naver',
  'openai',
  'daangn',
])

/** 광고 성과표(cmip "광고 성과" 탭)의 방문체험 예약률·결제 전환 재료 —
 * [utmAt 이후 처음 방문체험을 예약한 날, 첫 오프라인 결제일, 첫 온라인 주문
 * 결제일], 없으면 ''. 예약한 날은 방문체험 보드에 기록이 생긴 날(만든 시각,
 * 없으면 체험일)이나, 상담에서 "방문체험확정"이 체크된 그 상담의 접수일이다
 * (리드 매니저 퍼널의 "방문체험 예약"과 같은 기록). UTM 상담 전에 예약한 것은
 * 이 리드의 예약이 아니라 뺀다. */
const leadOutcomes = (
  customer: MondayCustomer,
  utmAt: string,
): [string, string, string] => {
  const booked = [
    ...customer.visits.map(
      (visit) => koreaDate(visit.createdAt) ?? koreaDate(visit.visitAt),
    ),
    ...customer.consultations
      .filter((record) => record.visitConfirmed)
      .map(
        (record) => koreaDate(record.receivedAt) ?? koreaDate(record.createdAt),
      ),
  ]
    .filter((date): date is string => date !== null && date >= utmAt)
    .sort()
  const firstPaid = (origin: 'offline' | 'online'): string =>
    customer.purchases
      .filter(
        (purchase) =>
          purchase.origin === origin && !purchase.cancelled && purchase.paidAt,
      )
      .map((purchase) => purchase.paidAt as string)
      .sort()[0] ?? ''
  return [booked[0] ?? '', firstPaid('offline'), firstPaid('online')]
}

/**
 * 광고 기여 ROAS 재료 — 고객 1명당 한 줄(순수 함수). cmip ROAS 탭이 광고비와
 * 맞춰 "광고로 확인된 신규 고객 매출"(ROAS 하한)과 고객 유입 월 코호트
 * ROAS를 계산하고, "광고 성과" 탭이 광고별 유효 리드(공통 정의 D1)·방문체험
 * 예약률·결제 전환을 센다. 오기입 고객과 처음 나타난 날을 모르는 고객은 뺀다.
 */
export const buildAttributionRows = (
  customers: MondayCustomer[],
): MondayAttributionRow[] =>
  customers.flatMap((customer): MondayAttributionRow[] => {
    const { firstContactAt, misentry } = customer.summary.funnel
    if (misentry || !firstContactAt) return []
    // 유입 경로는 UTM만 본다 — 가장 이른 상담의 utm_source. 방문체험 보드의
    // "유입경로"(영업전환·자연유입 등)는 방문체험을 어떻게 잡았는지를 적은
    // 값이라 처음 어디서 왔는지로 쓰지 않는다.
    // 상담의 날 — 접수일, 비었으면 그 기록을 만든 날(KST). 오기입률 재료
    // (lead-feed.ts)와 같은 규칙.
    const dayOf = (record: MondayConsultation): string | null =>
      koreaDate(record.receivedAt) ?? koreaDate(record.createdAt)
    const utmRecord = [...customer.consultations]
      .sort((a, b) => (dayOf(a) ?? '9999').localeCompare(dayOf(b) ?? '9999'))
      .find((record) => record.utmSource)
    const utmSource = utmRecord?.utmSource ?? null
    // 그 UTM 상담의 날 — 광고 성과로 인정하는 구매 기간의 시작이다(화면이 이
    // 날 이후 90일 안의 첫 구매만 하한에 넣는다). 접수일도 만든 시각도 없으면
    // 처음 나타난 날로 본다.
    const utmAt = utmRecord ? (dayOf(utmRecord) ?? firstContactAt) : ''
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
    const channel = attributionChannel(utmSource)
    // 광고 채널 고객만 광고 성과표 재료를 붙인다(문서 크기 — 나머지는 안 쓴다).
    const outcomes: [string, string, string] | [] = AD_CHANNELS.has(channel)
      ? leadOutcomes(customer, utmAt)
      : []
    return [
      [
        firstContactAt,
        channel,
        utmSource ?? '',
        purchases,
        utmAt,
        utmRecord?.utmCampaign ?? '',
        ...outcomes,
      ],
    ]
  })
