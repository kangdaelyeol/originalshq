import { createHash } from 'crypto'
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

/** 저장된 item 수 — count 집계라 1,000건당 읽기 1회. */
export async function countItems(db: Firestore): Promise<number> {
  const snapshot = await db.collection(ITEMS_COLLECTION).count().get()
  return snapshot.data().count
}

/** 통합 고객 컬렉션을 주어진 목록과 똑같이 맞춘다. 내용이 그대로인 문서
 * (hash가 같은 것)는 다시 쓰지 않는다 — 하루 여섯 번 도는 동기화에서 실제로
 * 바뀌는 고객은 일부라서, 매번 전부 쓰는 것보다 쓰기가 훨씬 적다. 목록에
 * 없는 문서(그 번호의 item이 Monday에서 다 사라진 고객)는 지운다. 목록 화면용
 * 묶음(saveCustomerList)도 같이 맞춘다. */
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
  await saveCustomerList(db, customers)
  return result
}

// ── 고객 목록 묶음 ─────────────────────────────────────────────────────
// 목록 화면(listMondayCustomers)이 열 때마다 고객 문서 8천여 개를 하나씩 읽던
// 것을, 동기화 때 목록에 필요한 필드만 JSON으로 묶어 문서 열 개 남짓에 저장해
// 두고 그것만 읽게 한다(읽기 8천여 회 → 열 몇 회). 문서 하나는 1MB까지라
// 900KB씩 나눈다.
//   · mondayCustomerList/head — 지금 쓰는 판(version)과 묶음 수, 내용 지문.
//     묶음 문서는 {판}-{번호}.
//   · 새 판을 다 쓴 뒤 head를 바꾸고, 그 전전 판을 지운다 — 막 head를 읽은
//     화면이 바로 전 판을 읽는 중일 수 있어 한 판은 남겨 둔다.
//   · 고객 내용 지문이 head와 같으면 다시 쓰지 않는다(바뀐 게 없는 동기화).
//   · 읽다가 묶음이 빠져 있으면(바뀌는 중 등) 예전처럼 문서마다 읽는다.
const CUSTOMER_LIST_COLLECTION = 'mondayCustomerList'
const CUSTOMER_LIST_HEAD = 'head'
const CUSTOMER_LIST_CHUNK_BYTES = 900_000

type CustomerListHead = {
  version: string
  chunkCount: number
  count: number
  fingerprint: string
  previous: { version: string; chunkCount: number } | null
  syncedAt: number
}

const toListItem = (customer: MondayCustomer): MondayCustomerListItem => ({
  phone: customer.phone,
  otherPhones: customer.otherPhones,
  names: customer.names,
  emails: customer.emails,
  summary: customer.summary,
  lastUpdatedAt: customer.lastUpdatedAt,
})

