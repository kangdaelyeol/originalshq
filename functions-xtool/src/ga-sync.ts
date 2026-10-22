import { Firestore } from 'firebase-admin/firestore'
import { fetchGa4Events, type Ga4Event } from './ga4-bigquery'
import { getGaConsultations } from './monday'

// GA4 이벤트 수집(배치) — GA ClientId가 적힌 상담의 GA4 이벤트를 BigQuery에서
// 가져와 gaEvents/{clientId}에 쌓는다. "오기입 추적" 탭은 BigQuery를 직접
// 부르지 않고 이것만 읽는다(빠르고, 읽는 양이 조회 횟수와 무관하다).
//
//   · 처음 보는 id — 그 상담 접수일 30일 전부터 오늘까지 한 번에(문의 전
//     행동까지).
//   · 이미 있는 id — 최근 3일만 다시 읽어 그 날짜분을 바꿔 끼운다. GA4 일별
//     테이블은 늦게 도착한 이벤트로 최대 3일 안에 다시 쓰일 수 있다.
//
// Monday 예약 동기화 직후에 같이 돈다(하루 6번).

export const GA_EVENTS_COLLECTION = 'gaEvents'
const STATE_DOC = { collection: 'mondayStats', doc: 'gaSyncState' }

// GA4 BigQuery 내보내기를 시작한 날 — 이보다 앞 날짜는 테이블이 없다.
const GA4_EXPORT_START = '20260908'
// 상담 접수일보다 이만큼 앞 이벤트부터 본다(문의 전에 사이트를 둘러본 기록).
const GA_LOOKBACK_DAYS = 30
// 이미 있는 id를 다시 읽는 날 수(오늘 포함).
const REFRESH_DAYS = 3
// 한 사람의 이벤트를 문서 하나에 담는 상한 — 문서 한도(1MB) 안에 들도록
// 최근 것만 남긴다.
const MAX_EVENTS_PER_CLIENT = 3000

const DAY_MS = 86_400_000
const KST_MS = 9 * 3_600_000

/** ms → 한국 날짜 YYYYMMDD. */
const kstYmd = (ms: number): string =>
  new Date(ms + KST_MS).toISOString().slice(0, 10).replace(/-/g, '')
/** YYYY-MM-DD → YYYYMMDD, n일 이동. */
const shiftYmd = (iso: string, days: number): string =>
  new Date(Date.parse(iso) + days * DAY_MS)
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, '')
const atLeastExportStart = (ymd: string) =>
  ymd < GA4_EXPORT_START ? GA4_EXPORT_START : ymd

export interface GaEventsDoc {
  clientId: string
  /** 시간순. */
  events: Ga4Event[]
  /** 처음 수집할 때 거슬러 올라간 첫 날짜(YYYYMMDD). */
  backfilledFrom: string
  updatedAt: number
}

export interface GaSyncResult {
  clientIds: number
  newClientIds: number
  /** 이번에 저장한 문서(id) 수와 그 안의 이벤트 수. */
  writtenDocs: number
  storedEvents: number
  bytesProcessed: number
  /** 다시 읽은 최근 날짜 범위(YYYYMMDD). */
  refreshFrom: string
  refreshTo: string
}

/** 같은 이벤트를 두 번 넣지 않게 — 시각·이름·페이지가 같으면 같은 이벤트. */
const eventKey = (event: Ga4Event) =>
  `${event.at}|${event.name}|${event.pageLocation ?? ''}`

const group = (events: Ga4Event[]): Map<string, Ga4Event[]> => {
  const byClient = new Map<string, Ga4Event[]>()
  for (const event of events) {
    const list = byClient.get(event.clientId) ?? []
    list.push(event)
    byClient.set(event.clientId, list)
  }
  return byClient
}

/** 중복을 빼고 시간순으로. 같은 밀리초에 찍힌 이벤트는 키로 순서를 정한다 —
 * 그러지 않으면 조회할 때마다 순서가 달라져, 바뀐 게 없는데도 다시 쓰게
 * 된다(10/22 확인). */
const finish = (events: Ga4Event[]): Ga4Event[] => {
  const unique = new Map(events.map((event) => [eventKey(event), event]))
  return [...unique.values()]
    .sort(
      (a, b) => a.at - b.at || eventKey(a).localeCompare(eventKey(b)),
    )
    .slice(-MAX_EVENTS_PER_CLIENT)
}

