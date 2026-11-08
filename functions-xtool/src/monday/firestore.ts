import { createHash } from 'crypto'
import * as logger from 'firebase-functions/logger'
import {
  CollectionReference,
  DocumentData,
  FieldValue,
  Firestore,
  Query,
} from 'firebase-admin/firestore'
import { Cafe24Order } from './cafe24'
import {
  MondayBoard,
  MondayBoardKind,
  MondayCustomer,
  MondayCustomerListItem,
  MondayCustomerRebuildResult,
  MondayDailyInflow,
  MondayDailySale,
  MondayDailyRepeatRevenue,
  MondayAttributionRow,
  MondayGaConsultation,
  MondayOfflineSaleLine,
  MondayFollowUp,
  MondayKpiFacts,
  MondayItem,
  MondayLeadFeedRow,
  MondayTechFact,
  MondayMissingPhoneItem,
  MondayPaymentIssue,
  MondayPaymentIssueItem,
} from './types'

const BOARDS_COLLECTION = 'mondayBoards'
const ITEMS_COLLECTION = 'mondayItems'
const CUSTOMERS_COLLECTION = 'mondayCustomers'

// Firestore batch 한 번에 담을 수 있는 쓰기는 500건 — 여유를 두고 끊는다.
const BATCH_SIZE = 400

/** 동기화해 둔 아이템인지 — 등록한 보드의 기록만 화면에서 열게 한다. */
export async function hasSyncedItem(
  db: Firestore,
  itemId: string,
): Promise<boolean> {
  return (await db.collection(ITEMS_COLLECTION).doc(itemId).get()).exists
}

export async function listBoards(db: Firestore): Promise<MondayBoard[]> {
  const snapshot = await db.collection(BOARDS_COLLECTION).get()
  return snapshot.docs.map((doc) => doc.data() as MondayBoard)
}

export async function getBoard(
  db: Firestore,
  boardId: string,
): Promise<MondayBoard | null> {
  const doc = await db.collection(BOARDS_COLLECTION).doc(boardId).get()
  return doc.exists ? (doc.data() as MondayBoard) : null
}

export async function saveBoard(
  db: Firestore,
  board: MondayBoard,
): Promise<void> {
  await db.collection(BOARDS_COLLECTION).doc(board.id).set(board)
}

export async function updateBoard(
  db: Firestore,
  boardId: string,
  patch: Partial<MondayBoard>,
): Promise<void> {
  await db.collection(BOARDS_COLLECTION).doc(boardId).update(patch)
}

// ── 바뀐 문서만 쓰기 ──────────────────────────────────────────────────
// 동기화는 매번 Monday에서 전체를 받아 저장본과 똑같이 맞추되, 내용 지문(hash)이
// 달라진 문서만 쓴다. 저장본의 지문을 문서마다 읽으면 문서 수만큼 읽기가 나가서
// (아이템 1만·고객 8천·원장 2천), 지문을 대상마다 "id → 지문" 목록 문서 하나
// (syncHashes/{이름})에 모아 두고 그것만 읽는다.
//   · 목록은 실제 문서를 다 쓴 뒤 맨 마지막에 고친다 — 중간에 실패하면 목록이
//     옛것이라 다음 실행이 다시 쓴다.
//   · 하루 첫 실행(KST 날짜가 바뀐 뒤)과 목록이 없을 때는 지금처럼 문서마다
//     지문을 읽어 맞춘다 — 콘솔에서 문서를 손으로 지운 경우 등 목록과 실제가
//     어긋나도 하루 안에 바로잡힌다.
//   · 목록은 JSON 문자열 한 필드 — 맵으로 두면 항목마다 색인이 붙고 필드 수
//     한도(2만)에도 걸린다. 너무 커지면(900KB) 목록 없이 문서마다 읽는다.
const HASHES_COLLECTION = 'syncHashes'
// 바뀜 확인용이라 앞 16자(64비트)면 충분하다 — 목록 크기를 줄인다.
const SHORT_HASH = 16
const MAX_INDEX_LENGTH = 900_000

const kstDay = (ms: number) =>
  new Date(ms + 9 * 3_600_000).toISOString().slice(0, 10)

