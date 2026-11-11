import * as logger from 'firebase-functions/logger'
import { Firestore } from 'firebase-admin/firestore'
import { squash } from '../monday/fields'
import { sendChannelText } from '../works'
import { TechBoardSource } from './boards'
import { refreshItems } from './edits'
import { TechBoardMeta, TechItemDoc } from './types'

// 아톡문의 새 문의 웍스 알림(임시 — 우리 접수 폼이 열리면 폼 제출에서 보낸다).
// 아톡문의 보드에 항목이 만들어지면(webhook create_pulse·create_item) 기술팀
// 채팅방에 고객명·연락처·기기 종류·문의 종류·문의 내용과 보드 링크를 보낸다.
// 채팅방(채널 ID)과 켜고 끄기는 관리 화면이 정한다(techMeta/worksNotify).
// 항목마다 한 번만(techNotices에 먼저 적고 보낸다 — Monday가 알림을 다시 보내도
// 두 번 가지 않는다). 옛 Lightsail notify_inquiry.py를 대신한다 — 켤 때
// Lightsail 쪽을 꺼야 두 번 가지 않는다.

const SETTINGS = { collection: 'techMeta', doc: 'worksNotify' }
const NOTICES = 'techNotices'
// 만들기 알림을 보는 시간 — 이보다 오래된 항목(늦게 온 재시도 등)은 보내지 않는다
const NEW_ITEM_MS = 10 * 60 * 1000
// 만든 직후 연락처·문의 내용이 비어 있으면(폼이 만든 뒤 칸을 따로 채우는 경우) 잠깐 기다렸다 다시 읽는다
const REFILL_WAIT_MS = 3000
const CREATE_EVENTS = new Set(['create_pulse', 'create_item'])
const MONDAY_BOARD_URL = 'https://cyankorea-company.monday.com/boards'

/** 관리 화면이 정하는 알림 설정 */
export interface InquiryNotifySettings {
  enabled: boolean
  /** 10분 지연 알림(inquiry-delay.ts) — 같은 채팅방, 따로 켜고 끈다 */
  delayEnabled: boolean
  /** 보낼 채팅방 채널 ID — 봇이 그 방에 초대돼 있어야 한다 */
  channelId: string | null
  updatedAt: number | null
  updatedBy: string | null
}

const EMPTY: InquiryNotifySettings = {
  enabled: false,
  delayEnabled: false,
  channelId: null,
  updatedAt: null,
  updatedBy: null,
}

const settingsRef = (db: Firestore) =>
  db.collection(SETTINGS.collection).doc(SETTINGS.doc)

export async function getInquiryNotify(
  db: Firestore,
): Promise<InquiryNotifySettings> {
  const data = (await settingsRef(db).get()).get('inquiry') as
    | Partial<InquiryNotifySettings>
    | undefined
  return { ...EMPTY, ...data }
}

export async function setInquiryNotify(
  db: Firestore,
  input: { enabled: boolean; delayEnabled: boolean; channelId: string | null },
  editorName: string,
): Promise<InquiryNotifySettings> {
  const next: InquiryNotifySettings = {
    enabled: input.enabled,
    delayEnabled: input.delayEnabled,
    channelId: input.channelId,
    updatedAt: Date.now(),
    updatedBy: editorName,
  }
  await settingsRef(db).set({ inquiry: next }, { merge: true })
  return next
}

/** 칸 글자(제목으로 찾는다 — 공백 무시). 칸이 없으면 null */
const textOf = (meta: TechBoardMeta, doc: TechItemDoc, title: string) => {
  const column = meta.columns.find((c) => squash(c.title) === squash(title))
  return column ? (doc.values[column.id]?.text ?? '').trim() : null
}

/** 웍스 메시지 — 고객명 칸이 없으면 항목 이름 */
export function inquiryMessage(
  source: TechBoardSource,
  meta: TechBoardMeta,
  doc: TechItemDoc,
): string {
  const field = (title: string) => textOf(meta, doc, title) ?? ''
  const name = textOf(meta, doc, '고객명') || doc.name.trim()
  return [
    '[신규문의]',
    '',
    `고객명: ${name}`,
    `연락처: ${field('연락처')}`,
    `기기 종류: ${field('기기 종류')}`,
    `문의 종류: ${field('문의 종류')}`,
    `문의 내용: ${field('문의 내용')}`,
    '',
    '',
    `${MONDAY_BOARD_URL}/${source.boardId}`,
  ].join('\n')
}

const hasContent = (meta: TechBoardMeta, doc: TechItemDoc) =>
  !!(textOf(meta, doc, '연락처') || textOf(meta, doc, '문의 내용'))

/** 아톡문의 항목이 만들어졌으면 웍스로 알린다 — 꺼져 있거나 채널이 없거나 이미 보냈으면 그냥 둔다. */
export async function notifyNewInquiry(
  db: Firestore,
  apiKey: string,
  source: TechBoardSource,
  meta: TechBoardMeta,
  doc: TechItemDoc,
  eventType: string,
): Promise<void> {
  if (source.key !== 'techInquiry' || !CREATE_EVENTS.has(eventType)) return
  const created = doc.createdAt ? Date.parse(doc.createdAt) : NaN
  if (!Number.isFinite(created) || Date.now() - created > NEW_ITEM_MS) return
  const settings = await getInquiryNotify(db)
  if (!settings.enabled || !settings.channelId) return

  // 항목마다 한 번만 — 먼저 적고(이미 있으면 다른 알림이 보냈다) 보낸다.
  const notice = db.collection(NOTICES).doc(doc.itemId)
  try {
    await notice.create({
      boardKey: source.key,
      kind: 'inquiry',
      channelId: settings.channelId,
      at: Date.now(),
    })
  } catch {
    return
  }
  try {
    let latest = doc
    if (!hasContent(meta, doc)) {
      await new Promise((resolve) => setTimeout(resolve, REFILL_WAIT_MS))
      const again = await refreshItems(db, apiKey, source, [doc.itemId], meta)
      latest = again.get(doc.itemId) ?? doc
    }
    await sendChannelText(
      settings.channelId,
      inquiryMessage(source, meta, latest),
    )
  } catch (error) {
    // 못 보냈으면 기록을 지워 다음 알림(Monday 재시도) 때 다시 보낼 수 있게 한다.
    await notice.delete().catch(() => undefined)
    throw error
  }
}

/** 관리 화면 "테스트 보내기" — 지금 설정한 채널로 보기 메시지(고객 값 대신 예시) */
export async function sendInquiryTest(
  db: Firestore,
  source: TechBoardSource,
): Promise<string> {
  const settings = await getInquiryNotify(db)
  if (!settings.channelId) throw new Error('채널 ID를 먼저 저장해 주세요')
  const text = [
    '[신규문의] (테스트 메시지)',
    '',
    '고객명: 홍길동',
    '연락처: 010-0000-0000',
    '기기 종류: F2 Ultra',
    '문의 종류: 사용 방법',
    '문의 내용: 알림 형식을 확인하는 테스트예요.',
    '',
    '',
    `${MONDAY_BOARD_URL}/${source.boardId}`,
  ].join('\n')
  await sendChannelText(settings.channelId, text)
  logger.info('아톡문의 알림 테스트를 보냈다')
  return settings.channelId
}
