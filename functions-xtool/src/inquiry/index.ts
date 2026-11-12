// 웹사이트 상담 신청 처리 — 예전 Zapier 자동화(신청 → Monday 보드 → 문자)를
// 대신한다. 신청 1건을 inquiries/{id}에 먼저 저장하고, Monday 아이템 생성과
// 접수 안내 문자를 차례로 실행해 단계마다 결과를 남긴다. 실패한 단계는 접수
// 로그 화면(/log의 "문의 접수")에서 다시 실행한다.
import type { DocumentReference, Firestore } from 'firebase-admin/firestore'
import * as logger from 'firebase-functions/logger'
import { isMobilePhone } from '../monday/helper'
import { normalizeDomesticPhone } from '../utils'
import { createMondayItem } from './monday-write'
import { RetryError } from './retry'
import {
  LMS_SUBJECT_MAX_BYTES,
  sendSms,
  SMS_MAX_BYTES,
  smsBytes,
} from './solapi'
import {
  INQUIRY_BOARDS,
  isInquiryDevice,
  type Inquiry,
  type InquiryDevice,
  type InquiryInput,
  type InquirySettings,
  type MondayStep,
  type SmsStep,
} from './types'

export * from './types'

const INQUIRIES = 'inquiries'
const SETTINGS_DOC = 'settings/inquiry'

const DEFAULT_SETTINGS: InquirySettings = {
  // 발신 번호와 문구를 정하기 전에는 보내지 않는다.
  smsEnabled: false,
  senderNumber: '',
  template:
    '[XTOOL] {고객명}님, {기기} 상담 신청이 접수되었습니다. 담당자가 확인 후 곧 연락드리겠습니다.',
  subject: '[엑스툴] 상담 신청 접수 안내',
  updatedAt: null,
}

export interface InquirySecrets {
  mondayApiKey: string
  solapiApiKey: string
  solapiApiSecret: string
}

// ── 입력 검증 ───────────────────────────────────────────────────────────

const MAX_TEXT = 500
// 문의 내용은 여러 줄로 길게 쓰는 경우가 있어 따로 넉넉히 받는다.
const MAX_MESSAGE = 2000

const text = (
  body: Record<string, unknown>,
  key: string,
  max = MAX_TEXT,
): string => {
  const value = body[key]
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, max)
}

/** 여러 개 고를 수 있는 값 — 배열로 와도 문자열로 와도 ", "로 이어 붙인다. */
const textList = (body: Record<string, unknown>, key: string): string => {
  const value = body[key]
  if (Array.isArray(value)) {
    return value
      .filter((each): each is string => typeof each === 'string')
      .map((each) => each.trim())
      .filter(Boolean)
      .join(', ')
      .slice(0, MAX_TEXT)
  }
  return text(body, key)
}

/** 빈 값 대신 들어오는 글자들 — 예전 폼·Zapier가 "null"을 그대로 넘겼다. */
const cleanEmpty = (value: string) =>
  /^(null|undefined|ga_null)$/i.test(value) ? '' : value

/** GA ClientId — "GA_123.456"·"GA1.1.123.456"처럼 와도 숫자 부분만 남긴다. */
const cleanGaClientId = (value: string) =>
  cleanEmpty(value)
    .replace(/^GA_/i, '')
    .replace(/^GA\d\.\d\./i, '')

