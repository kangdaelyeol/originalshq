import { createHash, sign } from 'crypto'
import * as http2 from 'http2'
import * as logger from 'firebase-functions/logger'
import { Firestore } from 'firebase-admin/firestore'
import { squash } from '../monday/fields'
import { findAssigneeColumn, peopleNames } from './assignees'
import { TechBoardSource } from './boards'
import { Editor, updateTechItem } from './edits'
import { TechEditError } from './errors'
import { getBoardMeta, getItem, getMember } from './firestore'
import { TechBoardMeta, TechItemDoc } from './types'

// 앱 푸시(iOS, APNs 직접) — 아톡문의에 새 문의가 만들어지면 앱을 깐 기술팀 폰에 알림을 띄우고,
// 알림의 "내가 맡기" 단추로 담당자(엑스툴)를 누른 사람으로, 상담 상태를 "1차 안내"로 바꾼다.
//
// - 기기: 앱이 로그인한 뒤 알림을 허락하면 techRegisterPush로 등록한다(techPushDevices/{기기 id}).
//   알림을 끄거나 로그아웃하면 지운다. 기기마다 앱이 만든 비밀 값의 해시를 함께 둔다 — 알림
//   단추는 앱을 열지 않고(로그인 토큰 없이) Swift 코드가 바로 부르므로, 이 비밀 값으로 누가
//   눌렀는지 확인한다(등록은 로그인한 구성원만 할 수 있어 비밀 값 ↔ 구성원이 묶인다).
// - 보내기: Monday webhook(만들기 알림)에서 웍스 알림과 따로 — 항목마다 한 번(techNotices/
//   {항목}-push를 먼저 만든다). 받는 사람은 등록된 기기 전부(구성원이 지금도 기술팀인지 본다).
// - 맡기: 이미 담당자가 있으면 바꾸지 않고 알린다. 두 사람이 같이 눌러도 한 사람만 맡는다
//   (techNotices/{항목}-claim을 먼저 만든 쪽). 상태는 지금이 "신규 문의"일 때만 바꾼다 — 그룹
//   이동·"1차 안내일"은 Monday가 보내는 변경 알림을 받아 보드 규칙(rules.ts)이 맞춘다.
// - 비밀 값: APNS_KEY(Apple 개발자 사이트에서 만든 .p8 키 파일 내용), APNS_KEY_ID(그 키 ID).
// - 눈에 띄게(2026-11-13): 시간 민감 알림(집중 모드·알림 요약을 지나 바로 뜬다), 신규·지연마다
//   다른 알림음(앱 모듈 xtool-push/sounds — 소리 파일이 없는 옛 앱은 기본 소리), 제목 앞 표시.

/** Apple 개발자 팀 ID — 앱 서명 팀(비밀 아님) */
const APNS_TEAM_ID = 'UH6A8VQ5HY'
/** 앱 번들 ID — 알림의 대상(apns-topic) */
const APP_BUNDLE_ID = 'com.originalshq.xtooltech'
const APNS_HOST = {
  production: 'api.push.apple.com',
  sandbox: 'api.sandbox.push.apple.com',
} as const
type PushEnv = keyof typeof APNS_HOST

const DEVICES = 'techPushDevices'
const NOTICES = 'techNotices'
/** 알림 종류(앱이 등록한 단추 묶음 이름) — Swift XtoolPushCenter와 같게 */
const CATEGORY = 'TECH_INQUIRY'
const CREATE_EVENTS = new Set(['create_pulse', 'create_item'])
/** 웍스 알림(inquiry-notify.ts)과 같은 기준 — 늦게 온 만들기 알림은 보내지 않는다 */
const NEW_ITEM_MS = 10 * 60 * 1000
/** 연락처·문의 내용이 아직 비었으면 기다렸다가 캐시를 다시 읽는다(폼이 칸을 따로 채운다) */
const REFILL_WAIT_MS = 3000
/** APNs 토큰 서명은 20~60분 사이에 새로 — 40분마다 */
const JWT_TTL_MS = 40 * 60 * 1000
/** 알림 본문 길이 — APNs 4KB 안에서 넉넉하게 */
const BODY_MAX = 240
/** 같이 누른 사람을 가르는 잠금이 유효한 시간 — 지나면(담당자를 나중에 지운 경우 등) 새로 잠근다 */
const CLAIM_LOCK_MS = 2 * 60 * 1000
const STATUS_TITLE = '상담 상태'
const STATUS_NEW = '신규 문의'
const STATUS_FIRST = '1차 안내'

