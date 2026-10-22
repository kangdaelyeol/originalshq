import { koreaDate } from './fields'
import { MondayAttributionRow, MondayCustomer } from './types'

// Meta 광고셋 이름이 utm_source에 그대로 들어간 값 — 일부 광고의 URL
// 파라미터가 utm_source={{adset.name}}처럼 잡혀 있어 생긴다(예:
// "장바구니_3065M_INT_F1울트라", "트래픽_3040MF_non_P2", "전환_맞춤유사_프로모션").
const META_ADSET_NAME = /^(장바구니|트래픽|전환|결제시작)_/

/** UTM source를 광고 채널로 묶는다 — ROAS 하한은 이 값이 광고 채널인 고객만
 * 센다.
 *   · meta / google / naver — UTM이 광고 채널
 *   · other   — UTM은 있지만 광고비를 모으지 않는 곳(chatgpt.com, 당근,
 *               threads 등)
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
    const { firstContactAt, misentry } = customer.summary.funnel
    if (misentry || !firstContactAt) return []
    // 유입 경로는 UTM만 본다 — 가장 이른 상담의 utm_source. 방문체험 보드의
    // "유입경로"(영업전환·자연유입 등)는 방문체험을 어떻게 잡았는지를 적은
    // 값이라 처음 어디서 왔는지로 쓰지 않는다.
    const utmRecord = [...customer.consultations]
      .sort((a, b) =>
        (a.receivedAt ?? '9999').localeCompare(b.receivedAt ?? '9999'),
      )
      .find((record) => record.utmSource)
    const utmSource = utmRecord?.utmSource ?? null
    // 그 UTM 상담의 접수일 — 광고 성과로 인정하는 구매 기간의 시작이다
    // (화면이 이 날 이후 90일 안의 첫 구매만 하한에 넣는다). 접수일이 비어
    // 있으면 처음 나타난 날로 본다.
    const utmAt = utmRecord
      ? (koreaDate(utmRecord.receivedAt) ?? firstContactAt)
      : ''
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
      [
        firstContactAt,
        attributionChannel(utmSource),
        utmSource ?? '',
        purchases,
        utmAt,
        utmRecord?.utmCampaign ?? '',
      ],
    ]
  })