type HashedDoc = { id: string; hash: string; data: DocumentData }

async function replaceHashed(
  db: Firestore,
  options: {
    /** 목록 문서 이름 — syncHashes/{index}. */
    index: string
    collection: CollectionReference
    /** 목록이 없거나 하루 첫 실행일 때 지문을 문서마다 읽을 범위. */
    scope: Query
    docs: HashedDoc[]
  },
): Promise<{ writtenCount: number; deletedCount: number }> {
  const { collection } = options
  const indexRef = db.collection(HASHES_COLLECTION).doc(options.index)
  const today = kstDay(Date.now())
  const indexDoc = await indexRef.get()
  const verifiedDay = indexDoc.get('verifiedDay') as string | undefined
  let known: Map<string, string>
  let verified = verifiedDay
  if (indexDoc.exists && verifiedDay === today) {
    known = new Map(
      Object.entries(
        JSON.parse(indexDoc.get('hashes') as string) as Record<string, string>,
      ),
    )
  } else {
    const snapshot = await options.scope.select('hash').get()
    known = new Map(
      snapshot.docs.map((doc) => [
        doc.id,
        String(doc.get('hash') ?? '').slice(0, SHORT_HASH),
      ]),
    )
    verified = today
  }

  const changed = options.docs.filter(
    (doc) => known.get(doc.id) !== doc.hash.slice(0, SHORT_HASH),
  )
  const incoming = new Set(options.docs.map((doc) => doc.id))
  const stale = [...known.keys()].filter((id) => !incoming.has(id))

  // 쓰는 문서와 지우는 문서는 겹치지 않는다(지우고 다시 쓰면 순서에 따라
  // 문서가 사라질 수 있다 — cmip에서 10/21 발견).
  for (let i = 0; i < changed.length; i += BATCH_SIZE) {
    const batch = db.batch()
    for (const doc of changed.slice(i, i + BATCH_SIZE)) {
      batch.set(collection.doc(doc.id), doc.data)
    }
    await batch.commit()
  }
  for (let i = 0; i < stale.length; i += BATCH_SIZE) {
    const batch = db.batch()
    for (const id of stale.slice(i, i + BATCH_SIZE)) {
      batch.delete(collection.doc(id))
    }
    await batch.commit()
  }

  const hashes = JSON.stringify(
    Object.fromEntries(
      options.docs.map((doc) => [doc.id, doc.hash.slice(0, SHORT_HASH)]),
    ),
  )
  if (hashes.length > MAX_INDEX_LENGTH) {
    await indexRef.delete()
  } else {
    await indexRef.set({ hashes, verifiedDay: verified, syncedAt: Date.now() })
  }

  return { writtenCount: changed.length, deletedCount: stale.length }
}

/** 보드 한 개의 item을 Monday와 똑같이 맞춘다: 새로 생겼거나 바뀐 item만 쓰고,
 * 저장돼 있는데 이번에 안 온 item(Monday에서 지워졌거나 다른 보드로 옮겨진
 * 것)은 지운다(replaceHashed). */
export async function replaceBoardItems(
  db: Firestore,
  boardId: string,
  items: MondayItem[],
): Promise<{ writtenCount: number; deletedCount: number }> {
  const collection = db.collection(ITEMS_COLLECTION)
  return replaceHashed(db, {
    index: `items-${boardId}`,
    collection,
    scope: collection.where('boardId', '==', boardId),
    docs: items.map((item) => ({ id: item.id, hash: item.hash, data: item })),
  })
}

/** 보드 등록을 해제한다 — 보드 문서와 그 보드에서 가져온 item을 전부 지운다.
 * 지운 item 수를 돌려준다. */
export async function deleteBoard(
  db: Firestore,
  boardId: string,
): Promise<number> {
  const { deletedCount } = await replaceBoardItems(db, boardId, [])
  await db.collection(BOARDS_COLLECTION).doc(boardId).delete()
  await db.collection(HASHES_COLLECTION).doc(`items-${boardId}`).delete()
  return deletedCount
}

export async function listItems(db: Firestore): Promise<MondayItem[]> {
  const snapshot = await db.collection(ITEMS_COLLECTION).get()
  return snapshot.docs.map((doc) => doc.data() as MondayItem)
}