export const validateInquiry = (
  body: unknown,
): { ok: true; data: InquiryInput } | { ok: false; error: string } => {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'invalid request body' }
  }
  const record = body as Record<string, unknown>
  if (!isInquiryDevice(record.device)) {
    return {
      ok: false,
      error: `device must be one of: ${Object.keys(INQUIRY_BOARDS).join(', ')}`,
    }
  }
  const phone = text(record, 'phone')
  if (!phone.replace(/\D/g, '')) {
    return { ok: false, error: 'phone is required' }
  }
  const submissionId = text(record, 'submissionId')
  if (submissionId && !/^[A-Za-z0-9-]{8,64}$/.test(submissionId)) {
    return {
      ok: false,
      error: 'submissionId must be 8~64 letters, digits or -',
    }
  }
  return {
    ok: true,
    data: {
      device: record.device,
      name: text(record, 'name').slice(0, 50),
      phone,
      email: cleanEmpty(text(record, 'email')),
      installment: cleanEmpty(text(record, 'installment')),
      message: cleanEmpty(text(record, 'message', MAX_MESSAGE)),
      introPeriod: cleanEmpty(text(record, 'introPeriod')),
      company: cleanEmpty(text(record, 'company')).slice(0, 100),
      inquiryType: cleanEmpty(textList(record, 'inquiryType')),
      recommendedProduct: cleanEmpty(text(record, 'recommendedProduct')),
      purpose: cleanEmpty(text(record, 'purpose')),
      materials: cleanEmpty(textList(record, 'materials')),
      tasks: cleanEmpty(textList(record, 'tasks')),
      scale: cleanEmpty(text(record, 'scale')),
      utmCampaign: cleanEmpty(text(record, 'utmCampaign')),
      utmMedium: cleanEmpty(text(record, 'utmMedium')),
      utmSource: cleanEmpty(text(record, 'utmSource')),
      fbc: cleanEmpty(text(record, 'fbc')),
      fbp: cleanEmpty(text(record, 'fbp')),
      gaClientId: cleanGaClientId(text(record, 'gaClientId')),
      submissionId: submissionId || null,
    },
  }
}

// ── 값 정리 ─────────────────────────────────────────────────────────────

/** 숫자로 볼 수 있는 번호면 하이픈을 넣는다(010-1234-5678, 02-123-4567). */
const formatPhone = (raw: string): string => {
  const digits = normalizeDomesticPhone(raw.replace(/\D/g, ''))
  if (/^01\d{8,9}$/.test(digits)) {
    return `${digits.slice(0, 3)}-${digits.slice(3, -4)}-${digits.slice(-4)}`
  }
  if (/^02\d{7,8}$/.test(digits)) {
    return `02-${digits.slice(2, -4)}-${digits.slice(-4)}`
  }
  if (/^0\d{9,10}$/.test(digits)) {
    return `${digits.slice(0, 3)}-${digits.slice(3, -4)}-${digits.slice(-4)}`
  }
  return raw
}

const koreaToday = (ms: number) =>
  new Date(ms + 9 * 3_600_000).toISOString().slice(0, 10)

/** 문자의 {기기} — 보드의 기기 이름. 앙케이트는 추천 기기를 사람이 읽는 이름으로
 * (기기 코드면 그 보드의 이름, 모르는 값은 받은 그대로, 없으면 보드 이름). */
const deviceLabel = (
  inquiry: Pick<Inquiry, 'device' | 'recommendedProduct'>,
) => {
  const product = inquiry.recommendedProduct?.trim()
  if (inquiry.device !== 'survey' || !product) {
    return INQUIRY_BOARDS[inquiry.device].label
  }
  const code = Object.keys(INQUIRY_BOARDS).find(
    (key) => key.toLowerCase() === product.toLowerCase(),
  )
  return code ? INQUIRY_BOARDS[code as InquiryDevice].label : product
}

/** 문자 내용의 자리표시자를 실제 값으로 바꾼다. */
export const renderTemplate = (
  template: string,
  inquiry: Pick<
    Inquiry,
    'name' | 'device' | 'phoneFormatted' | 'recommendedProduct'
  >,
) =>
  template
    .split('{고객명}')
    .join(inquiry.name || '고객')
    .split('{기기}')
    .join(deviceLabel(inquiry))
    .split('{전화번호}')
    .join(inquiry.phoneFormatted)

// ── 설정 ────────────────────────────────────────────────────────────────

export const getInquirySettings = async (
  db: Firestore,
): Promise<InquirySettings> => {
  const snapshot = await db.doc(SETTINGS_DOC).get()
  return {
    ...DEFAULT_SETTINGS,
    ...(snapshot.data() as Partial<InquirySettings>),
  }
}

