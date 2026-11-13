// CAPI 자동 전송의 규칙 — 어느 Monday 기록을 보낼지, 어떤 리드 값으로
// 보낼지. DB·네트워크를 쓰지 않는 함수만 둔다(실행은 run.ts).
//
// 수동 전송(리드 매니저 Monday 고객 상세의 "CAPI 전송" 모달,
// src/screens/xtool-lead-manager/utils/monday-capi.ts)과 같은 값을 만들도록
// 그 규칙을 옮겨 왔다 — 저쪽을 고치면 여기도 맞춘다.
import type { Device, Lead } from '../types'
import { squash } from '../monday/fields'
import type {
  MondayBoardKind,
  MondayConsultation,
  MondayCustomer,
  MondayPurchase,
} from '../monday/types'

/** 이 날(한국 날짜)부터 자동으로 보낸다 — 그 전 것은 사람이 수동으로 다
 * 보냈다(2026-11-10까지). */
export const CAPI_AUTO_START_DAY = '2026-11-11'

/** 실제로 Meta에 보내는지 — false면 보낼 목록만 batchRuns(/log)에 남기는
 * 미리보기다. 2026-11-13 미리보기 목록을 확인하고 실제 전송으로 켰다. */
export const CAPI_AUTO_LIVE = true

/** 한 번에 보내는 최대 건수 — 규칙이 잘못돼 한꺼번에 쏟아지는 것을 막는다.
 * 남은 것은 다음 실행에 보낸다. */
export const CAPI_AUTO_MAX_SENDS = 40

/** 같은 기록을 몇 번까지 다시 시도할지 — 넘으면 실패로 두고 그만 보낸다. */
export const CAPI_AUTO_MAX_ATTEMPTS = 3

export type AutoKind = 'consultation' | 'purchase'

/**
 * 자동으로 보내는 보드인지.
 *   - 오프라인 결제 보드(결제 보드 종류) — 결제는 모두 보낸다.
 *   - 상담 보드 중 "기타 온라인 문의"와 B2G 문의 — 상태를 보고 보낸다.
 * 보드 id 대신 이름으로 찾는다(B2G 보드는 웹 문의 보드 목록에 없다). 어느
 * 보드가 걸렸는지는 실행 결과(boards)에 남는다.
 */
export const isAutoBoard = (name: string, kind: MondayBoardKind): boolean => {
  if (kind === 'purchase') return true
  if (kind !== 'consultation') return false
  const text = squash(name).toLowerCase()
  return text.includes('기타온라인문의') || text.includes('b2g')
}

// 보내지 않는 상담 상태 — 아직 상담 전(신규 상담 유입)과 잘못 들어온 문의.
const HELD_STATUSES = new Set(['신규상담유입', '오기입'])

/** 상담을 보낼 때인지 — 상태가 비었거나 신규·오기입이면 아직 아니다. */
export const consultationReady = (record: MondayConsultation): boolean => {
  const status = squash(record.status ?? '')
  return status !== '' && !HELD_STATUSES.has(status)
}

/** 결제를 보낼지 — 취소된 결제와 금액이 없는 건(계약금 줄만 있는 등)은
 * 빼고 모두. */
export const purchaseReady = (record: MondayPurchase): boolean =>
  record.origin === 'offline' && !record.cancelled && record.amount > 0

const KST_MS = 9 * 3_600_000

/** 시각(ms)의 한국 날짜(YYYY-MM-DD). */
export const kstDay = (ms: number): string =>
  new Date(ms + KST_MS).toISOString().slice(0, 10)

/**
 * 기록의 시각(ms) — Monday 날짜 칸은 날짜뿐이라("2026-09-23"), 그날 만들어진
 * 기록이면 만든 시각(createdAt)을, 아니면 그날 낮 12시(한국)를 쓴다. 미래로는
 * 보내지 않는다(Meta가 거부한다). 수동 전송의 mondayEventTime과 같은 규칙.
 */
export const eventTimeOf = (
  date: string | null,
  createdAt: string | null,
  now: number,
): number => {
  const created = createdAt ? Date.parse(createdAt) : NaN
  const day = date?.slice(0, 10)
  let at: number
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    at = Number.isNaN(created) ? now : created
  } else if (!Number.isNaN(created) && kstDay(created) === day) {
    at = created
  } else {
    at = Date.parse(`${day}T12:00:00+09:00`)
  }
  return Math.min(at, now)
}