/** 보드 하나의 저장된 item — 동기화에 실패한 보드의 것만 읽을 때. */
export async function listBoardItems(
  db: Firestore,
  boardId: string,
): Promise<MondayItem[]> {
  const snapshot = await db
    .collection(ITEMS_COLLECTION)
    .where('boardId', '==', boardId)
    .get()
  return snapshot.docs.map((doc) => doc.data() as MondayItem)
}

/** Monday에 만들어진 시각(createdAt, ISO)이 since 이후인 item — 리드 분석
 * 탭이 최근 기간만 읽는다(전체를 읽지 않게 createdAt 단일 필드 색인으로 거른다). */
export async function listItemsCreatedSince(
  db: Firestore,
  since: string,
): Promise<MondayItem[]> {
  const snapshot = await db
    .collection(ITEMS_COLLECTION)
    .where('createdAt', '>=', since)
    .get()
  return snapshot.docs.map((doc) => doc.data() as MondayItem)
}

/** 저장된 item 수 — count 집계라 1,000건당 읽기 1회. */
export async function countItems(db: Firestore): Promise<number> {
  const snapshot = await db.collection(ITEMS_COLLECTION).count().get()
  return snapshot.data().count
}

/** 통합 고객 컬렉션을 주어진 목록과 똑같이 맞춘다. 내용이 그대로인 문서
 * (hash가 같은 것)는 다시 쓰지 않는다 — 하루 여섯 번 도는 동기화에서 실제로
 * 바뀌는 고객은 일부라서, 매번 전부 쓰는 것보다 쓰기가 훨씬 적다. 목록에
 * 없는 문서(그 번호의 item이 Monday에서 다 사라진 고객)는 지운다. 목록 화면용
 * 묶음(saveCustomerList)은 고객 통합의 따로 된 단계가 맞춘다. */
export async function replaceCustomers(
  db: Firestore,
  customers: MondayCustomer[],
): Promise<Pick<MondayCustomerRebuildResult, 'writtenCount' | 'deletedCount'>> {
  const collection = db.collection(CUSTOMERS_COLLECTION)
  const result = await replaceHashed(db, {
    index: 'customers',
    collection,
    scope: collection,
    docs: customers.map((customer) => ({
      id: customer.phone,
      hash: customer.hash,
      data: customer,
    })),
  })
  return result
}

// ── 목록 묶음 ──────────────────────────────────────────────────────────
// 화면이 열 때마다 문서 수천 개를 하나씩 읽던 목록을, 동기화 때 화면에 필요한
// 필드만 JSON으로 묶어 문서 몇 개에 저장해 두고 그것만 읽게 한다(읽기 수천 회 →
// 열 몇 회). 문서 하나는 1MB까지라 900KB씩 나눈다. 고객 목록과 리드 분석의 리드
// 줄이 쓴다.
//   · {컬렉션}/head — 지금 쓰는 판(version)과 묶음 수, 내용 지문.
//     묶음 문서는 {판}-{번호}.
//   · 새 판을 다 쓴 뒤 head를 바꾸고, 그 전전 판을 지운다 — 막 head를 읽은
//     화면이 바로 전 판을 읽는 중일 수 있어 한 판은 남겨 둔다.
//   · 내용 지문이 head와 같으면 다시 쓰지 않는다(바뀐 게 없는 동기화).
//   · 읽다가 묶음이 빠져 있으면(바뀌는 중 등) 부르는 쪽이 원본에서 읽는다.
const CHUNKED_HEAD = 'head'
const CHUNK_BYTES = 900_000

type ChunkedHead = {
  version: string
  chunkCount: number
  count: number
  fingerprint: string
  previous: { version: string; chunkCount: number } | null
  /** 이 판을 쓴 때. */
  syncedAt: number
  /** 마지막으로 저장을 시도한 때 — 내용이 그대로라 다시 쓰지 않았어도
   * 고친다(화면의 '마지막 동기화'). 예전 head에는 없다. */
  checkedAt?: number
}

