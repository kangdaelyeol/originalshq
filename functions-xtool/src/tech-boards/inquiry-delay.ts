import * as logger from 'firebase-functions/logger'
import { Firestore } from 'firebase-admin/firestore'
import { squash } from '../monday/fields'
import { sendChannelText } from '../works'
import {
  DELAY_SECONDS,
  elapsedSeconds,
  inquiryColumns,
  inquiryDelayDue,
  timeTracking,
} from './inquiry-delay-due'
import { getInquiryNotify } from './inquiry-notify'
import { ApnsCredentials, pushInquiryDelay } from './push'
import { TechItemDoc } from './types'

const NOTICES = 'techNotices'
const SETTINGS = { collection: 'techMeta', doc: 'worksNotify' }
// 한 번 점검에서 보낼 수 — 몰려도 메시지가 폭주하지 않게(남은 건 다음 점검에)
const PER_RUN = 20
const MONDAY_ITEM_URL =
  'https://cyankorea-company.monday.com/boards/5030892209/pulses'

// 아톡문의 10분 지연 알림 — 상담 상태가 "신규 문의"인 채로 시간추적이 10분을 넘으면
// 기술팀 채팅방(새 문의 알림과 같은 방)과 앱 알림을 켠 폰(push.ts)에 한 번 알린다.
// 옛 Lightsail notify_overtime(5분마다 보드 전체를 Monday에서 읽음)을 대신한다.
//
// 비용: 보드 전체를 보지 않는다. 항목을 캐시에 쓸 때(webhook·동기화 — items.ts)
// "10분을 넘는 시각"(delayDueAt)을 같이 적고, 1분마다 도는 점검은 그 시각이 지난
// 항목만 한 번 묻는다(대개 0건 — 읽기 1회). 시간추적은 켜고 끌 때만 값이 바뀌어서
// 그때 미리 계산할 수 있다. 같은 값이면 같은 시각이 나오게 계산해 동기화가 다시
// 쓰지 않게 한다(멈춘 채 10분을 넘었으면 1 — 이미 지난 시각).
//
// 한 번만: 보내기 전에 techNotices/{항목}-delay(웍스)·{항목}-delay-push(앱)를 먼저
// 만든다(있으면 다른 점검이 보냈다). 둘 다 보낸 뒤 예정 시각을 비운다 — 하나가
// 실패하면 남겨 다음 점검에 그것만 다시 보낸다. 영업시간(평일 9~17시, 공휴일 빼고)에만 —
// 밤·주말에 넘긴 건은 다음 영업 시간 첫 점검에 간다. 켜고 끄기·공휴일은 관리 화면
// (techMeta/worksNotify의 inquiry.delayEnabled·holidays).

// ── 영업시간·공휴일 ───────────────────────────────────────────────────────────

/** 한국 시각의 날짜(YYYY-MM-DD)·요일(0 일요일)·시 */
function koreaNow(now: number) {
  const korea = new Date(now + 9 * 3600_000)
  return {
    date: korea.toISOString().slice(0, 10),
    weekday: korea.getUTCDay(),
    hour: korea.getUTCHours(),
  }
}

const BUSINESS_START = 9
const BUSINESS_END = 17

export async function getHolidays(db: Firestore): Promise<string[]> {
  const doc = await db.collection(SETTINGS.collection).doc(SETTINGS.doc).get()
  const dates = doc.get('holidays') as string[] | undefined
  return Array.isArray(dates) ? dates : []
}

export async function setHolidays(
  db: Firestore,
  dates: string[],
): Promise<string[]> {
  const clean = [...new Set(dates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))]
    .sort()
  await db
    .collection(SETTINGS.collection)
    .doc(SETTINGS.doc)
    .set({ holidays: clean }, { merge: true })
  return clean
}

/** 지금이 알림 보내는 때인지 — 평일 9~17시, 공휴일 빼고 */
async function isBusinessTime(db: Firestore, now: number) {
  const { date, weekday, hour } = koreaNow(now)
  if (weekday === 0 || weekday === 6) return false
  if (hour < BUSINESS_START || hour >= BUSINESS_END) return false
  return !(await getHolidays(db)).includes(date)
}

// ── 점검 ─────────────────────────────────────────────────────────────────────

const minutesText = (seconds: number) =>
  `${Math.floor(seconds / 60)}분 ${seconds % 60}초`

/** 지연 메시지 — 옛 Lightsail 형식. 연락처는 "연락처" 칸, 담당자는 담당자(엑스툴) 칸(record.assignee) */
function delayMessage(
  doc: TechItemDoc,
  columns: Array<{ id: string; title: string; type: string }>,
  elapsed: number,
  status: string,
) {
  const record = doc.record as { assignee?: string | null }
  const phoneColumn = columns.find((c) => squash(c.title) === squash('연락처'))
  const phone = phoneColumn ? (doc.values[phoneColumn.id]?.text ?? '') : ''
  return [
    '[신규문의 지연]',
    '',
    `고객명: ${doc.name.trim()}`,
    `연락처: ${phone}`,
    `담당자: ${record.assignee || '미배정'}`,
    `경과 시간: ${minutesText(elapsed)}`,
    `상담 상태: ${status}`,
    '',
    '10분을 넘겼습니다! 담당자님 확인해주세요!!',
    '',
    `${MONDAY_ITEM_URL}/${doc.itemId}`,
  ].join('\n')
}

export interface DelayCheckResult {
  skipped: string | null
  due: number
  sent: number
  cleared: number
  errors: number
}