// Monday에 적힌 제품·보드 이름 → 리드의 기기. 공백·"xtool"을 지우고 소문자로
// 바꾼 글자에서 찾는다. 위에서부터 먼저 맞는 것 — UV·울트라가 붙은 이름이
// 그냥 F2보다 먼저다.
const DEVICE_PATTERNS: [RegExp, Device][] = [
  [/f1(ultra|울트라)/, 'F1Ultra'],
  [/f2(ultra|울트라)?uv/, 'F2UltraUV'],
  [/f2(ultra|울트라)/, 'F2Ultra'],
  [/f2/, 'F2'],
  [/p3/, 'P3'],
  [/dtf/, 'DTF'],
  [/metalfab|메탈(팹|펩)/, 'Metalfab'],
  [/m2/, 'M2'],
  [/o1/, 'o1'],
  [/wonderpress|원더프레스/, 'WonderPress'],
  [/b2g|공공기관|조달/, 'B2G'],
]

/** 글자들을 차례로 보며 처음 맞는 기기 — 하나도 없으면 "기타". */
export const deviceOf = (
  texts: readonly (string | null | undefined)[],
): Device => {
  for (const text of texts) {
    const normalized = (text ?? '').toLowerCase().replace(/\s|xtool/g, '')
    if (!normalized) continue
    const found = DEVICE_PATTERNS.find(([pattern]) => pattern.test(normalized))
    if (found) return found[1]
  }
  return '기타'
}

/** 상담의 기기들 — 관심 기기 칸에 여럿을 고르면 쉼표로 이어져 온다. 칸이
 * 비었으면 보드 이름으로 하나("B2G 문의" → B2G, "기타 온라인 문의" → 기타). */
export const consultationDevices = (record: MondayConsultation): Device[] => {
  const labels = (record.product ?? '')
    .split(',')
    .map((label) => label.trim())
    .filter(Boolean)
  if (labels.length === 0) return [deviceOf([record.boardName])]
  return [...new Set(labels.map((label) => deviceOf([label])))]
}

/** 결제의 기기 — 품목 줄 중 기기 이름이 있는 첫 줄(할인·소모품 줄은
 * 지나친다), 없으면 보드 이름. */
export const purchaseDevice = (record: MondayPurchase): Device =>
  deviceOf([
    ...record.lines
      .filter((line) => line.kind === 'product')
      .map((line) => line.product || line.name),
    record.boardName,
  ])

// 문의 폼이 빈 값을 글자 "null"로 넘긴 것이 남아 있는 경우가 있다.
const clean = (value: string | null | undefined): string => {
  const text = value?.trim() ?? ''
  return /^(null|undefined)$/i.test(text) ? '' : text
}

/** 자동으로 보낼 기록 하나. */
export type AutoCandidate = {
  kind: AutoKind
  itemId: string
  boardName: string
  /** 그 item에 적힌 이름. */
  name: string
  phone: string
  /** 보낼 이벤트 시각(ms)과 그 한국 날짜. */
  at: number
  day: string
} & (
  | { kind: 'consultation'; record: MondayConsultation }
  | { kind: 'purchase'; record: MondayPurchase }
)

/** 고객들에서 보낼 때가 된 기록을 모은다 — 오래된 것부터(같은 고객의 상담이
 * 구매보다 먼저 리드에 들어가게). */
export const collectCandidates = (
  customers: readonly MondayCustomer[],
  isTarget: (boardId: string) => boolean,
  now: number,
): AutoCandidate[] => {
  const list: AutoCandidate[] = []
  for (const customer of customers) {
    for (const record of customer.consultations) {
      if (!isTarget(record.boardId) || !consultationReady(record)) continue
      const at = eventTimeOf(record.receivedAt, record.createdAt, now)
      list.push({
        kind: 'consultation',
        itemId: record.itemId,
        boardName: record.boardName,
        name: record.name,
        phone: customer.phone,
        at,
        day: kstDay(at),
        record,
      })
    }
    for (const record of customer.purchases) {
      if (!isTarget(record.boardId) || !purchaseReady(record)) continue
      const at = eventTimeOf(record.paidAt, record.createdAt, now)
      list.push({
        kind: 'purchase',
        itemId: record.itemId,
        boardName: record.boardName,
        name: record.name,
        phone: customer.phone,
        at,
        day: kstDay(at),
        record,
      })
    }
  }
  return list.sort((a, b) => a.at - b.at)
}