async function saveCustomerList(
  db: Firestore,
  customers: MondayCustomer[],
): Promise<void> {
  const collection = db.collection(CUSTOMER_LIST_COLLECTION)
  const headRef = collection.doc(CUSTOMER_LIST_HEAD)
  // 문서 id(전화번호) 순 — 예전처럼 컬렉션을 읽었을 때와 같은 순서.
  const sorted = [...customers].sort((a, b) =>
    a.phone < b.phone ? -1 : a.phone > b.phone ? 1 : 0,
  )
  const fingerprint = createHash('sha1')
    .update(sorted.map(({ phone, hash }) => `${phone}:${hash}`).join('|'))
    .digest('hex')
  const old = (await headRef.get()).data() as CustomerListHead | undefined
  if (old?.fingerprint === fingerprint) return

  const chunks: string[] = []
  let current: string[] = []
  let bytes = 2
  for (const customer of sorted) {
    const json = JSON.stringify(toListItem(customer))
    const size = Buffer.byteLength(json) + 1
    if (current.length > 0 && bytes + size > CUSTOMER_LIST_CHUNK_BYTES) {
      chunks.push(`[${current.join(',')}]`)
      current = []
      bytes = 2
    }
    current.push(json)
    bytes += size
  }
  if (current.length > 0) chunks.push(`[${current.join(',')}]`)

  const version = Date.now().toString(36)
  await Promise.all(
    chunks.map((items, index) =>
      collection.doc(`${version}-${index}`).set({ items }),
    ),
  )
  const head: CustomerListHead = {
    version,
    chunkCount: chunks.length,
    count: sorted.length,
    fingerprint,
    previous: old ? { version: old.version, chunkCount: old.chunkCount } : null,
    syncedAt: Date.now(),
  }
  await headRef.set(head)
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

/** 목록 화면용 — 고객 전체의 요약 필드. 동기화가 만들어 둔 묶음(문서 열 개
 * 남짓)을 읽고, 없거나 바뀌는 중이면 고객 문서마다 요약 필드만 읽는다. */
export async function listCustomerSummaries(
  db: Firestore,
): Promise<MondayCustomerListItem[]> {
  const collection = db.collection(CUSTOMER_LIST_COLLECTION)
  const head = (await collection.doc(CUSTOMER_LIST_HEAD).get()).data() as
    | CustomerListHead
    | undefined
  if (head && head.chunkCount > 0) {
    const docs = await db.getAll(
      ...Array.from({ length: head.chunkCount }, (_, index) =>
        collection.doc(`${head.version}-${index}`),
      ),
    )
    if (docs.every((doc) => doc.exists)) {
      return docs.flatMap(
        (doc) =>
          JSON.parse(doc.get('items') as string) as MondayCustomerListItem[],
      )
    }
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
const DAILY_INFLOW_DOC = 'dailyInflow'

/** 날짜별 인입 건수를 문서 하나에 통째로 저장한다 — 하루에 한 줄이라 몇 년
 * 치도 문서 크기 한도(1MB)에 한참 못 미치고, 읽을 때 문서 1건만 읽으면 된다. */
export async function saveDailyInflow(
  db: Firestore,
  days: MondayDailyInflow[],
): Promise<void> {
  await db
    .collection(STATS_COLLECTION)
    .doc(DAILY_INFLOW_DOC)
    .set({ days, syncedAt: Date.now() })
}

export async function getDailyInflow(
  db: Firestore,
): Promise<{ days: MondayDailyInflow[]; syncedAt: number | null }> {
  const doc = await db.collection(STATS_COLLECTION).doc(DAILY_INFLOW_DOC).get()
  const data = doc.data() as
    { days: MondayDailyInflow[]; syncedAt: number } | undefined
  return { days: data?.days ?? [], syncedAt: data?.syncedAt ?? null }
}

const DAILY_SALES_DOC = 'dailySales'

/** 판매 통계용 줄 전체를 문서 하나에 저장한다 — 날짜·채널·제품별로 한 줄이라
 * 몇천 줄 수준이고, 문서 크기 한도(1MB)의 일부만 쓴다. */
export async function saveDailySales(
  db: Firestore,
  rows: MondayDailySale[],
): Promise<void> {
  await db
    .collection(STATS_COLLECTION)
    .doc(DAILY_SALES_DOC)
    .set({ rows, syncedAt: Date.now() })
}

export async function getDailySales(
  db: Firestore,
): Promise<{ rows: MondayDailySale[]; syncedAt: number | null }> {
  const doc = await db.collection(STATS_COLLECTION).doc(DAILY_SALES_DOC).get()
  const data = doc.data() as
    { rows: MondayDailySale[]; syncedAt: number } | undefined
  return { rows: data?.rows ?? [], syncedAt: data?.syncedAt ?? null }
}

const FOLLOW_UPS_DOC = 'followUps'

/** 진행 중인 상담·방문체험 기록 전체를 문서 하나에 저장한다(천오백 건 남짓,
 * 수백 KB). */
export async function saveFollowUps(
  db: Firestore,
  followUps: MondayFollowUp[],
): Promise<void> {
  await db
    .collection(STATS_COLLECTION)
    .doc(FOLLOW_UPS_DOC)
    .set({ followUps, syncedAt: Date.now() })
}

export async function getFollowUps(
  db: Firestore,
): Promise<{ followUps: MondayFollowUp[]; syncedAt: number | null }> {
  const doc = await db.collection(STATS_COLLECTION).doc(FOLLOW_UPS_DOC).get()
  const data = doc.data() as
    { followUps: MondayFollowUp[]; syncedAt: number } | undefined
  return { followUps: data?.followUps ?? [], syncedAt: data?.syncedAt ?? null }
}

const KPI_FACTS_DOC = 'kpiFacts'

/** 개인 KPI 재료를 문서 하나에 저장한다(짧은 배열이라 수백 KB). */
export async function saveKpiFacts(
  db: Firestore,
  facts: MondayKpiFacts,
): Promise<void> {
  // Firestore는 배열 안의 배열을 저장하지 못한다 — 한 줄씩 JSON 문자열로 바꿔
  // 넣고 읽을 때 되돌린다.
  await db
    .collection(STATS_COLLECTION)
    .doc(KPI_FACTS_DOC)
    .set({
      consultations: facts.consultations.map((row) => JSON.stringify(row)),
      visits: facts.visits.map((row) => JSON.stringify(row)),
      sales: facts.sales.map((row) => JSON.stringify(row)),
      boards: facts.boards,
      syncedAt: Date.now(),
    })
}

export async function getKpiFacts(
  db: Firestore,
): Promise<MondayKpiFacts & { syncedAt: number | null }> {
  const doc = await db.collection(STATS_COLLECTION).doc(KPI_FACTS_DOC).get()
  const data = doc.data() as
    | (Record<'consultations' | 'visits' | 'sales', string[]> & {
        boards?: MondayKpiFacts['boards']
        syncedAt: number
      })
    | undefined
  const parse = <T>(rows: string[] | undefined): T[] =>
    (rows ?? []).map((row) => JSON.parse(row) as T)
  return {
    consultations: parse(data?.consultations),
    visits: parse(data?.visits),
    sales: parse(data?.sales),
    boards: data?.boards ?? {},
    syncedAt: data?.syncedAt ?? null,
  }
}

const TECH_FACTS_DOC = 'techFacts'

/** 기술 통계 재료를 문서 하나에 저장한다(기술지원팀 기록 천 건 남짓, 수백 KB). */
export async function saveTechFacts(
  db: Firestore,
  facts: MondayTechFact[],
): Promise<void> {
  await db
    .collection(STATS_COLLECTION)
    .doc(TECH_FACTS_DOC)
    .set({ facts, syncedAt: Date.now() })
}

export async function getTechFacts(
  db: Firestore,
): Promise<{ facts: MondayTechFact[]; syncedAt: number | null }> {
  const doc = await db.collection(STATS_COLLECTION).doc(TECH_FACTS_DOC).get()
  const data = doc.data() as
    { facts: MondayTechFact[]; syncedAt: number } | undefined
  return { facts: data?.facts ?? [], syncedAt: data?.syncedAt ?? null }
}

const DAILY_REPEAT_REVENUE_DOC = 'dailyRepeatRevenue'

/** 날짜별 신규·재구매 금액 — 하루 한 줄이라 몇 년 치도 문서 하나에 들어간다. */
export async function saveDailyRepeatRevenue(
  db: Firestore,
  rows: MondayDailyRepeatRevenue[],
): Promise<void> {
  await db
    .collection(STATS_COLLECTION)
    .doc(DAILY_REPEAT_REVENUE_DOC)
    .set({ rows, syncedAt: Date.now() })
}

export async function getDailyRepeatRevenue(
  db: Firestore,
): Promise<{ rows: MondayDailyRepeatRevenue[]; syncedAt: number | null }> {
  const doc = await db
    .collection(STATS_COLLECTION)
    .doc(DAILY_REPEAT_REVENUE_DOC)
    .get()
  const data = doc.data() as
    | { rows: MondayDailyRepeatRevenue[]; syncedAt: number }
    | undefined
  return { rows: data?.rows ?? [], syncedAt: data?.syncedAt ?? null }
}

const ATTRIBUTION_DOC = 'attribution'

/** 광고 기여 ROAS 재료 — 고객 수(수천)만큼이라 문서 하나에 넣는다. 줄 안에
 * 배열이 있어(Firestore는 배열 안의 배열을 못 담는다) 줄마다 JSON 문자열로
 * 저장하고 읽을 때 되돌린다. */
export async function saveAttributionRows(
  db: Firestore,
  rows: MondayAttributionRow[],
): Promise<void> {
  await db
    .collection(STATS_COLLECTION)
    .doc(ATTRIBUTION_DOC)
    .set({ rows: rows.map((row) => JSON.stringify(row)), syncedAt: Date.now() })
}

export async function getAttributionRows(
  db: Firestore,
): Promise<{ rows: MondayAttributionRow[]; syncedAt: number | null }> {
  const doc = await db.collection(STATS_COLLECTION).doc(ATTRIBUTION_DOC).get()
  const data = doc.data() as { rows: string[]; syncedAt: number } | undefined
  return {
    rows: (data?.rows ?? []).map((row) => JSON.parse(row)),
    syncedAt: data?.syncedAt ?? null,
  }
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

const GA_CONSULTATIONS_DOC = 'gaConsultations'

/** GA ClientId가 적힌 상담 기록 — 수십~수백 건이라 문서 하나에 넣는다. */
export async function saveGaConsultations(
  db: Firestore,
  rows: MondayGaConsultation[],
): Promise<void> {
  await db
    .collection(STATS_COLLECTION)
    .doc(GA_CONSULTATIONS_DOC)
    .set({ rows, syncedAt: Date.now() })
}

export async function getGaConsultations(
  db: Firestore,
): Promise<{ rows: MondayGaConsultation[]; syncedAt: number | null }> {
  const doc = await db
    .collection(STATS_COLLECTION)
    .doc(GA_CONSULTATIONS_DOC)
    .get()
  const data = doc.data() as
    | { rows: MondayGaConsultation[]; syncedAt: number }
    | undefined
  return { rows: data?.rows ?? [], syncedAt: data?.syncedAt ?? null }
}