export const saveInquirySettings = async (
  db: Firestore,
  body: unknown,
): Promise<InquirySettings> => {
  const record = (body ?? {}) as Record<string, unknown>
  const senderNumber =
    typeof record.senderNumber === 'string'
      ? record.senderNumber.replace(/\D/g, '')
      : ''
  const template =
    typeof record.template === 'string' ? record.template.trim() : ''
  const subject =
    typeof record.subject === 'string' ? record.subject.trim() : ''
  if (typeof record.smsEnabled !== 'boolean') {
    throw new Error('smsEnabled must be boolean')
  }
  // 일반 번호(0으로 시작, 9~11자리)와 대표번호(15xx·16xx·18xx, 8자리).
  const validSender = /^(0\d{8,10}|1[5-9]\d{6})$/
  if (record.smsEnabled && !validSender.test(senderNumber)) {
    throw new Error(
      '발신 번호를 숫자로 입력해 주세요(예: 0212345678, 18771234)',
    )
  }
  if (record.smsEnabled && !template) {
    throw new Error('문자 내용을 입력해 주세요')
  }
  if (template.length > 1000) {
    throw new Error('문자 내용은 1,000자 이하로 입력해 주세요')
  }
  if (smsBytes(subject) > LMS_SUBJECT_MAX_BYTES) {
    throw new Error(
      `장문 제목은 ${LMS_SUBJECT_MAX_BYTES}byte(한글 20자) 이하로 입력해 주세요`,
    )
  }
  const settings: InquirySettings = {
    smsEnabled: record.smsEnabled,
    senderNumber,
    template,
    subject,
    updatedAt: Date.now(),
  }
  await db.doc(SETTINGS_DOC).set(settings)
  return settings
}

// ── 단계 실행 ───────────────────────────────────────────────────────────

const runMonday = async (
  inquiry: Inquiry,
  secrets: InquirySecrets,
  options: { checkFirst?: boolean } = {},
): Promise<MondayStep> => {
  try {
    const { itemId, attempts } = await createMondayItem(
      secrets.mondayApiKey,
      inquiry,
      options,
    )
    return { status: 'success', itemId, error: null, at: Date.now(), attempts }
  } catch (error) {
    logger.error('문의 Monday 등록 실패:', inquiry.id, error)
    return {
      status: 'failed',
      itemId: null,
      error: error instanceof Error ? error.message : String(error),
      at: Date.now(),
      attempts: error instanceof RetryError ? error.attempts : 1,
    }
  }
}

/** 테스트 신청 — 고객명(B2B는 회사명도)에 "테스트"나 "test"가 들어간 것.
 * 문자 비용이 드니 자동으로는 보내지 않는다(Monday 등록은 그대로). */
export const isTestInquiry = (inquiry: Pick<Inquiry, 'name' | 'company'>) =>
  /테스트|test/i.test(`${inquiry.name} ${inquiry.company ?? ''}`)

// 같은 번호로 이 시간 안에 다시 오면 자동 문자는 건너뛴다 — 상담 신청은 로그인
// 없이 들어오는 폼이라, 아무 번호로 여러 번 보내 문자 비용을 쓰게 하는 것을
// 막는다(같은 고객이 실수로 두 번 보낸 경우에도 한 번만). 화면에서 직접 보낼
// 때는 막지 않는다.
const SMS_REPEAT_MS = 10 * 60_000
const SMS_THROTTLE = 'inquirySmsThrottle'

/** 이 번호로 자동 문자를 보내도 되는지 — 되면 그 자리를 잡고(lastSentAt)
 * 풀어 줄 함수를 돌려준다(보내기가 실패하면 다음 신청이 보낼 수 있게). */
const claimSmsSlot = async (
  db: Firestore,
  to: string,
): Promise<(() => Promise<void>) | null> => {
  const ref = db.collection(SMS_THROTTLE).doc(to)
  const now = Date.now()
  const claimed = await db.runTransaction(async (tx) => {
    const last = (await tx.get(ref)).data()?.lastSentAt as number | undefined
    if (last !== undefined && now - last < SMS_REPEAT_MS) return false
    tx.set(ref, { lastSentAt: now })
    return true
  })
  return claimed ? async () => void (await ref.delete()) : null
}