/** 목록을 묶어 저장한다.
 *   · fingerprint를 주면 그것으로 바뀜을 본다 — 같으면 JSON으로 바꾸지도 않는다.
 *     안 주면 목록 JSON과 extra로 지문을 만든다.
 *   · extra는 head에 같이 둘 값 — 묶음마다 마지막 줄의 번호를 받는다. */
async function saveChunked<T>(
  collection: CollectionReference,
  items: readonly T[],
  options: {
    fingerprint?: string
    extra?: (lastIndexes: number[]) => Record<string, unknown>
  } = {},
): Promise<void> {
  const headRef = collection.doc(CHUNKED_HEAD)
  const old = (await headRef.get()).data() as ChunkedHead | undefined
  // 내용이 그대로면 다시 쓰지 않고 확인한 때만 고친다.
  const markChecked = () => headRef.update({ checkedAt: Date.now() })
  if (
    options.fingerprint !== undefined &&
    old?.fingerprint === options.fingerprint
  ) {
    await markChecked()
    return
  }

  const chunks: string[] = []
  const lastIndexes: number[] = []
  let current: string[] = []
  let bytes = 2
  const jsons = items.map((item) => JSON.stringify(item))
  jsons.forEach((json, index) => {
    const size = Buffer.byteLength(json) + 1
    if (current.length > 0 && bytes + size > CHUNK_BYTES) {
      chunks.push(`[${current.join(',')}]`)
      lastIndexes.push(index - 1)
      current = []
      bytes = 2
    }
    current.push(json)
    bytes += size
  })
  if (current.length > 0) {
    chunks.push(`[${current.join(',')}]`)
    lastIndexes.push(jsons.length - 1)
  }
  const extra = options.extra?.(lastIndexes) ?? {}
  const fingerprint =
    options.fingerprint ??
    createHash('sha1')
      .update(JSON.stringify(extra))
      .update(chunks.join('\n'))
      .digest('hex')
  if (old?.fingerprint === fingerprint) {
    await markChecked()
    return
  }

  const version = Date.now().toString(36)
  await Promise.all(
    chunks.map((text, index) =>
      collection.doc(`${version}-${index}`).set({ items: text }),
    ),
  )
  const head: ChunkedHead = {
    version,
    chunkCount: chunks.length,
    count: items.length,
    fingerprint,
    previous: old ? { version: old.version, chunkCount: old.chunkCount } : null,
    syncedAt: Date.now(),
    checkedAt: Date.now(),
  }
  await headRef.set({ ...extra, ...head })
  // 전전 판 지우기 — 실패해도 목록에는 지장이 없다(다음 판 때 남은 채로 둔다).
  if (old?.previous) {
    const stale = old.previous
    await Promise.all(
      Array.from({ length: stale.chunkCount }, (_, index) =>
        collection.doc(`${stale.version}-${index}`).delete(),
      ),
    ).catch(() => undefined)
  }
}

/** 묶어 둔 목록의 head — 아직 없으면 undefined. Extra는 저장 때 같이 둔 값. */
async function readChunkedHead<Extra>(
  collection: CollectionReference,
): Promise<(ChunkedHead & Partial<Extra>) | undefined> {
  return (await collection.doc(CHUNKED_HEAD).get()).data() as
    | (ChunkedHead & Partial<Extra>)
    | undefined
}

/** head가 가리키는 묶음(indexes를 주면 그 묶음만)을 읽어 목록으로 되돌린다 —
 * 하나라도 빠졌으면(바뀌는 중 등) null. */
async function readChunks<T>(
  collection: CollectionReference,
  head: ChunkedHead,
  indexes = Array.from({ length: head.chunkCount }, (_, index) => index),
): Promise<T[] | null> {
  if (indexes.length === 0) return []
  const docs = await collection.firestore.getAll(
    ...indexes.map((index) => collection.doc(`${head.version}-${index}`)),
  )
  if (!docs.every((doc) => doc.exists)) return null
  return docs.flatMap((doc) => JSON.parse(doc.get('items') as string) as T[])
}

// 고객 목록(listMondayCustomers) — 고객 8천여 명의 목록 필드.
const CUSTOMER_LIST_COLLECTION = 'mondayCustomerList'