export async function syncGaEvents(
  db: Firestore,
  now: number = Date.now(),
): Promise<GaSyncResult> {
  const { rows } = await getGaConsultations(db)
  const today = kstYmd(now)
  const refreshFrom = atLeastExportStart(
    kstYmd(now - (REFRESH_DAYS - 1) * DAY_MS),
  )

  // id마다 가장 이른 상담 접수일 — 처음 수집할 때 어디까지 거슬러 갈지.
  const earliestById = new Map<string, string>()
  for (const row of rows) {
    const date = row.receivedAt ?? row.createdAt?.slice(0, 10) ?? null
    if (!date) continue
    const prev = earliestById.get(row.gaClientId)
    if (!prev || date < prev) earliestById.set(row.gaClientId, date)
  }
  const clientIds = [...new Set(rows.map((row) => row.gaClientId))]

  const collection = db.collection(GA_EVENTS_COLLECTION)
  const existingIds = new Set(
    (await collection.listDocuments()).map((ref) => ref.id),
  )
  const newIds = clientIds.filter((id) => !existingIds.has(id))
  const knownIds = clientIds.filter((id) => existingIds.has(id))

  let bytesProcessed = 0
  const toWrite = new Map<string, GaEventsDoc>()

  // 1) 처음 보는 id — 과거부터 한 번에.
  if (newIds.length > 0) {
    const from = atLeastExportStart(
      newIds
        .map((id) =>
          shiftYmd(
            earliestById.get(id) ??
              new Date(now + KST_MS).toISOString().slice(0, 10),
            -GA_LOOKBACK_DAYS,
          ),
        )
        .sort()[0],
    )
    const result = await fetchGa4Events(newIds, from, today)
    bytesProcessed += result.bytesProcessed
    const byClient = group(result.events)
    for (const id of newIds) {
      toWrite.set(id, {
        clientId: id,
        events: finish(byClient.get(id) ?? []),
        backfilledFrom: from,
        updatedAt: now,
      })
    }
  }

  // 2) 이미 있는 id — 최근 며칠만 다시 읽어 그 날짜분을 바꿔 끼운다.
  if (knownIds.length > 0) {
    const result = await fetchGa4Events(knownIds, refreshFrom, today)
    bytesProcessed += result.bytesProcessed
    const fresh = group(result.events)
    const snapshots = await db.getAll(
      ...knownIds.map((id) => collection.doc(id)),
    )
    for (const snapshot of snapshots) {
      const doc = snapshot.data() as GaEventsDoc | undefined
      if (!doc) continue
      const kept = doc.events.filter((event) => kstYmd(event.at) < refreshFrom)
      const merged = finish([...kept, ...(fresh.get(doc.clientId) ?? [])])
      // 바뀐 게 없으면 다시 쓰지 않는다.
      if (
        merged.length === doc.events.length &&
        merged.every((event, i) => eventKey(event) === eventKey(doc.events[i]))
      ) {
        continue
      }
      toWrite.set(doc.clientId, { ...doc, events: merged, updatedAt: now })
    }
  }

  const writer = db.bulkWriter()
  for (const [id, doc] of toWrite) writer.set(collection.doc(id), doc)
  await writer.close()

  const result: GaSyncResult = {
    clientIds: clientIds.length,
    newClientIds: newIds.length,
    writtenDocs: toWrite.size,
    storedEvents: [...toWrite.values()].reduce(
      (sum, doc) => sum + doc.events.length,
      0,
    ),
    bytesProcessed,
    refreshFrom,
    refreshTo: today,
  }
  await db
    .collection(STATE_DOC.collection)
    .doc(STATE_DOC.doc)
    .set({ lastRunAt: now, lastResult: result, lastError: null })
  return result
}

/** 수집이 실패했을 때 그 이유를 남긴다 — 탭이 "마지막 수집 실패"를 보여 준다. */
export async function saveGaSyncError(
  db: Firestore,
  error: unknown,
  now: number = Date.now(),
): Promise<void> {
  await db
    .collection(STATE_DOC.collection)
    .doc(STATE_DOC.doc)
    .set(
      {
        lastErrorAt: now,
        lastError: error instanceof Error ? error.message : String(error),
      },
      { merge: true },
    )
}

/** 오기입 추적 탭용 — GA ClientId 상담, 그 id들의 저장된 이벤트, 마지막 수집
 * 상태. BigQuery를 부르지 않는다. */
export async function readGaTracking(db: Firestore) {
  const { rows, syncedAt } = await getGaConsultations(db)
  const ids = [...new Set(rows.map((row) => row.gaClientId))]
  const collection = db.collection(GA_EVENTS_COLLECTION)
  const snapshots =
    ids.length > 0
      ? await db.getAll(...ids.map((id) => collection.doc(id)))
      : []
  const events = snapshots.flatMap(
    (snapshot) => (snapshot.data() as GaEventsDoc | undefined)?.events ?? [],
  )
  const state = (
    await db.collection(STATE_DOC.collection).doc(STATE_DOC.doc).get()
  ).data() as
    | {
        lastRunAt?: number
        lastResult?: GaSyncResult
        lastError?: string | null
        lastErrorAt?: number
      }
    | undefined
  return {
    consultations: rows,
    events,
    syncedAt,
    collectedAt: state?.lastRunAt ?? null,
    lastResult: state?.lastResult ?? null,
    lastError:
      state?.lastError &&
      (state.lastErrorAt ?? 0) > (state.lastRunAt ?? 0)
        ? state.lastError
        : null,
    fetchedAt: Date.now(),
  }
}