const runSms = async (
  db: Firestore,
  inquiry: Inquiry,
  settings: InquirySettings,
  secrets: InquirySecrets,
  { manual = false }: { manual?: boolean } = {},
): Promise<SmsStep> => {
  const to = normalizeDomesticPhone(inquiry.phone.replace(/\D/g, ''))
  const text = renderTemplate(settings.template, inquiry)
  // 제목은 장문일 때만 — 단문에 붙이면 SOLAPI가 장문으로 바꿔 보낸다.
  const subject =
    smsBytes(text) > SMS_MAX_BYTES && settings.subject ? settings.subject : null
  const base = {
    to,
    from: settings.senderNumber || null,
    subject,
    text,
    messageId: null,
    at: Date.now(),
  }
  if (!settings.smsEnabled) {
    return { ...base, status: 'skipped', error: '문자 발송이 꺼져 있습니다' }
  }
  // 테스트는 접수 로그 화면에서 직접 보낼 때만 보낸다.
  if (!manual && isTestInquiry(inquiry)) {
    return {
      ...base,
      status: 'skipped',
      error: '테스트 신청이라 자동으로 보내지 않았습니다',
    }
  }
  if (!isMobilePhone(to)) {
    return { ...base, status: 'skipped', error: '휴대폰 번호가 아닙니다' }
  }
  const release = manual ? null : await claimSmsSlot(db, to)
  if (!manual && !release) {
    return {
      ...base,
      status: 'skipped',
      error: '같은 번호로 10분 안에 문자를 보내 자동으로는 보내지 않았습니다',
    }
  }
  try {
    const { messageId, attempts } = await sendSms({
      apiKey: secrets.solapiApiKey,
      apiSecret: secrets.solapiApiSecret,
      to,
      from: settings.senderNumber,
      text,
      subject: subject ?? undefined,
    })
    return { ...base, status: 'success', messageId, error: null, attempts }
  } catch (error) {
    logger.error('문의 문자 발송 실패:', inquiry.id, error)
    await release?.().catch(() => undefined)
    return {
      ...base,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
      attempts: error instanceof RetryError ? error.attempts : 1,
    }
  }
}

/**
 * 신청 1건 처리 — 저장 → Monday → 문자. 같은 submissionId로 다시 오면(폼
 * 두 번 제출, 네트워크 재시도) 새로 만들지 않고 처음 결과를 돌려준다.
 * Monday·문자가 실패해도 신청 자체는 저장돼 있어 화면에서 다시 실행할 수
 * 있으므로, 저장만 되면 성공으로 응답한다.
 */
export const submitInquiry = async (
  db: Firestore,
  input: InquiryInput,
  request: { ip: string; userAgent: string },
  secrets: InquirySecrets,
): Promise<{ inquiry: Inquiry; duplicate: boolean }> => {
  const ref = input.submissionId
    ? db.collection(INQUIRIES).doc(input.submissionId)
    : db.collection(INQUIRIES).doc()
  const receivedAt = Date.now()
  const { submissionId: _ignored, ...fields } = input
  void _ignored
  const board = INQUIRY_BOARDS[input.device]
  const inquiry: Inquiry = {
    ...fields,
    id: ref.id,
    receivedAt,
    receivedDate: koreaToday(receivedAt),
    updatedAt: receivedAt,
    boardId: board.boardId,
    boardName: board.label,
    phoneFormatted: formatPhone(input.phone),
    ip: request.ip,
    userAgent: request.userAgent,
    monday: { status: 'pending', itemId: null, error: null, at: null },
    sms: {
      status: 'pending',
      to: null,
      from: null,
      text: null,
      messageId: null,
      error: null,
      at: null,
    },
  }

  // create는 문서가 이미 있으면 실패한다 — 같은 제출이 동시에 두 번 와도
  // 한 번만 처리된다.
  try {
    await ref.create(inquiry)
  } catch (error) {
    if ((error as { code?: number }).code === 6) {
      const existing = (await ref.get()).data() as Inquiry
      return { inquiry: existing, duplicate: true }
    }
    throw error
  }

  inquiry.monday = await runMonday(inquiry, secrets)
  inquiry.sms = await runSms(
    db,
    inquiry,
    await getInquirySettings(db),
    secrets,
  )
  inquiry.updatedAt = Date.now()
  await ref.update({
    monday: inquiry.monday,
    sms: inquiry.sms,
    updatedAt: inquiry.updatedAt,
  })
  return { inquiry, duplicate: false }
}

// 접수 처리·다시 실행이 아직 돌고 있다고 보는 시간 — 두 함수의 제한 시간
// (120초)보다 조금 길게.
const STILL_RUNNING_MS = 3 * 60_000

/** 실패(또는 건너뛴) 단계를 다시 실행한다 — Monday는 이미 만들어졌으면
 * 다시 만들지 않는다(아이템이 두 개 생기지 않게). */