/** 알림 종류마다 소리·제목 앞 표시 — 소리 파일은 앱 번들에 든 이름(xtool-push/sounds) */
const ALERT_STYLE = {
  new: { sound: 'tech-new.caf', mark: '🔔' },
  delay: { sound: 'tech-delay.caf', mark: '🚨' },
} as const
type AlertKind = keyof typeof ALERT_STYLE

interface AlertText {
  title: string
  subtitle?: string
  body: string
}

/** 아톡문의 알림의 aps — 제목 앞 표시, 종류별 소리, 시간 민감(방해 금지·집중 모드에서도
 * 뜬다, 앱에 권한이 없으면 보통 알림으로), "내가 맡기" 단추 묶음, 아톡문의끼리 묶기 */
const inquiryAps = (kind: AlertKind, alert: AlertText) => ({
  'alert': { ...alert, title: `${ALERT_STYLE[kind].mark} ${alert.title}` },
  'sound': ALERT_STYLE[kind].sound,
  'interruption-level': 'time-sensitive',
  'category': CATEGORY,
  'thread-id': 'techInquiry',
})

export interface ApnsCredentials {
  /** .p8 키 내용(PEM) */
  key: string
  keyId: string
}

interface PushDeviceDoc {
  token: string
  env: PushEnv
  uid: string
  email: string
  name: string
  secretHash: string
  platform: 'ios'
  createdAt: number
  updatedAt: number
}

const hashSecret = (secret: string) =>
  createHash('sha256').update(secret).digest('hex')

// ── APNs 보내기 ──────────────────────────────────────────────────────────────

const b64url = (data: Buffer | string) =>
  Buffer.from(data).toString('base64url')

let jwtCache: { keyId: string; token: string; at: number } | null = null

/** APNs 인증 토큰(ES256 JWT) — 인스턴스마다 40분 동안 다시 쓴다 */
function apnsJwt(creds: ApnsCredentials): string {
  const now = Date.now()
  if (
    jwtCache &&
    jwtCache.keyId === creds.keyId &&
    now - jwtCache.at < JWT_TTL_MS
  ) {
    return jwtCache.token
  }
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: creds.keyId }))
  const claims = b64url(
    JSON.stringify({ iss: APNS_TEAM_ID, iat: Math.floor(now / 1000) }),
  )
  const data = `${header}.${claims}`
  // JWS ES256 서명은 DER가 아니라 r‖s 64바이트(ieee-p1363)
  const signature = sign('sha256', Buffer.from(data), {
    key: creds.key.replace(/\\n/g, '\n'),
    dsaEncoding: 'ieee-p1363',
  })
  const token = `${data}.${b64url(signature)}`
  jwtCache = { keyId: creds.keyId, token, at: now }
  return token
}

interface ApnsResult {
  status: number
  reason?: string
}

interface ApnsMessage {
  token: string
  payload: Record<string, unknown>
  collapseId?: string
}