const toListItem = (customer: MondayCustomer): MondayCustomerListItem => ({
  phone: customer.phone,
  otherPhones: customer.otherPhones,
  names: customer.names,
  emails: customer.emails,
  summary: customer.summary,
  lastUpdatedAt: customer.lastUpdatedAt,
})

export async function saveCustomerList(
  db: Firestore,
  customers: MondayCustomer[],
): Promise<void> {
  // 문서 id(전화번호) 순 — 예전처럼 컬렉션을 읽었을 때와 같은 순서.
  const sorted = [...customers].sort((a, b) =>
    a.phone < b.phone ? -1 : a.phone > b.phone ? 1 : 0,
  )
  // 고객 문서의 지문(hash)으로 — 바뀐 게 없으면 목록을 JSON으로 바꾸지 않는다.
  const fingerprint = createHash('sha1')
    .update(sorted.map(({ phone, hash }) => `${phone}:${hash}`).join('|'))
    .digest('hex')
  await saveChunked(
    db.collection(CUSTOMER_LIST_COLLECTION),
    sorted.map(toListItem),
    { fingerprint },
  )
}

/** 목록 화면용 — 고객 전체의 요약 필드. 동기화가 만들어 둔 묶음(문서 열 개
 * 남짓)을 읽고, 없거나 바뀌는 중이면 고객 문서마다 요약 필드만 읽는다. */
export async function listCustomerSummaries(
  db: Firestore,
): Promise<MondayCustomerListItem[]> {
  const collection = db.collection(CUSTOMER_LIST_COLLECTION)
  const head = await readChunkedHead(collection)
  if (head && head.chunkCount > 0) {
    const items = await readChunks<MondayCustomerListItem>(collection, head)
    if (items) return items
  }
  const snapshot = await db
    .collection(CUSTOMERS_COLLECTION)
    .select(
      'phone',
      'otherPhones',
      'names',
      'emails',
      'summary',
      'lastUpdatedAt',
    )
    .get()
  return snapshot.docs.map((doc) => doc.data() as MondayCustomerListItem)
}

// 리드 분석의 리드 줄(getMondayLeadFeed) — 상담 보드 기록 한 건이 한 줄, 최근
// 것부터 묶는다. head에 묶음마다 가장 최근 줄의 만든 시각을 둬서, 기간을 볼
// 때는 그 기간에 만들어진 줄이 든 묶음(대개 맨 앞 하나)만 읽는다.
const LEAD_FEED_COLLECTION = 'mondayLeadFeed'

type LeadFeedHeadExtra = {
  /** 줄 모양의 판(lead-feed.ts) — 다르면 읽지 않는다. */
  rowVersion: number
  /** 묶음마다 가장 최근 줄의 createdAt(ISO) — 만든 시각이 하나도 없으면 ''. */
  newest: string[]
}

/** 리드 줄(최근 것부터)을 묶어 저장한다 — 동기화 뒤 고객 통합이 부른다. */
export async function saveLeadFeedRows(
  db: Firestore,
  rows: MondayLeadFeedRow[],
  rowVersion: number,
): Promise<void> {
  await saveChunked(db.collection(LEAD_FEED_COLLECTION), rows, {
    extra: (lastIndexes): LeadFeedHeadExtra => ({
      rowVersion,
      newest: lastIndexes.map((last, chunk) =>
        rows
          .slice(chunk === 0 ? 0 : lastIndexes[chunk - 1] + 1, last + 1)
          .reduce(
            (max, row) =>
              row.createdAt !== null && row.createdAt > max
                ? row.createdAt
                : max,
            '',
          ),
      ),
    }),
  })
}

/** 묶어 둔 리드 줄 — since(ISO) 이후에 만들어진 것만(null이면 전부)과 그
 * 줄을 마지막으로 확인한 때. 아직 묶지 않았거나, 줄 모양의 판이 다르거나,
 * 바뀌는 중이면 null — 부르는 쪽이 원본 기록에서 읽는다. */
