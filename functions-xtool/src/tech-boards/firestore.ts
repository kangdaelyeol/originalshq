import { Firestore } from 'firebase-admin/firestore'
import {
  TechBoardKey,
  TechBoardMeta,
  TechEditLog,
  TechItemDoc,
  TechMondayUser,
} from './types'

// 고객 통합 컬렉션(mondayBoards·mondayItems·mondayCustomers)과 섞이지 않게 따로
// 둔다. 화면은 규칙(firestore.rules)으로 기술팀만 읽고, 쓰기는 함수만 한다.
const META = 'techBoardMeta'
const ITEMS = 'techItems'
const MISC = 'techMeta'
const LOGS = 'techEditLogs'
// item 업데이트(Monday 댓글) 캐시 — 말풍선 패널이 열리자마자 보여 주게(updates.ts).
const UPDATES = 'techItemUpdates'

// Firestore batch 한 번에 담을 수 있는 쓰기는 500건 — 여유를 두고 끊는다.
const BATCH_SIZE = 400

export async function getBoardMeta(
  db: Firestore,
  key: TechBoardKey,
): Promise<TechBoardMeta | null> {
  const doc = await db.collection(META).doc(key).get()
  return doc.exists ? (doc.data() as TechBoardMeta) : null
}

export async function saveBoardMeta(
  db: Firestore,
  key: TechBoardKey,
  patch: Partial<TechBoardMeta>,
): Promise<void> {
  await db.collection(META).doc(key).set({ key, ...patch }, { merge: true })
}

/**
 * 보드 하나의 item을 Monday와 맞춘다 — 내용이 바뀐 문서만 쓰고, 이번에 안 온
 * 문서는 지운다. 단 동기화를 시작한 뒤(startedAt 이후)에 수정·webhook으로 쓰인
 * 문서는 건드리지 않는다(방금 받은 목록이 그보다 옛것이라).
 */
export async function replaceBoardItems(
  db: Firestore,
  key: TechBoardKey,
  docs: TechItemDoc[],
  startedAt: number,
): Promise<{ written: number; deleted: number }> {
  const collection = db.collection(ITEMS)
  const existing = await collection
    .where('boardKey', '==', key)
    .select('hash', 'syncedAt')
    .get()
  const current = new Map(
    existing.docs.map((doc) => [
      doc.id,
      {
        hash: doc.get('hash') as string | undefined,
        syncedAt: (doc.get('syncedAt') as number | undefined) ?? 0,
      },
    ]),
  )

  const toWrite = docs.filter((doc) => {
    const before = current.get(doc.itemId)
    if (!before) return true
    return before.syncedAt <= startedAt && before.hash !== doc.hash
  })
  const incoming = new Set(docs.map((doc) => doc.itemId))
  const stale = existing.docs.filter(
    (doc) =>
      !incoming.has(doc.id) &&
      (current.get(doc.id)?.syncedAt ?? 0) <= startedAt,
  )

  for (let i = 0; i < toWrite.length; i += BATCH_SIZE) {
    const batch = db.batch()
    for (const doc of toWrite.slice(i, i + BATCH_SIZE)) {
      batch.set(collection.doc(doc.itemId), doc)
    }
    await batch.commit()
  }
  for (let i = 0; i < stale.length; i += BATCH_SIZE) {
    const batch = db.batch()
    for (const doc of stale.slice(i, i + BATCH_SIZE)) batch.delete(doc.ref)
    await batch.commit()
  }
  return { written: toWrite.length, deleted: stale.length }
}

export async function getItem(
  db: Firestore,
  itemId: string,
): Promise<TechItemDoc | null> {
  const doc = await db.collection(ITEMS).doc(itemId).get()
  return doc.exists ? (doc.data() as TechItemDoc) : null
}

export async function saveItem(db: Firestore, doc: TechItemDoc): Promise<void> {
  await db.collection(ITEMS).doc(doc.itemId).set(doc)
}

export async function deleteItem(db: Firestore, itemId: string): Promise<void> {
  await Promise.all([
    db.collection(ITEMS).doc(itemId).delete(),
    db.collection(UPDATES).doc(itemId).delete(),
  ])
}

/** item 업데이트 목록을 캐시에 — 통째로 바꾼다. */
export async function saveItemUpdates(
  db: Firestore,
  key: TechBoardKey,
  itemId: string,
  updates: unknown[],
): Promise<void> {
  await db
    .collection(UPDATES)
    .doc(itemId)
    .set({ itemId, boardKey: key, updates, syncedAt: Date.now() })
}

export async function saveMondayUsers(
  db: Firestore,
  users: TechMondayUser[],
): Promise<void> {
  await db
    .collection(MISC)
    .doc('mondayUsers')
    .set({ users, syncedAt: Date.now() })
}

export async function addEditLog(db: Firestore, log: TechEditLog) {
  await db.collection(LOGS).add(log)
}

export interface XtoolMemberLite {
  email: string
  name: string
  isAdmin: boolean
  status: string
  teams?: Record<string, boolean>
  /** 관리자가 발급한 임시 비밀번호를 아직 안 바꿨으면 true(endpoints/members.ts) */
  mustChangePassword?: boolean
}

/** 등록된 구성원(xtoolMembers/{소문자 이메일}) — 로그인 화면과 같은 명단. */
export async function getMember(
  db: Firestore,
  email: string,
): Promise<XtoolMemberLite | null> {
  const doc = await db
    .collection('xtoolMembers')
    .doc(email.trim().toLowerCase())
    .get()
  return doc.exists ? (doc.data() as XtoolMemberLite) : null
}
