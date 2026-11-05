import type { Device } from './types'

// ────────────────────────────────
// 직접 고쳐 쓰는 값 — 기기별 금액처럼 때때로 바꾸는 숫자를 여기 한곳에 모은다.
// 금액은 모두 원(KRW). 고친 뒤 이 값을 쓰는 함수(상담 등록 contactLead, 상담
// 수정 updateConsultation, 상담 재전송 resendConsultation)를 다시 배포해야
// 반영되고, 이미 보낸 이벤트는 바뀌지 않는다.
// ────────────────────────────────

/** 상담 등록 때 Meta CAPI(Contact 이벤트)에 실어 보내는 기기별 예상 금액.
 * 상담 기기가 여럿이면(관심 기기를 여러 개 고른 상담) 그중 가장 큰 금액을
 * 보낸다. 여기 없는 기기는 DEFAULT_EXPECTED_VALUE로 보낸다. */
export const DEVICE_EXPECTED_VALUE: Partial<Record<Device, number>> = {
  F1Ultra: 400000,
  F2Ultra: 104500,
  F2UltraUV: 195000,
  P3: 89000,
  DTF: 152000,
  Metalfab: 492000,
  F2: 800000,
  M2: 570000,
  o1: 800000,
  WonderPress: 150000,
  B2G: 1000000,
  기타: 200000,
}

/** 위 표에 금액이 없는 기기의 예상 금액. */
export const DEFAULT_EXPECTED_VALUE = 150000

/** 상담 등록 때 GA4로 보낼 이벤트 이름과 금액 — 여기 없는 기기는 GA4 이벤트를
 * 보내지 않는다(지금은 '기타'와 'B2G'만). 다른 기기를 추가하려면 항목만
 * 늘리면 된다. 이름을 바꾸면 GA4 쪽 전환 설정도 같이 바꿔야 한다. */
export const GA4_CONSULTATION_EVENTS: Partial<
  Record<Device, { name: string; value: number }>
> = {
  기타: { name: 'other_online_submit', value: 150000 },
  B2G: { name: 'b2g_submit', value: 1000000 },
}