export async function readLeadFeedRows(
  db: Firestore,
  since: string | null,
  rowVersion: number,
): Promise<{ rows: MondayLeadFeedRow[]; checkedAt: number } | null> {
  const collection = db.collection(LEAD_FEED_COLLECTION)
  const head = await readChunkedHead<LeadFeedHeadExtra>(collection)
  if (!head || head.rowVersion !== rowVersion) return null
  const indexes = Array.from(
    { length: head.chunkCount },
    (_, index) => index,
  ).filter(
    (index) =>
      since === null || (head.newest?.[index] ?? since) >= since,
  )
  const rows = await readChunks<MondayLeadFeedRow>(collection, head, indexes)
  if (rows === null) return null
  return {
    rows:
      since === null
        ? rows
        : rows.filter(
            (row) => row.createdAt !== null && row.createdAt >= since,
          ),
    checkedAt: head.checkedAt ?? head.syncedAt,
  }
}

export async function getCustomer(
  db: Firestore,
  phone: string,
): Promise<MondayCustomer | null> {
  const doc = await db.collection(CUSTOMERS_COLLECTION).doc(phone).get()
  return doc.exists ? (doc.data() as MondayCustomer) : null
}

// 번호가 없는 게 정상인 보드 — 기타업무는 내부 업무가 대부분이라 고객 일일
// 때만 상세내용에 번호를 적는다. 결측 목록에 넣으면 고칠 게 아닌 건만 쌓인다.
const PHONE_OPTIONAL_KINDS: ReadonlySet<MondayBoardKind> = new Set([
  'techTask',
])

/** 유효한 번호가 없어 통합에서 빠진 item들 — 동기화 때 phone을 null로 저장해
 * 둔 문서다. */
export async function listMissingPhoneItems(
  db: Firestore,
): Promise<MondayMissingPhoneItem[]> {
  const optionalBoardIds = new Set(
    (await listBoards(db))
      .filter((board) => PHONE_OPTIONAL_KINDS.has(board.kind))
      .map((board) => board.id),
  )
  const snapshot = await db
    .collection(ITEMS_COLLECTION)
    .where('phone', '==', null)
    .select(
      'id',
      'boardId',
      'boardName',
      'name',
      'phoneRaw',
      'url',
      'updatedAt',
    )
    .get()
  return snapshot.docs
    .map((doc) => doc.data() as MondayMissingPhoneItem)
    .filter((item) => !optionalBoardIds.has(item.boardId))
}

/** 확인이 필요한 결제 기록 전부 — 그런 기록이 있는 고객만 읽어서(대부분의
 * 고객은 없다) 고객 정보와 함께 한 줄씩 편다. */
export async function listPaymentIssues(
  db: Firestore,
): Promise<MondayPaymentIssueItem[]> {
  const snapshot = await db
    .collection(CUSTOMERS_COLLECTION)
    .where('summary.issueCount', '>', 0)
    .select('phone', 'names', 'issues')
    .get()

  return snapshot.docs.flatMap((doc) => {
    const { phone, names, issues } = doc.data() as {
      phone: string
      names: string[]
      issues: MondayPaymentIssue[]
    }
    return issues.map((issue) => ({
      ...issue,
      phone,
      customerName: names[0] ?? null,
    }))
  })
}

/** functions-cmip의 Cafe24 동기화가 저장해 둔 주문별 고객·품목 정보 전부
 * (cafe24OrderCustomers). 그 컬렉션은 cmip이 쓰고 여기서는 읽기만 한다. */
export async function listCafe24Orders(db: Firestore): Promise<Cafe24Order[]> {
  const snapshot = await db.collection('cafe24OrderCustomers').get()
  return snapshot.docs.map((doc) => doc.data() as Cafe24Order)
}

const STATS_COLLECTION = 'mondayStats'

// mondayStats — 통계 재료를 종류마다 문서 하나에 통째로 둔다(동기화가 쓰고
// 통계 화면이 문서 1건만 읽는다). 모양은 { 값들, syncedAt }.

// 문서 하나의 크기 한도는 1MB — 그 80%를 넘으면 경고를 남겨, 실제로 쓰기가
// 실패하기 전에(나눠 저장할 때가 됐는지) 알 수 있게 한다.
const STATS_DOC_WARN_BYTES = 800_000

