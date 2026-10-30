import {
  Device,
  type Lead,
  type MondayConsultation,
  type MondayCustomer,
  type MondayPurchase,
} from '../entity'
import { INITIAL_CREATE_LEAD_FORM, type CreateLeadFormValues } from '../types'
import { toDatetimeLocalValue } from './format-time'

/** Monday 고객 상세에서 CAPI로 보낼 수 있는 기록 — 상담(Meta "Contact")과
 * 구매(Meta "Purchase"). */
export type MondayCapiKind = 'consultation' | 'purchase'

export type MondayCapiSource =
  | { kind: 'consultation'; record: MondayConsultation }
  | { kind: 'purchase'; record: MondayPurchase }

export const MONDAY_CAPI_KIND_LABEL: Record<MondayCapiKind, string> = {
  consultation: '상담',
  purchase: '구매',
}

/** 보낼 만한 기록인지 — 오기입 상담과 취소된 결제는 CAPI로 보내지 않는다. */
export const canSendMondayCapi = (source: MondayCapiSource): boolean =>
  source.kind === 'consultation'
    ? source.record.status !== '오기입'
    : !source.record.cancelled

// Monday에 적힌 제품·보드 이름 → 리드의 기기. 공백·"xtool"을 지우고 소문자로
// 바꾼 글자에서 찾는다("[B2B] F2 울트라 UV 보드" → "[b2b]f2울트라uv보드").
// 위에서부터 먼저 맞는 것 — UV·울트라가 붙은 이름이 그냥 F2보다 먼저다.
const DEVICE_PATTERNS: [RegExp, Device][] = [
  [/f2(ultra|울트라)?uv/, Device.F2_ULTRA_UV],
  [/f2(ultra|울트라)/, Device.F2_ULTRA],
  [/f2/, Device.F2],
  [/p3/, Device.P3],
  [/dtf/, Device.DTF],
  [/metalfab|메탈(팹|펩)/, Device.METAL_FAB],
  [/m2/, Device.M2],
  [/o1/, Device.O1],
  [/wonderpress|원더프레스/, Device.WONDER_PRESS],
  [/b2g|공공기관|조달/, Device.B2G],
]

/** 글자들을 차례로 보며 처음 맞는 기기 — 하나도 없으면 "기타". */
export const mondayDevice = (
  texts: readonly (string | null | undefined)[],
): Device => {
  for (const text of texts) {
    const normalized = (text ?? '').toLowerCase().replace(/\s|xtool/g, '')
    if (!normalized) continue
    const found = DEVICE_PATTERNS.find(([pattern]) => pattern.test(normalized))
    if (found) return found[1]
  }
  return Device.ETC
}

/** 기록의 시각(ms) — Monday 날짜 칸은 날짜뿐이라("2026-09-23"), 그날 만들어진
 * 기록이면 만든 시각(createdAt)을, 아니면 그날 낮 12시를 쓴다. */
export const mondayEventTime = (
  date: string | null,
  createdAt: string | null,
): number => {
  const created = createdAt ? new Date(createdAt).getTime() : NaN
  const day = date?.slice(0, 10)
  if (!day) return Number.isNaN(created) ? Date.now() : created
  if (
    !Number.isNaN(created) &&
    toDatetimeLocalValue(created).slice(0, 10) === day
  ) {
    return created
  }
  return new Date(`${day}T12:00`).getTime()
}

// 문의 폼이 빈 값을 글자 "null"로 넘긴 것이 남아 있는 경우가 있다(monday-copy.ts).
const clean = (value: string | null | undefined): string => {
  const text = value?.trim() ?? ''
  return /^(null|undefined)$/i.test(text) ? '' : text
}

/** 구매에는 UTM·fbc·fbp가 없어 그 고객의 상담에서 가져온다 — 가장 이른 상담의
 * 값(최초 유입에 가까운 것)부터, 칸마다 처음 나오는 값. */