/** 1분마다 — 예정 시각이 지난 항목만 읽어 보내고, 보낸(또는 더 볼 일 없는) 항목은 예정 시각을 비운다. */
export async function checkInquiryDelays(
  db: Firestore,
  columns: Array<{ id: string; title: string; type: string }>,
  groupTitleOf: (groupId: string | null) => string | null,
  options: { apns?: ApnsCredentials; now?: number } = {},
): Promise<DelayCheckResult> {
  const now = options.now ?? Date.now()
  const result: DelayCheckResult = {
    skipped: null,
    due: 0,
    sent: 0,
    cleared: 0,
    errors: 0,
  }
  // 웍스(채팅방이 있을 때)와 앱 푸시(APNs 비밀 값이 있을 때)를 같은 스위치·영업시간으로 —
  // 켤 때 이미 넘은 건을 보낸 것으로 기록하는 일(baseline)이 둘 다를 막아 옛 건이 몰려 가지 않는다.
  const settings = await getInquiryNotify(db)
  const channelId = settings.delayEnabled ? settings.channelId : null
  const apns = settings.delayEnabled ? options.apns : undefined
  if (!channelId && !apns) {
    result.skipped = '꺼짐'
    return result
  }
  if (!(await isBusinessTime(db, now))) {
    result.skipped = '영업시간 아님'
    return result
  }
  const snap = await db
    .collection('techItems')
    .where('delayDueAt', '<=', now)
    .limit(PER_RUN)
    .get()
  result.due = snap.size
  const { statusId } = inquiryColumns(columns)
  for (const item of snap.docs) {
    const doc = item.data() as TechItemDoc
    const clear = () =>
      item.ref.update({ delayDueAt: null }).then(() => {
        result.cleared += 1
      })
    // 받은 뒤 바뀌었을 수 있다 — 지금 값으로 다시 본다.
    const dueAt = doc.boardKey === 'techInquiry' ?
      inquiryDelayDue(columns, doc.values, groupTitleOf(doc.groupId)) :
      null
    if (dueAt === null || dueAt > now) {
      await clear()
      continue
    }
    const timer = inquiryColumns(columns).timerId
    const t = timer ? timeTracking(doc.values[timer]) : null
    const elapsed = t ? elapsedSeconds(t, now) : DELAY_SECONDS
    const status = statusId ? (doc.values[statusId]?.text ?? '') : ''
    const record = doc.record as { assignee?: string | null }
    // 웍스·앱 푸시는 따로 한 번씩(각자 기록을 먼저 만든다) — 하나가 실패하면 예정 시각을
    // 남겨 다음 점검에 그것만 다시 보낸다(보낸 쪽은 기록이 있어 건너뛴다).
    const works = () =>
      sendChannelText(
        channelId as string,
        delayMessage(doc, columns, elapsed, status),
      )
    const push = () =>
      pushInquiryDelay(db, apns as ApnsCredentials, doc.itemId, {
        name: doc.name,
        assignee: record.assignee ?? '',
        elapsed: `${Math.floor(elapsed / 60)}분`,
        status,
      })
    const outcomes = await Promise.all([
      channelId ?
        sendOnce(db, `${doc.itemId}-delay`, {
          kind: 'delay',
          at: now,
          channelId,
        }, works) :
        null,
      apns ?
        sendOnce(db, `${doc.itemId}-delay-push`, {
          kind: 'delay-push',
          at: now,
        }, push) :
        null,
    ])
    if (outcomes.includes('sent')) result.sent += 1
    const failed = outcomes.filter((o) => o instanceof Error)
    if (failed.length > 0) {
      result.errors += 1
      failed.forEach((error) =>
        logger.error(`아톡문의 지연 알림 실패(${doc.itemId}):`, error),
      )
    } else {
      await clear()
    }
  }
  return result
}

/** 기록(techNotices/{id})을 먼저 만들고 보낸다 — 이미 있으면 'done', 보냈으면 'sent', 실패하면
 * 기록을 지우고 그 오류(다음 점검에 다시 보낸다) */
async function sendOnce(
  db: Firestore,
  id: string,
  record: Record<string, unknown>,
  send: () => Promise<unknown>,
): Promise<'sent' | 'done' | Error> {
  const notice = db.collection(NOTICES).doc(id)
  try {
    await notice.create(record)
  } catch {
    return 'done'
  }
  try {
    await send()
    return 'sent'
  } catch (error) {
    await notice.delete().catch(() => undefined)
    return error instanceof Error ? error : new Error(String(error))
  }
}

/**
 * 지연 알림을 켤 때 — 지금 이미 10분을 넘어 있는 건(켜기 전·옛 Lightsail이 이미 알린
 * 건)은 보낸 것으로 기록만 해 한꺼번에 몰려 가지 않게 한다. 예정 시각이 아직 안 적힌
 * 문서(배포 직후)도 있어서 아톡문의 항목을 직접 보고 계산한다(켤 때 한 번).
 */
export async function baselineInquiryDelays(
  db: Firestore,
  columns: Array<{ id: string; title: string; type: string }>,
  groupTitleOf: (groupId: string | null) => string | null,
  now = Date.now(),
): Promise<number> {
  const snap = await db
    .collection('techItems')
    .where('boardKey', '==', 'techInquiry')
    .get()
  let count = 0
  for (const item of snap.docs) {
    const doc = item.data() as TechItemDoc
    const group = groupTitleOf(doc.groupId)
    const dueAt = inquiryDelayDue(columns, doc.values, group)
    if (dueAt === null || dueAt > now) continue
    await Promise.all(
      ['delay', 'delay-push'].map((kind) =>
        db
          .collection(NOTICES)
          .doc(`${item.id}-${kind}`)
          .set({ kind, at: now, baseline: true }, { merge: true }),
      ),
    )
    await item.ref.update({ delayDueAt: null })
    count += 1
  }
  return count
}