/** 한 호스트에 여러 건 — HTTP/2 연결 하나로 같이 보내고 닫는다 */
async function sendBatch(
  creds: ApnsCredentials,
  env: PushEnv,
  messages: ApnsMessage[],
): Promise<ApnsResult[]> {
  if (messages.length === 0) return []
  const session = http2.connect(`https://${APNS_HOST[env]}`)
  const failed = new Promise<never>((_, reject) => {
    session.once('error', reject)
  })
  // 다 보낸 뒤 연결이 끊겨도 처리 안 된 거절로 남지 않게
  failed.catch(() => undefined)
  try {
    const jwt = apnsJwt(creds)
    const expiration = Math.floor(Date.now() / 1000) + 3600
    return await Promise.race([
      Promise.all(
        messages.map(
          (message) =>
            new Promise<ApnsResult>((resolve, reject) => {
              const request = session.request({
                ':method': 'POST',
                ':path': `/3/device/${message.token}`,
                'authorization': `bearer ${jwt}`,
                'apns-topic': APP_BUNDLE_ID,
                'apns-push-type': 'alert',
                'apns-priority': '10',
                'apns-expiration': String(expiration),
                ...(message.collapseId ?
                  { 'apns-collapse-id': message.collapseId.slice(0, 64) } :
                  {}),
              })
              let status = 0
              let body = ''
              request.setEncoding('utf8')
              request.on('response', (headers) => {
                status = Number(headers[':status'] ?? 0)
              })
              request.on('data', (chunk: string) => {
                body += chunk
              })
              request.on('end', () => {
                let reason: string | undefined
                try {
                  reason = body ?
                    (JSON.parse(body) as { reason?: string }).reason :
                    undefined
                } catch {
                  reason = body || undefined
                }
                resolve({ status, reason })
              })
              request.on('error', reject)
              request.setTimeout(15_000, () => {
                request.close(http2.constants.NGHTTP2_CANCEL)
                reject(new Error('APNs 응답 시간 초과'))
              })
              request.end(JSON.stringify(message.payload))
            }),
        ),
      ),
      failed,
    ])
  } finally {
    session.close()
  }
}

/** 이 토큰은 더 쓸 수 없다(앱을 지웠거나 토큰이 바뀌었다) */
const isDeadToken = (result: ApnsResult) =>
  result.status === 410 ||
  (result.status === 400 &&
    (result.reason === 'BadDeviceToken' ||
      result.reason === 'DeviceTokenNotForTopic'))

/**
 * 기기 여러 대에 같은 알림 — 개발판(sandbox)·배포판(production) 토큰을 나눠 보내고, 환경을
 * 잘못 안 토큰(BadDeviceToken)은 다른 쪽으로 한 번 더 보내 맞으면 고쳐 적는다. 죽은 토큰은
 * 지운다. 보낸 기기 수.
 */
async function sendToDevices(
  db: Firestore,
  creds: ApnsCredentials,
  devices: Array<{ id: string; doc: PushDeviceDoc }>,
  build: (device: PushDeviceDoc) => ApnsMessage,
): Promise<number> {
  let sent = 0
  const retry: Array<{ id: string; doc: PushDeviceDoc }> = []
  const removals: Promise<unknown>[] = []
  for (const env of Object.keys(APNS_HOST) as PushEnv[]) {
    const group = devices.filter((d) => d.doc.env === env)
    const results = await sendBatch(
      creds,
      env,
      group.map((d) => build(d.doc)),
    )
    results.forEach((result, i) => {
      const device = group[i]
      if (result.status === 200) sent += 1
      else if (result.status === 400 && result.reason === 'BadDeviceToken') {
        retry.push(device)
      } else {
        logger.warn('앱 푸시 실패:', { device: device.id, ...result })
        if (isDeadToken(result)) {
          const ref = db.collection(DEVICES).doc(device.id)
          removals.push(ref.delete().catch(() => undefined))
        }
      }
    })
  }
  for (const device of retry) {
    const other: PushEnv =
      device.doc.env === 'production' ? 'sandbox' : 'production'
    const [result] = await sendBatch(creds, other, [build(device.doc)])
    if (result?.status === 200) {
      sent += 1
      await db
        .collection(DEVICES)
        .doc(device.id)
        .update({ env: other, updatedAt: Date.now() })
        .catch(() => undefined)
    } else {
      logger.warn('앱 푸시 실패(토큰 지움):', { device: device.id, ...result })
      await db
        .collection(DEVICES)
        .doc(device.id)
        .delete()
        .catch(() => undefined)
    }
  }
  await Promise.all(removals)
  return sent
}

// ── 기기 등록 ─────────────────────────────────────────────────────────────────

export interface PushRegisterInput {
  deviceId: string
  secret: string
  token: string
  env: string
}

