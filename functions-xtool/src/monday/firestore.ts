import { Firestore } from 'firebase-admin/firestore'
import { Cafe24Order } from './cafe24'
import {
  MondayBoard,
  MondayCustomer,
  MondayCustomerListItem,
  MondayCustomerRebuildResult,
  MondayDailyInflow,
  MondayDailySale,
  MondayDailyRepeatRevenue,
  MondayAttributionRow,
  MondayFollowUp,
  MondayKpiFacts,
  MondayItem,
  MondayMissingPhoneItem,
  MondayPaymentIssue,
  MondayPaymentIssueItem,
} from './types'

const BOARDS_COLLECTION = 'mondayBoards'
const ITEMS_COLLECTION = 'mondayItems'
const CUSTOMERS_COLLECTION = 'mondayCustomers'

// Firestore batch 한 번에 담을 수 있는 쓰기는 500건 — 여유를 두고 끊는다.
const BATCH_SIZE = 400

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

/** 보드 한 개의 item을 Monday와 똑같이 맞춘다: 받아온 item은 전부 덮어쓰고,
 * 저장돼 있는데 이번에 안 온 item(Monday에서 지워졌거나 다른 보드로 옮겨진
 * 것)은 지운다. 지운 문서 수를 돌려준다. */
export async function replaceBoardItems(
  db: Firestore,
  boardId: string,
  items: MondayItem[],
): Promise<number> {
  const collection = db.collection(ITEMS_COLLECTION)
  const existing = await collection
    .where('boardId', '==', boardId)
    .select()
    .get()

  const incomingIds = new Set(items.map((item) => item.id))
  const staleRefs = existing.docs
    .filter((doc) => !incomingIds.has(doc.id))
    .map((doc) => doc.ref)

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = db.batch()
    for (const item of items.slice(i, i + BATCH_SIZE)) {
      batch.set(collection.doc(item.id), item)
    }
    await batch.commit()
  }

  for (let i = 0; i < staleRefs.length; i += BATCH_SIZE) {
    const batch = db.batch()
    for (const ref of staleRefs.slice(i, i + BATCH_SIZE)) batch.delete(ref)
    await batch.commit()
  }

  return staleRefs.length
}

/** 보드 등록을 해제한다 — 보드 문서와 그 보드에서 가져온 item을 전부 지운다.
 * 지운 item 수를 돌려준다. */
export async function deleteBoard(
  db: Firestore,
  boardId: string,
): Promise<number> {
  const deletedCount = await replaceBoardItems(db, boardId, [])
  await db.collection(BOARDS_COLLECTION).doc(boardId).delete()
  return deletedCount
}

export async function listItems(db: Firestore): Promise<MondayItem[]> {
  const snapshot = await db.collection(ITEMS_COLLECTION).get()
  return snapshot.docs.map((doc) => doc.data() as MondayItem)
}

/** 통합 고객 컬렉션을 주어진 목록과 똑같이 맞춘다. 내용이 그대로인 문서
 * (hash가 같은 것)는 다시 쓰지 않는다 — 하루 여섯 번 도는 동기화에서 실제로
 * 바뀌는 고객은 일부라서, 매번 전부 쓰는 것보다 쓰기가 훨씬 적다. 목록에
 * 없는 문서(그 번호의 item이 Monday에서 다 사라진 고객)는 지운다. */
export async function replaceCustomers(
  db: Firestore,
  customers: MondayCustomer[],
): Promise<Pick<MondayCustomerRebuildResult, 'writtenCount' | 'deletedCount'>> {
  const collection = db.collection(CUSTOMERS_COLLECTION)
  const existing = await collection.select('hash').get()
  const existingHashes = new Map(
    existing.docs.map((doc) => [doc.id, doc.get('hash') as string | undefined]),
  )

  const changed = customers.filter(
    (customer) => existingHashes.get(customer.phone) !== customer.hash,
  )
  const incomingPhones = new Set(customers.map((customer) => customer.phone))
  const staleRefs = existing.docs
    .filter((doc) => !incomingPhones.has(doc.id))
    .map((doc) => doc.ref)

  for (let i = 0; i < changed.length; i += BATCH_SIZE) {
    const batch = db.batch()
    for (const customer of changed.slice(i, i + BATCH_SIZE)) {
      batch.set(collection.doc(customer.phone), customer)
    }
    await batch.commit()
  }

  for (let i = 0; i < staleRefs.length; i += BATCH_SIZE) {
    const batch = db.batch()
    for (const ref of staleRefs.slice(i, i + BATCH_SIZE)) batch.delete(ref)
    await batch.commit()
  }

  return { writtenCount: changed.length, deletedCount: staleRefs.length }
}

/** 목록 화면용 — 고객 전체를 요약 필드만 읽어 돌려준다. 기록 배열(상담내역
 * 본문 등)은 빼고 읽어서, 문서 전체를 내려보내는 것보다 응답이 훨씬 작다. */
export async function listCustomerSummaries(
  db: Firestore,
): Promise<MondayCustomerListItem[]> {
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

/** 유효한 번호가 없어 통합에서 빠진 item들 — 동기화 때 phone을 null로 저장해
 * 둔 문서다. */
export async function listMissingPhoneItems(
  db: Firestore,
): Promise<MondayMissingPhoneItem[]> {
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
  return snapshot.docs.map((doc) => doc.data() as MondayMissingPhoneItem)
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
      syncedAt: Date.now(),
    })
}

export async function getKpiFacts(
  db: Firestore,
): Promise<MondayKpiFacts & { syncedAt: number | null }> {
  const doc = await db.collection(STATS_COLLECTION).doc(KPI_FACTS_DOC).get()
  const data = doc.data() as
    | (Record<'consultations' | 'visits' | 'sales', string[]> & {
        syncedAt: number
      })
    | undefined
  const parse = <T>(rows: string[] | undefined): T[] =>
    (rows ?? []).map((row) => JSON.parse(row) as T)
  return {
    consultations: parse(data?.consultations),
    visits: parse(data?.visits),
    sales: parse(data?.sales),
    syncedAt: data?.syncedAt ?? null,
  }
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