/** 문서 하나를 통째로 쓴다 — syncedAt은 지금. */
async function saveStatsDoc(
  db: Firestore,
  doc: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const bytes = Buffer.byteLength(JSON.stringify(fields))
  if (bytes > STATS_DOC_WARN_BYTES) {
    logger.warn(
      `mondayStats/${doc} 문서가 ${Math.round(bytes / 1000)}KB — ` +
        '1MB 한도에 가깝다',
    )
  }
  await db
    .collection(STATS_COLLECTION)
    .doc(doc)
    .set({ ...fields, syncedAt: Date.now() })
}

/** 문서 하나를 읽는다 — 아직 없으면 data는 undefined, syncedAt은 null. */
async function readStatsDoc<T>(
  db: Firestore,
  doc: string,
): Promise<{ data: Partial<T> | undefined; syncedAt: number | null }> {
  const snapshot = await db.collection(STATS_COLLECTION).doc(doc).get()
  const data = snapshot.data() as
    | (Partial<T> & { syncedAt?: number })
    | undefined
  return { data, syncedAt: data?.syncedAt ?? null }
}

/** 배열 하나만 담은 문서의 저장·조회 한 쌍. 조회는 { [field]: 배열,
 * syncedAt } — 아직 없으면 빈 배열과 null. */
function statsList<T, F extends string>(doc: string, field: F) {
  return {
    save: async (db: Firestore, list: T[]): Promise<void> =>
      saveStatsDoc(db, doc, { [field]: list }),
    get: async (
      db: Firestore,
    ): Promise<Record<F, T[]> & { syncedAt: number | null }> => {
      const { data, syncedAt } = await readStatsDoc<Record<F, T[]>>(db, doc)
      return { [field]: data?.[field] ?? [], syncedAt } as Record<F, T[]> & {
        syncedAt: number | null
      }
    },
  }
}

/** 날짜별 인입 건수 — 하루에 한 줄이라 몇 년 치도 문서 크기 한도(1MB)에
 * 한참 못 미치고, 읽을 때 문서 1건만 읽으면 된다. */
const dailyInflow = statsList<MondayDailyInflow, 'days'>('dailyInflow', 'days')
export const saveDailyInflow = dailyInflow.save
export const getDailyInflow = dailyInflow.get

/** 판매 통계용 줄 전체 — 날짜·채널·제품별로 한 줄이라 몇천 줄 수준이고, 문서
 * 크기 한도(1MB)의 일부만 쓴다. */
const dailySales = statsList<MondayDailySale, 'rows'>('dailySales', 'rows')
export const saveDailySales = dailySales.save
export const getDailySales = dailySales.get

/** 진행 중인 상담·방문체험 기록 전체(천오백 건 남짓, 수백 KB). */
const followUps = statsList<MondayFollowUp, 'followUps'>(
  'followUps',
  'followUps',
)
export const saveFollowUps = followUps.save
export const getFollowUps = followUps.get

const KPI_FACTS_DOC = 'kpiFacts'

/** 개인 KPI 재료를 문서 하나에 저장한다(짧은 배열이라 수백 KB). */
export async function saveKpiFacts(
  db: Firestore,
  facts: MondayKpiFacts,
): Promise<void> {
  // Firestore는 배열 안의 배열을 저장하지 못한다 — 한 줄씩 JSON 문자열로 바꿔
  // 넣고 읽을 때 되돌린다.
  await saveStatsDoc(db, KPI_FACTS_DOC, {
    consultations: facts.consultations.map((row) => JSON.stringify(row)),
    visits: facts.visits.map((row) => JSON.stringify(row)),
    sales: facts.sales.map((row) => JSON.stringify(row)),
    boards: facts.boards,
  })
}

export async function getKpiFacts(
  db: Firestore,
): Promise<MondayKpiFacts & { syncedAt: number | null }> {
  const { data, syncedAt } = await readStatsDoc<
    Record<'consultations' | 'visits' | 'sales', string[]> & {
      boards: MondayKpiFacts['boards']
    }
  >(db, KPI_FACTS_DOC)
  const parse = <T>(rows: string[] | undefined): T[] =>
    (rows ?? []).map((row) => JSON.parse(row) as T)
  return {
    consultations: parse(data?.consultations),
    visits: parse(data?.visits),
    sales: parse(data?.sales),
    boards: data?.boards ?? {},
    syncedAt,
  }
}