const DEVICE_ID = /^[A-Za-z0-9-]{8,64}$/
const DEVICE_TOKEN = /^[0-9a-f]{32,400}$/i

/** 로그인한 구성원의 이 기기를 받는 사람으로 — 같은 토큰으로 남은 옛 등록은 지운다(앱을 다시 깐 경우) */
export async function registerPushDevice(
  db: Firestore,
  editor: Editor,
  input: PushRegisterInput,
): Promise<void> {
  const deviceId = String(input?.deviceId ?? '')
  const secret = String(input?.secret ?? '')
  const token = String(input?.token ?? '').toLowerCase()
  const env = String(input?.env ?? '')
  if (!DEVICE_ID.test(deviceId)) throw new TechEditError('기기 id가 이상해요')
  if (secret.length < 32 || secret.length > 200) {
    throw new TechEditError('기기 비밀 값이 이상해요')
  }
  if (!DEVICE_TOKEN.test(token)) throw new TechEditError('알림 토큰이 이상해요')
  if (env !== 'production' && env !== 'sandbox') {
    throw new TechEditError('알림 환경이 이상해요')
  }
  const ref = db.collection(DEVICES).doc(deviceId)
  const before = await ref.get()
  const now = Date.now()
  const doc: PushDeviceDoc = {
    token,
    env,
    uid: editor.uid,
    email: editor.email,
    name: editor.name,
    secretHash: hashSecret(secret),
    platform: 'ios',
    createdAt: (before.get('createdAt') as number | undefined) ?? now,
    updatedAt: now,
  }
  await ref.set(doc)
  const same = await db.collection(DEVICES).where('token', '==', token).get()
  await Promise.all(
    same.docs.filter((d) => d.id !== deviceId).map((d) => d.ref.delete()),
  )
}

/** 이 기기 등록 풀기 — 알림을 껐거나 로그아웃. 다른 사람이 등록한 기기면 그냥 둔다 */
export async function unregisterPushDevice(
  db: Firestore,
  editor: Editor,
  deviceId: string,
): Promise<void> {
  if (!DEVICE_ID.test(String(deviceId ?? ''))) return
  const ref = db.collection(DEVICES).doc(deviceId)
  const doc = await ref.get()
  if (doc.exists && doc.get('uid') === editor.uid) await ref.delete()
}

/** 등록된 기기 중 지금도 기술팀(또는 관리자)인 사람 것만 */
async function activeDevices(db: Firestore, onlyUid?: string) {
  const query = onlyUid ?
    db.collection(DEVICES).where('uid', '==', onlyUid) :
    db.collection(DEVICES)
  const snap = await query.get()
  const devices = snap.docs.map((d) => ({
    id: d.id,
    doc: d.data() as PushDeviceDoc,
  }))
  const emails = [...new Set(devices.map((d) => d.doc.email))]
  const members = new Map(
    await Promise.all(
      emails.map(async (email) => [email, await getMember(db, email)] as const),
    ),
  )
  return devices.filter((d) => {
    const member = members.get(d.doc.email)
    return (
      member?.status === 'active' &&
      member.mustChangePassword !== true &&
      (member.isAdmin || member.teams?.tech === true)
    )
  })
}

// ── 신규 문의 알림 ─────────────────────────────────────────────────────────────

/** 칸 글자(제목으로 찾는다 — 공백 무시). 칸이 없으면 null */
const textOf = (meta: TechBoardMeta, doc: TechItemDoc, title: string) => {
  const column = meta.columns.find((c) => squash(c.title) === squash(title))
  return column ? (doc.values[column.id]?.text ?? '').trim() : null
}

const clip = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text

