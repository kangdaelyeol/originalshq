// 웹사이트 상담 신청 처리 — 예전 Zapier 자동화(신청 → Monday 보드 → 문자)를
// 대신한다. 신청 1건을 inquiries/{id}에 먼저 저장하고, Monday 아이템 생성과
// 접수 안내 문자를 차례로 실행해 단계마다 결과를 남긴다. 실패한 단계는 접수
// 로그 화면(/log의 "문의 접수")에서 다시 실행한다.
import type { Firestore } from 'firebase-admin/firestore'
import * as logger from 'firebase-functions/logger'
import { isMobilePhone } from '../monday/helper'
import { normalizeDomesticPhone } from '../utils'
import { createMondayItem } from './monday-write'
import { sendSms } from './solapi'
import {
  INQUIRY_BOARDS,
  isInquiryDevice,
  type Inquiry,
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

/** 문자 내용의 자리표시자를 실제 값으로 바꾼다. */
export const renderTemplate = (
  template: string,
  inquiry: Pick<Inquiry, 'name' | 'device' | 'phoneFormatted'>,
) =>
  template
    .split('{고객명}')
    .join(inquiry.name || '고객')
    .split('{기기}')
    .join(INQUIRY_BOARDS[inquiry.device].label)
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
  const settings: InquirySettings = {
    smsEnabled: record.smsEnabled,
    senderNumber,
    template,
    updatedAt: Date.now(),
  }
  await db.doc(SETTINGS_DOC).set(settings)
  return settings
}

// ── 단계 실행 ───────────────────────────────────────────────────────────

const runMonday = async (
  inquiry: Inquiry,
  secrets: InquirySecrets,
): Promise<MondayStep> => {
  try {
    const itemId = await createMondayItem(secrets.mondayApiKey, inquiry)
    return { status: 'success', itemId, error: null, at: Date.now() }
  } catch (error) {
    logger.error('문의 Monday 등록 실패:', inquiry.id, error)
    return {
      status: 'failed',
      itemId: null,
      error: error instanceof Error ? error.message : String(error),
      at: Date.now(),
    }
  }
}

const runSms = async (
  inquiry: Inquiry,
  settings: InquirySettings,
  secrets: InquirySecrets,
): Promise<SmsStep> => {
  const to = normalizeDomesticPhone(inquiry.phone.replace(/\D/g, ''))
  const base = {
    to,
    from: settings.senderNumber || null,
    text: renderTemplate(settings.template, inquiry),
    messageId: null,
    at: Date.now(),
  }
  if (!settings.smsEnabled) {
    return { ...base, status: 'skipped', error: '문자 발송이 꺼져 있습니다' }
  }
  if (!isMobilePhone(to)) {
    return { ...base, status: 'skipped', error: '휴대폰 번호가 아닙니다' }
  }
  try {
    const messageId = await sendSms({
      apiKey: secrets.solapiApiKey,
      apiSecret: secrets.solapiApiSecret,
      to,
      from: settings.senderNumber,
      text: base.text,
    })
    return { ...base, status: 'success', messageId, error: null }
  } catch (error) {
    logger.error('문의 문자 발송 실패:', inquiry.id, error)
    return {
      ...base,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
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
  inquiry.sms = await runSms(inquiry, await getInquirySettings(db), secrets)
  await ref.update({ monday: inquiry.monday, sms: inquiry.sms })
  return { inquiry, duplicate: false }
}

/** 실패(또는 건너뛴) 단계를 다시 실행한다 — Monday는 이미 만들어졌으면
 * 다시 만들지 않는다(아이템이 두 개 생기지 않게). */
export const retryInquiryStep = async (
  db: Firestore,
  id: string,
  step: 'monday' | 'sms',
  secrets: InquirySecrets,
): Promise<Inquiry> => {
  const ref = db.collection(INQUIRIES).doc(id)
  const snapshot = await ref.get()
  if (!snapshot.exists) throw new Error('문의를 찾을 수 없습니다')
  const inquiry = snapshot.data() as Inquiry
  if (step === 'monday') {
    if (inquiry.monday.status === 'success') {
      throw new Error('이미 Monday에 등록된 문의입니다')
    }
    inquiry.monday = await runMonday(inquiry, secrets)
    await ref.update({ monday: inquiry.monday })
  } else {
    if (inquiry.sms.status === 'success') {
      throw new Error('이미 문자를 보낸 문의입니다')
    }
    inquiry.sms = await runSms(inquiry, await getInquirySettings(db), secrets)
    await ref.update({ sms: inquiry.sms })
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