export const retryInquiryStep = async (
  db: Firestore,
  id: string,
  step: 'monday' | 'sms',
  secrets: InquirySecrets,
): Promise<Inquiry> => {
  const ref = db.collection(INQUIRIES).doc(id)
  const now = Date.now()
  // 다시 실행할 수 있는지 보고, 그 단계에 자리를 잡는다(트랜잭션) — 두 사람이
  // 같이 누르거나 한 사람이 두 번 눌러도 한 번만 돈다.
  const inquiry = await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref)
    if (!snapshot.exists) throw new Error('문의를 찾을 수 없습니다')
    const data = snapshot.data() as Inquiry & {
      retryingUntil?: Partial<Record<'monday' | 'sms', number>>
    }
    // 접수 처리(submitInquiry)가 아직 도는 중 — 이때 다시 실행하면 그 처리도
    // 문자를 보내 고객이 두 번 받고, 끝나면서 이쪽 결과를 덮어쓴다. 접수
    // 처리는 함수 제한 시간(120초) 안에 끝나므로 그 뒤로는 다시 실행할 수 있다.
    const stillRunning =
      data[step].status === 'pending' &&
      now - data.receivedAt < STILL_RUNNING_MS
    if (stillRunning) {
      throw new Error(
        '아직 접수 처리 중인 문의입니다. 2~3분 뒤 다시 시도해 주세요',
      )
    }
    if ((data.retryingUntil?.[step] ?? 0) > now) {
      throw new Error('다른 다시 실행이 진행 중입니다. 잠시 뒤 확인해 주세요')
    }
    tx.update(ref, { [`retryingUntil.${step}`]: now + STILL_RUNNING_MS })
    return data as Inquiry
  })
  try {
    return await runRetryStep(db, ref, inquiry, step, secrets)
  } finally {
    await ref.update({ [`retryingUntil.${step}`]: 0 })
  }
}

/** 다시 실행 본체 — 자리를 잡은 뒤에 부른다(retryInquiryStep). */
const runRetryStep = async (
  db: Firestore,
  ref: DocumentReference,
  inquiry: Inquiry,
  step: 'monday' | 'sms',
  secrets: InquirySecrets,
): Promise<Inquiry> => {
  if (step === 'monday') {
    if (inquiry.monday.status === 'success') {
      throw new Error('이미 Monday에 등록된 문의입니다')
    }
    // 앞선 처리가 중간에 끊겼거나 응답만 못 받았을 수 있어 먼저 확인한다.
    inquiry.monday = await runMonday(inquiry, secrets, { checkFirst: true })
    inquiry.updatedAt = Date.now()
    await ref.update({ monday: inquiry.monday, updatedAt: inquiry.updatedAt })
  } else {
    if (inquiry.sms.status === 'success') {
      throw new Error('이미 문자를 보낸 문의입니다')
    }
    inquiry.sms = await runSms(
      db,
      inquiry,
      await getInquirySettings(db),
      secrets,
      { manual: true },
    )
    inquiry.updatedAt = Date.now()
    await ref.update({ sms: inquiry.sms, updatedAt: inquiry.updatedAt })
  }
  return inquiry
}

/** 최근 문의 — 접수 로그 화면용(최근 것부터). */
export const listInquiries = async (
  db: Firestore,
  sinceMs: number,
  limit = 500,
): Promise<Inquiry[]> => {
  const snapshot = await db
    .collection(INQUIRIES)
    .where('receivedAt', '>=', sinceMs)
    .orderBy('receivedAt', 'desc')
    .limit(limit)
    .get()
  return snapshot.docs.map((doc) => doc.data() as Inquiry)
}

/** 접수 로그 화면의 이어 받기 — since(ms) 이후에 고친 문의만. */
export const listInquiriesUpdatedSince = async (
  db: Firestore,
  sinceMs: number,
  limit = 500,
): Promise<Inquiry[]> => {
  const snapshot = await db
    .collection(INQUIRIES)
    .where('updatedAt', '>=', sinceMs)
    .limit(limit)
    .get()
  return snapshot.docs.map((doc) => doc.data() as Inquiry)
}

/** 접수 기록을 지운다(접수 로그 화면의 선택 삭제). 기록만 지우고, 이미 만든
 * Monday 아이템이나 보낸 문자는 그대로다. 한 번에 최대 500건. */
export const deleteInquiries = async (
  db: Firestore,
  ids: string[],
): Promise<number> => {
  const batch = db.batch()
  for (const id of ids) batch.delete(db.collection(INQUIRIES).doc(id))
  await batch.commit()
  return ids.length
}