/** 알림 내용 — 제목 "신규 문의 · 고객명", 부제 기기·문의 종류, 본문 문의 내용(없으면 연락처) */
function inquiryAlert(meta: TechBoardMeta, doc: TechItemDoc): AlertText {
  const name = textOf(meta, doc, '고객명') || doc.name.trim() || '이름 없음'
  const subtitle = [textOf(meta, doc, '기기 종류'), textOf(meta, doc, '문의 종류')]
    .filter(Boolean)
    .join(' · ')
  const body =
    textOf(meta, doc, '문의 내용') ||
    (textOf(meta, doc, '연락처') ? `연락처 ${textOf(meta, doc, '연락처')}` : '') ||
    '문의 내용이 비어 있어요'
  return {
    title: `신규 문의 · ${clip(name, 40)}`,
    ...(subtitle ? { subtitle: clip(subtitle, 80) } : {}),
    body: clip(body.replace(/\s+/g, ' '), BODY_MAX),
  }
}

const hasContent = (meta: TechBoardMeta, doc: TechItemDoc) =>
  !!(textOf(meta, doc, '연락처') || textOf(meta, doc, '문의 내용'))

const inquiryMessage =
  (meta: TechBoardMeta, doc: TechItemDoc) =>
    (device: PushDeviceDoc): ApnsMessage => ({
      token: device.token,
      collapseId: `inquiry-${doc.itemId}`,
      payload: {
        'aps': inquiryAps('new', inquiryAlert(meta, doc)),
        'itemId': doc.itemId,
        'boardKey': 'techInquiry',
      },
    })

/** 아톡문의 항목이 만들어졌으면 등록된 기기에 알린다 — 이미 보냈으면 그냥 둔다. 보낸 기기 수 */
export async function pushNewInquiry(
  db: Firestore,
  creds: ApnsCredentials,
  source: TechBoardSource,
  meta: TechBoardMeta,
  doc: TechItemDoc,
  eventType: string,
): Promise<number> {
  if (source.key !== 'techInquiry' || !CREATE_EVENTS.has(eventType)) return 0
  const created = doc.createdAt ? Date.parse(doc.createdAt) : NaN
  if (!Number.isFinite(created) || Date.now() - created > NEW_ITEM_MS) return 0
  const devices = await activeDevices(db)
  if (devices.length === 0) return 0

  // 항목마다 한 번만 — 먼저 적고(이미 있으면 다른 알림이 보냈다) 보낸다.
  const notice = db.collection(NOTICES).doc(`${doc.itemId}-push`)
  try {
    await notice.create({ boardKey: source.key, kind: 'push', at: Date.now() })
  } catch {
    return 0
  }
  try {
    let latest = doc
    if (!hasContent(meta, doc)) {
      // 폼이 칸을 채우면 Monday가 변경 알림을 보내 캐시가 맞춰진다 — 그 뒤 캐시를 다시 읽는다.
      await new Promise((resolve) => setTimeout(resolve, REFILL_WAIT_MS))
      latest = (await getItem(db, doc.itemId)) ?? doc
    }
    return await sendToDevices(db, creds, devices, inquiryMessage(meta, latest))
  } catch (error) {
    await notice.delete().catch(() => undefined)
    throw error
  }
}

/** 아톡문의 10분 지연 알림(inquiry-delay.ts가 부른다) — 앱 알림을 켠 기기 전부에. 웍스 지연 알림과 같은 때
 * (관리 화면 "10분 지연 알림"이 켜져 있고 평일 9~17시)에 보낸다. "내가 맡기" 단추는 새 문의 알림과 같다 */
export interface DelayAlertInfo {
  name: string
  /** 담당자(엑스툴) — 없으면 빈 글자 */
  assignee: string
  /** "12분"처럼 */
  elapsed: string
  status: string
}

/** 보낸 기기 수 — 받을 기기가 없으면 0(실패 아님) */
export async function pushInquiryDelay(
  db: Firestore,
  creds: ApnsCredentials,
  itemId: string,
  info: DelayAlertInfo,
): Promise<number> {
  const devices = await activeDevices(db)
  if (devices.length === 0) return 0
  const alert: AlertText = {
    title: `신규 문의 지연 · ${clip(info.name.trim() || '이름 없음', 40)}`,
    subtitle: [
      `${info.elapsed} 경과`,
      `담당 ${info.assignee || '미배정'}`,
      info.status,
    ]
      .filter(Boolean)
      .join(' · '),
    body: '10분을 넘겼습니다! 담당자님 확인해주세요!!',
  }
  return sendToDevices(db, creds, devices, (device) => ({
    token: device.token,
    collapseId: `delay-${itemId}`,
    payload: {
      'aps': inquiryAps('delay', alert),
      'itemId': itemId,
      'boardKey': 'techInquiry',
    },
  }))
}