/**
 * 처음 보는 기록을 어떻게 할지. 자동 전송을 처음 켠 실행(baselineDone이
 * false)에서 이미 보낼 때가 된 기록은 사람이 수동으로 보낸 것으로 치고
 * 넘어간다(baseline) — 단, 시작일(CAPI_AUTO_START_DAY) 이후 기록은 보낸다.
 * 그 뒤로 새로 보낼 때가 된 기록은 날짜와 상관없이 보낸다(예: 11/10 문의가
 * 11/12에 콜백으로 바뀌면 보낸다).
 */
export const planOf = (
  candidate: AutoCandidate,
  baselineDone: boolean,
): 'baseline' | 'send' =>
  !baselineDone && candidate.day < CAPI_AUTO_START_DAY ? 'baseline' : 'send'

/** 구매에는 UTM·fbc·fbp가 없어 그 고객의 상담에서 가져온다 — 가장 이른
 * 상담의 값(최초 유입에 가까운 것)부터, 칸마다 처음 나오는 값. */
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

/** 새 리드로 만들 때의 값 — 이름·번호·이메일은 고객(번호로 묶인 기록
 * 전체)에서, UTM·fbc·fbp는 상담이면 그 상담, 구매면 그 고객 상담들에서.
 * 수동 전송의 buildMondayCapiForm과 같다. */
export const leadFieldsOf = (
  customer: MondayCustomer,
  candidate: AutoCandidate,
): Pick<
  Lead,
  | 'fn'
  | 'ph'
  | 'em'
  | 'remarks'
  | 'utm_source'
  | 'utm_medium'
  | 'utm_campaign'
  | 'fbc'
  | 'fbp'
> => {
  const tracking =
    candidate.kind === 'consultation'
      ? {
          utm_source: clean(candidate.record.utmSource),
          utm_medium: clean(candidate.record.utmMedium),
          utm_campaign: clean(candidate.record.utmCampaign),
          fbc: clean(candidate.record.fbc),
          fbp: clean(candidate.record.fbp),
        }
      : trackingOf(customer.consultations)
  return {
    fn: customer.names[0] ?? candidate.name,
    ph: candidate.phone,
    em: (customer.emails[0] ?? '').trim().toLowerCase(),
    remarks: `Monday ${candidate.boardName} · 자동 전송`,
    ...tracking,
  }
}

/** 국내 번호로 맞춘 숫자만 — 리드의 ph와 Monday 번호를 견줄 때. */
export const domesticDigits = (phone: string): string => {
  const digits = phone.replace(/\D/g, '')
  return digits.startsWith('82') ? `0${digits.slice(2)}` : digits
}

type LeadRecords = Pick<Lead, 'consultations' | 'purchases'>

/** 리드에 이 기록을 이미 자동으로 보냈는지(상태 문서를 잃었을 때의 안전망). */
export const alreadySent = (
  lead: LeadRecords,
  candidate: AutoCandidate,
): boolean =>
  [...(lead.consultations ?? []), ...(lead.purchases ?? [])].some(
    (record) => record.auto?.itemId === candidate.itemId,
  )

/** 같은 날·같은 종류를 사람이 이미 수동으로 보냈는지 — 자동 전송을 켜기 전
 * 수동으로 보낸 오늘 기록을 두 번 보내지 않게. 자동으로 보낸 기록(auto)은
 * 세지 않는다(같은 날 문의를 두 번 한 고객은 둘 다 보낸다). */
export const sentManuallyThatDay = (
  lead: LeadRecords,
  candidate: AutoCandidate,
): boolean => {
  const records: { at: number; auto?: unknown }[] =
    candidate.kind === 'consultation'
      ? (lead.consultations ?? [])
      : (lead.purchases ?? [])
  return records.some(
    (record) => !record.auto && kstDay(record.at) === candidate.day,
  )
}

/** 로그에 남길 번호 — 가운데를 가린다(010-****-1234). */
export const maskPhone = (phone: string): string => {
  const digits = domesticDigits(phone)
  return digits.length >= 10
    ? `${digits.slice(0, 3)}-****-${digits.slice(-4)}`
    : '****'
}