const trackingOf = (consultations: readonly MondayConsultation[]) => {
  const oldestFirst = [...consultations].reverse()
  const first = (pick: (record: MondayConsultation) => string | null) =>
    oldestFirst.map((record) => clean(pick(record))).find(Boolean) ?? ''
  return {
    utm_source: first((record) => record.utmSource),
    utm_medium: first((record) => record.utmMedium),
    utm_campaign: first((record) => record.utmCampaign),
    fbc: first((record) => record.fbc),
    fbp: first((record) => record.fbp),
  }
}

/**
 * Monday 기록 한 건으로 CAPI 전송 폼을 미리 채운다. 이름·번호·이메일은
 * 고객(번호로 묶인 기록 전체)에서, 시각·기기·금액은 그 기록에서. 상담은 그
 * 상담의 UTM·fbc·fbp를, 구매는 그 고객 상담들의 값을 쓴다. 다 고칠 수 있는
 * 초안이다.
 */
export const buildMondayCapiForm = (
  customer: MondayCustomer,
  source: MondayCapiSource,
): CreateLeadFormValues => {
  const base = {
    ...INITIAL_CREATE_LEAD_FORM,
    fn: customer.names[0] ?? source.record.name,
    ph: customer.phone,
    em: customer.emails[0] ?? '',
    remarks: `Monday ${source.record.boardName}`,
  }

  if (source.kind === 'consultation') {
    const { record } = source
    return {
      ...base,
      utm_source: clean(record.utmSource),
      utm_medium: clean(record.utmMedium),
      utm_campaign: clean(record.utmCampaign),
      fbc: clean(record.fbc),
      fbp: clean(record.fbp),
      device: mondayDevice([record.product, record.boardName]),
      createdAt: toDatetimeLocalValue(
        mondayEventTime(record.receivedAt, record.createdAt),
      ),
    }
  }

  const { record } = source
  return {
    ...base,
    ...trackingOf(customer.consultations),
    // 품목 줄 중 기기 이름이 있는 첫 줄(할인·소모품 줄은 지나친다).
    device: mondayDevice([
      ...record.lines
        .filter((line) => line.kind === 'product')
        .map((line) => line.product || line.name),
      record.boardName,
    ]),
    price: record.amount > 0 ? String(record.amount) : '',
    createdAt: toDatetimeLocalValue(
      mondayEventTime(record.paidAt, record.createdAt),
    ),
  }
}

/** 국내 번호로 맞춘 숫자만 — 서버(normalizeDomesticPhone)와 같은 규칙. */
const domesticDigits = (phone: string): string => {
  const digits = phone.replace(/\D/g, '')
  return digits.startsWith('82') ? `0${digits.slice(2)}` : digits
}

/** 리드 탭에 같은 번호의 리드가 있는지 — 있으면 새로 만들지 않고 그 리드에
 * 상담·구매를 더한다(같은 고객이 리드 두 개로 갈라지지 않게). 여럿이면 가장
 * 최근에 접수된 것. */
export const findLeadByPhone = (
  leads: readonly Lead[],
  phone: string,
): Lead | null => {
  const target = domesticDigits(phone)
  const latest = (lead: Lead) =>
    Math.max(0, ...(lead.intakes ?? []).map((intake) => intake.at))
  return (
    leads
      .filter((lead) => domesticDigits(lead.ph ?? '') === target)
      .sort((a, b) => latest(b) - latest(a))[0] ?? null
  )
}

/** 그 리드에 같은 날 이미 등록된 상담·구매 수 — 같은 Monday 기록을 두 번
 * 보내는 것(CAPI 중복)을 막으려고 모달에서 알린다. */
export const sameDayRecordCount = (
  lead: Lead,
  kind: MondayCapiKind,
  at: number,
): number => {
  const day = toDatetimeLocalValue(at).slice(0, 10)
  const records = kind === 'consultation' ? lead.consultations : lead.purchases
  return (records ?? []).filter(
    (record) => toDatetimeLocalValue(record.at).slice(0, 10) === day,
  ).length
}