/** 설정 화면 "테스트 알림" — 부른 사람의 기기에만 예시 알림(단추는 누르면 "테스트예요"만 알린다) */
export async function pushTest(
  db: Firestore,
  creds: ApnsCredentials,
  editor: Editor,
): Promise<number> {
  const devices = await activeDevices(db, editor.uid)
  if (devices.length === 0) {
    throw new TechEditError('이 계정으로 알림을 받는 기기가 없어요 — 앱에서 알림을 먼저 켜 주세요')
  }
  return sendToDevices(db, creds, devices, (device) => ({
    token: device.token,
    payload: {
      'aps': inquiryAps('new', {
        title: '신규 문의 · 홍길동 (테스트)',
        subtitle: 'F2 Ultra · 사용 방법',
        body: '알림이 잘 오는지 확인하는 테스트예요. ' +
          '길게 누르면 "내가 맡기" 단추가 보여요.',
      }),
      'itemId': 'test',
      'boardKey': 'techInquiry',
    },
  }))
}

// ── 알림 단추: 내가 맡기 ─────────────────────────────────────────────────────────

export interface PushActionInput {
  deviceId: string
  secret: string
  itemId: string
  action: string
}

/** 단추 결과 — 앱이 그대로 알림으로 띄운다 */
export interface PushActionResult {
  ok: boolean
  title: string
  message: string
}

export class PushActionError extends Error {
  constructor(
    readonly status: number,
    readonly result: PushActionResult,
  ) {
    super(result.message)
  }
}

const refuse = (status: number, title: string, message: string) =>
  new PushActionError(status, { ok: false, title, message })

/** 단추를 누른 기기 → 그 구성원(비밀 값이 맞고 지금도 기술팀) */
async function editorOfDevice(
  db: Firestore,
  deviceId: string,
  secret: string,
): Promise<Editor> {
  const unknown = refuse(
    403,
    '맡지 못했어요',
    '이 기기의 알림 등록이 풀렸어요. 앱 설정에서 알림을 다시 켜 주세요',
  )
  if (!DEVICE_ID.test(deviceId) || !secret) throw unknown
  const device = await db.collection(DEVICES).doc(deviceId).get()
  if (!device.exists || device.get('secretHash') !== hashSecret(secret)) {
    throw unknown
  }
  const data = device.data() as PushDeviceDoc
  const member = await getMember(db, data.email)
  const allowed =
    member?.status === 'active' &&
    member.mustChangePassword !== true &&
    (member.isAdmin || member.teams?.tech === true)
  if (!member || !allowed) {
    throw refuse(403, '맡지 못했어요', '권한이 없는 계정이에요')
  }
  return { email: member.email, name: member.name, uid: data.uid }
}

/**
 * 내가 맡기 — 담당자(엑스툴)가 비었으면 누른 사람으로, 상담 상태가 "신규 문의"면 "1차 안내"로.
 * 이미 다른 담당자가 있으면 바꾸지 않고 알린다.
 */