/** 기술 통계 재료(기술지원팀 기록 천 건 남짓, 수백 KB). */
const techFacts = statsList<MondayTechFact, 'facts'>('techFacts', 'facts')
export const saveTechFacts = techFacts.save
export const getTechFacts = techFacts.get

/** 날짜별 신규·재구매 금액 — 하루 한 줄이라 몇 년 치도 문서 하나에 들어간다. */
const dailyRepeatRevenue = statsList<MondayDailyRepeatRevenue, 'rows'>(
  'dailyRepeatRevenue',
  'rows',
)
export const saveDailyRepeatRevenue = dailyRepeatRevenue.save
export const getDailyRepeatRevenue = dailyRepeatRevenue.get

// 광고 기여 ROAS 재료 — 고객 한 명이 한 줄(8천여 줄)이라 문서 하나(1MB)에
// 넣던 것을, 고객이 늘어도 넘지 않게 목록 묶음(mondayAttribution)으로 옮겼다.
// 묶음이 아직 없으면(옮긴 뒤 첫 동기화 전) 예전 문서(mondayStats/attribution)를
// 읽는다.
const ATTRIBUTION_COLLECTION = 'mondayAttribution'
const ATTRIBUTION_DOC = 'attribution'

export async function saveAttributionRows(
  db: Firestore,
  rows: MondayAttributionRow[],
): Promise<void> {
  await saveChunked(db.collection(ATTRIBUTION_COLLECTION), rows)
}

export async function getAttributionRows(
  db: Firestore,
): Promise<{ rows: MondayAttributionRow[]; syncedAt: number | null }> {
  const collection = db.collection(ATTRIBUTION_COLLECTION)
  const head = await readChunkedHead(collection)
  if (head) {
    const rows = await readChunks<MondayAttributionRow>(collection, head)
    if (rows) return { rows, syncedAt: head.checkedAt ?? head.syncedAt }
  }
  // 예전 문서 — 줄마다 JSON 문자열(배열 안의 배열을 Firestore가 못 담아서).
  const { data, syncedAt } = await readStatsDoc<{ rows: string[] }>(
    db,
    ATTRIBUTION_DOC,
  )
  return { rows: (data?.rows ?? []).map((row) => JSON.parse(row)), syncedAt }
}

// 오프라인 매출 원장 — 결제 보드의 품목 줄 하나가 문서 하나(id = subitem id).
// cmip(functions-cmip/src/monday-crm/firestore.ts)가 결제일 범위로 읽어 오프라인
// 매출을 낸다. 컬렉션 이름과 문서 모양이 그쪽과의 계약이다.
const OFFLINE_SALES_COLLECTION = 'offlineSales'

/** offlineSales를 주어진 줄들과 똑같이 맞춘다 — 새로 생겼거나 내용이 바뀐 줄만
 * 쓰고, 목록에 없는 문서(Monday에서 지워졌거나 취소된 줄)만 지운다
 * (replaceHashed). 줄의 지문은 문서에도 hash로 같이 둔다(하루 첫 실행의 대조용
 * — cmip는 읽지 않는다, 계약 밖). syncedAt은 마지막으로 내용이 바뀌어 쓴 때. */
export async function replaceOfflineSales(
  db: Firestore,
  lines: MondayOfflineSaleLine[],
): Promise<{ written: number; deleted: number }> {
  const collection = db.collection(OFFLINE_SALES_COLLECTION)
  const { writtenCount, deletedCount } = await replaceHashed(db, {
    index: 'offlineSales',
    collection,
    scope: collection,
    docs: lines.map((line) => {
      const hash = createHash('sha1').update(JSON.stringify(line)).digest('hex')
      return {
        id: line.mondaySubitemId,
        hash,
        data: { ...line, hash, syncedAt: FieldValue.serverTimestamp() },
      }
    }),
  })
  return { written: writtenCount, deleted: deletedCount }
}

/** GA ClientId가 적힌 상담 기록 — 수십~수백 건이라 문서 하나에 넣는다. */
const gaConsultations = statsList<MondayGaConsultation, 'rows'>(
  'gaConsultations',
  'rows',
)
export const saveGaConsultations = gaConsultations.save
export const getGaConsultations = gaConsultations.get