export async function claimInquiry(
  db: Firestore,
  apiKey: string,
  input: PushActionInput,
): Promise<PushActionResult> {
  if (input?.action !== 'claim') {
    throw refuse(400, '처리하지 못했어요', '모르는 단추예요')
  }
  const editor = await editorOfDevice(
    db,
    String(input.deviceId ?? ''),
    String(input.secret ?? ''),
  )
  const itemId = String(input.itemId ?? '')
  if (itemId === 'test') {
    return {
      ok: true,
      title: '테스트예요',
      message: `${editor.name}님 기기에서 단추가 잘 눌렸어요. 실제 문의는 담당자·상태가 바뀌어요`,
    }
  }
  if (!/^\d+$/.test(itemId)) throw refuse(400, '맡지 못했어요', '문의를 찾지 못했어요')

  const [meta, doc] = await Promise.all([
    getBoardMeta(db, 'techInquiry'),
    getItem(db, itemId),
  ])
  if (!meta || !doc || doc.boardKey !== 'techInquiry') {
    throw refuse(404, '맡지 못했어요', '문의를 찾지 못했어요(지워졌을 수 있어요)')
  }
  const assigneeColumn = findAssigneeColumn(meta.columns)
  const statusColumn = meta.columns.find(
    (c) => c.type === 'status' && squash(c.title) === squash(STATUS_TITLE),
  )
  if (!assigneeColumn) {
    throw refuse(500, '맡지 못했어요', '아톡문의 보드에 담당자(엑스툴) 칸이 없어요')
  }
  const customer = textOf(meta, doc, '고객명') || doc.name.trim() || '이 문의'
  const assigned = (doc.values[assigneeColumn.id]?.text ?? '').trim()
  const status = statusColumn ?
    (doc.values[statusColumn.id]?.text ?? '').trim() :
    ''
  const names = peopleNames(assigned)
  if (names.length > 0 && !names.includes(editor.name)) {
    return {
      ok: false,
      title: '이미 담당자가 있어요',
      message: `${customer} 문의는 ${names.join(', ')}님이 맡고 있어요`,
    }
  }
  const mine = names.includes(editor.name)
  const toFirst = !!statusColumn && status === STATUS_NEW
  if (mine && !toFirst) {
    return {
      ok: true,
      title: '이미 맡은 문의예요',
      message: `${customer} 문의 · 담당 ${editor.name}`,
    }
  }

  // 동시에 누른 두 사람 중 먼저 적은 쪽만 — 담당자를 새로 정할 때만 잠근다
  const lock = db.collection(NOTICES).doc(`${itemId}-claim`)
  if (!mine) {
    const taken = await db.runTransaction(async (tx) => {
      const held = await tx.get(lock)
      const by = String(held.get('by') ?? '')
      const at = Number(held.get('at') ?? 0)
      const fresh = Date.now() - at < CLAIM_LOCK_MS
      if (held.exists && by && by !== editor.name && fresh) {
        return by
      }
      tx.set(lock, {
        boardKey: 'techInquiry',
        kind: 'claim',
        by: editor.name,
        at: Date.now(),
      })
      return null
    })
    if (taken) {
      return {
        ok: false,
        title: '이미 담당자가 있어요',
        message: `${customer} 문의는 ${taken}님이 먼저 맡았어요`,
      }
    }
  }
  const columns: Record<string, string> = {}
  const base: Record<string, string> = {}
  if (!mine) {
    columns[assigneeColumn.id] = editor.name
    base[assigneeColumn.id] = assigned
  }
  if (toFirst && statusColumn) {
    columns[statusColumn.id] = STATUS_FIRST
    base[statusColumn.id] = status
  }
  try {
    const { conflicts } = await updateTechItem(
      db,
      apiKey,
      { boardKey: 'techInquiry', itemId, columns, base: { columns: base } },
      editor,
    )
    const lost = conflicts.find((c) => c.field === assigneeColumn.id)
    if (lost) {
      await lock.delete().catch(() => undefined)
      return {
        ok: false,
        title: '이미 담당자가 있어요',
        message: `${customer} 문의는 ${lost.theirs ?? '다른 분'}님이 먼저 맡았어요`,
      }
    }
  } catch (error) {
    if (!mine) await lock.delete().catch(() => undefined)
    logger.error(`알림 단추 맡기 실패(${itemId}):`, error)
    throw refuse(500, '맡지 못했어요', '저장하지 못했어요. 잠시 뒤 앱에서 다시 해 주세요')
  }
  return {
    ok: true,
    title: '맡았어요',
    message: [
      `${customer} 문의`,
      `담당 ${editor.name}`,
      toFirst ? STATUS_FIRST : '',
    ]
      .filter(Boolean)
      .join(' · '),
  }
}
