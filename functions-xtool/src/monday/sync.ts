import * as logger from 'firebase-functions/logger'
import { Firestore } from 'firebase-admin/firestore'
import { fetchBoard } from './client'
import { buildCustomers, buildDailyInflow, detectBoardKind } from './customers'
import {
  countItems,
  getBoard,
  listBoardItems,
  listBoards,
  listCafe24Orders,
  listItems,
  replaceBoardItems,
  replaceCustomers,
  saveBoard,
  saveCustomerList,
  saveDailyInflow,
  replaceOfflineSales,
  saveAttributionRows,
  saveGaConsultations,
  saveDailyRepeatRevenue,
  saveDailySales,
  saveFollowUps,
  saveKpiFacts,
  saveTechFacts,
  updateBoard,
} from './firestore'
import { buildMondayItems, detectPhoneColumnId } from './helper'
import { buildTechFacts } from './tech'
import { buildFollowUps } from './followups'
import { buildKpiFacts } from './kpi'
import { buildDailySales, buildOfflineSaleLines } from './purchases'
import { buildDailyRepeatRevenue } from './repeat-revenue'
import { buildAttributionRows } from './attribution'
import { buildGaConsultations } from './ga-tracking'
import { saveLeadFeed } from './lead-feed'
import {
  MondayBoard,
  MondayBoardPreview,
  MondayBoardSyncResult,
  MondayColumn,
  MondayCustomerRebuildResult,
  MondayItem,
  MondaySyncSummary,
  StepTimings,
} from './types'

/** 단계별 시간 재기 — time(이름, 할 일)로 감싸면 걸린 시간을 steps[이름]에
 * 더한다(같은 이름이 여러 번·동시에 돌면 합). 실행 비용 대부분이 기다리는
 * 시간이라 어느 단계가 긴지 보려고 쓴다(docs/cost-optimization). */
const createTimer = () => {
  const steps: StepTimings = {}
  const time = async <T>(name: string, run: () => Promise<T>): Promise<T> => {
    const startedAt = Date.now()
    try {
      return await run()
    } finally {
      steps[name] = (steps[name] ?? 0) + (Date.now() - startedAt)
    }
  }
  return { steps, time }
}
type Timer = ReturnType<typeof createTimer>

/** timer가 없을 때(보드 하나 등록 등) — 재지 않고 그냥 돌린다. */
const untimed: Timer['time'] = (_name, run) => run()

/** 하위 아이템까지 받아야 하는 보드인지 — 결제 보드는 금액이 품목 줄(하위
 * 아이템)에만 있고, 출장은 설치 품목이, AS는 부품·공임 청구가 하위 아이템에
 * 있다. */
const needsSubitems = (columns: MondayColumn[]): boolean =>
  ['purchase', 'fieldService', 'repair'].includes(detectBoardKind(columns))

/** 보드 하나를 Monday에서 읽어, 저장될 모양 그대로 돌려준다 — DB에는 아무것도
 * 쓰지 않는다. 보드를 등록하기 전에 컬럼 id가 맞는지, 값이 비어 오는 컬럼은
 * 없는지, 휴대폰 컬럼을 제대로 골랐는지 확인하는 용도다. syncBoard와 같은
 * 함수(fetchBoard → detectPhoneColumnId → buildMondayItems)를 쓰므로 여기서
 * 보이는 값이 곧 저장될 값이다. */
export async function previewBoard(
  apiKey: string,
  boardId: string,
  phoneColumnId: string | null,
  sampleSize: number,
): Promise<MondayBoardPreview> {
  const raw = await fetchBoard(apiKey, boardId, needsSubitems)
  const resolvedPhoneColumnId =
    phoneColumnId ?? detectPhoneColumnId(raw.columns)
  const items = buildMondayItems(raw, resolvedPhoneColumnId, Date.now())

  const countByPhone = new Map<string, number>()
  for (const item of items) {
    if (!item.phone) continue
    countByPhone.set(item.phone, (countByPhone.get(item.phone) ?? 0) + 1)
  }
  const missingPhone = items.filter((item) => !item.phone)

  return {
    boardId: raw.id,
    name: raw.name,
    itemCount: items.length,
    columns: raw.columns.map((column) => ({
      ...column,
      filledCount: items.filter((item) => item.columns[column.id]?.text).length,
    })),
    phone: {
      columnId: resolvedPhoneColumnId,
      missingCount: missingPhone.length,
      duplicatedPhoneCount: [...countByPhone.values()].filter(
        (count) => count > 1,
      ).length,
      missingSamples: missingPhone.slice(0, 10).map((item) => ({
        id: item.id,
        name: item.name,
        phoneRaw: item.phoneRaw,
        url: item.url,
      })),
    },
    samples: items.slice(0, sampleSize),
  }
}

/** 보드 하나를 Monday에서 받아 DB에 그대로 반영한다. Monday 호출이 실패하면
 * 저장된 item은 건드리지 않고(지우지 않고) 실패 결과만 보드 문서에 남긴다 —
 * 일시적인 API 오류가 "전부 삭제"로 이어지면 안 되기 때문이다. */
export async function syncBoard(
  db: Firestore,
  apiKey: string,
  board: MondayBoard,
  /** 주면 성공한 보드의 item을 여기 담는다 — 고객 통합이 DB에서 다시 읽지
   * 않게(syncBoards). */
  loaded?: Map<string, MondayItem[]>,
  timer?: Timer,
): Promise<MondayBoardSyncResult> {
  const time = timer?.time ?? untimed
  try {
    const fetchStartedAt = Date.now()
    const raw = await time('boards.fetch', () =>
      fetchBoard(apiKey, board.id, needsSubitems),
    )
    const fetchMs = Date.now() - fetchStartedAt
    const resolvedPhoneColumnId =
      board.phoneColumnId ?? detectPhoneColumnId(raw.columns)
    const syncedAt = Date.now()
    const items = buildMondayItems(raw, resolvedPhoneColumnId, syncedAt)
    const writeStartedAt = Date.now()
    const { writtenCount, deletedCount } = await time('boards.write', () =>
      replaceBoardItems(db, board.id, items),
    )
    const writeMs = Date.now() - writeStartedAt
    loaded?.set(board.id, items)

    const result: MondayBoardSyncResult = {
      ok: true,
      at: syncedAt,
      itemCount: items.length,
      writtenCount,
      deletedCount,
      missingPhoneCount: items.filter((item) => !item.phone).length,
      fetchMs,
      writeMs,
    }
    await updateBoard(db, board.id, {
      name: raw.name,
      columns: raw.columns,
      kind: detectBoardKind(raw.columns),
      resolvedPhoneColumnId,
      lastSync: result,
    })
    return result
  } catch (error) {
    logger.error(`Monday 보드 동기화 실패(boardId: ${board.id}):`, error)
    const result: MondayBoardSyncResult = {
      ok: false,
      at: Date.now(),
      itemCount: 0,
      deletedCount: 0,
      missingPhoneCount: 0,
      error: error instanceof Error ? error.message : String(error),
    }
    // 실패를 적는 것까지 실패하면(그사이 보드 등록이 풀렸거나 일시 오류) 로그만
    // 남긴다 — 여기서 던지면 동기화 전체가 고객 통합 없이 끝난다.
    await updateBoard(db, board.id, { lastSync: result }).catch((writeError) =>
      logger.error(
        `Monday 보드 실패 기록도 실패(boardId: ${board.id}):`,
        writeError,
      ),
    )
    return result
  }
}

/** 저장된 item(mondayItems)과 Cafe24 주문(cmip이 저장한
 * cafe24OrderCustomers) 전체에서 통합 고객(mondayCustomers)을 다시 만든다.
 * Monday를 부르지 않고 DB만 읽고 쓴다 — 동기화가 끝날 때마다 돌리고,
 * 통합 규칙을 고친 뒤에는 이것만 따로 돌리면 된다. 매번 처음부터 다시
 * 만들기 때문에 Monday에서 지워졌거나 번호가 바뀐 item도 따로 챙길 필요
 * 없이 그대로 반영된다. */
export async function rebuildCustomers(
  db: Firestore,
  /** 이미 가진 item 전체(syncBoards가 방금 받은 것) — 없으면 DB에서 읽는다. */
  preloaded?: MondayItem[],
  /** 주면 단계별 시간을 여기 더한다(syncBoards). 이름은 'rebuild.*'. */
  timer?: Timer,
): Promise<MondayCustomerRebuildResult> {
  const time = timer?.time ?? untimed
  const [boards, storedItems, orders] = await time('rebuild.read', () =>
    Promise.all([
      listBoards(db),
      preloaded ?? listItems(db),
      listCafe24Orders(db),
    ]),
  )
  // kind는 동기화 때 저장해 두지만, 추정 규칙이 바뀐 직후에도 바로 맞도록
  // 저장된 컬럼 정의에서 다시 추정한다.
  const kindByBoardId = new Map(
    boards.map((board) => [board.id, detectBoardKind(board.columns)]),
  )
  // 등록된 보드의 item만 — 보드 등록 해제와 동기화가 겹쳐 남은 item이 있으면
  // 통합에 넣지 않는다(종류를 몰라 엉뚱한 고객이 생긴다).
  const items = storedItems.filter((item) => kindByBoardId.has(item.boardId))
  if (items.length < storedItems.length) {
    logger.warn(
      `고객 통합: 등록되지 않은 보드의 item ${
        storedItems.length - items.length
      }건은 뺐습니다`,
    )
  }
  const { customers, ...counts } = await time(
    'rebuild.buildCustomers',
    async () => buildCustomers(items, kindByBoardId, Date.now(), orders),
  )
  // 아래 단계 시간은 계산(build*)과 저장(save*)을 합친 값이다.
  const written = await time('rebuild.customers', () =>
    replaceCustomers(db, customers),
  )

  // 통계 단계는 서로 독립이다 — 하나가 실패해도(문서 크기 한도 등) 나머지는
  // 계속 저장하고, 실패한 단계 이름을 결과(failedSteps)에 남긴다. 위의 고객
  // 통합이 실패하면 그때는 전체가 실패한다.
  const failedSteps: string[] = []
  const step = async <T>(
    name: string,
    run: () => Promise<T>,
  ): Promise<T | null> => {
    try {
      return await time(`rebuild.${name}`, run)
    } catch (error) {
      logger.error(`Monday 통계 저장 실패(${name}):`, error)
      failedSteps.push(name)
      return null
    }
  }
  const purchaseItems = items.filter(
    (item) => kindByBoardId.get(item.boardId) === 'purchase',
  )

  // 목록 화면용 고객 묶음 — 실패해도 목록은 고객 문서에서 읽을 수 있어 다른
  // 단계를 막지 않는다.
  await step('customerList', () => saveCustomerList(db, customers))
  // 같은 item들로 날짜별 인입 건수도 다시 센다(통계 탭).
  await step('dailyInflow', () =>
    saveDailyInflow(db, buildDailyInflow(items, kindByBoardId)),
  )
  // 판매 통계(제품별 판매 수량)도 — 결제 보드의 품목 줄과 Cafe24 주문 품목.
  await step('dailySales', () =>
    saveDailySales(db, buildDailySales(purchaseItems, orders)),
  )
  // 오프라인 매출 원장(cmip의 오프라인 매출·ROAS가 읽는다).
  const offlineSaleLines = await step('offlineSales', () =>
    replaceOfflineSales(db, buildOfflineSaleLines(purchaseItems)),
  )
  // 날짜별 신규·재구매 금액(cmip ROAS 탭의 신규 고객 ROAS).
  await step('repeatRevenue', () =>
    saveDailyRepeatRevenue(db, buildDailyRepeatRevenue(customers)),
  )
  // 광고 기여 ROAS 재료(cmip ROAS 탭의 ROAS 하한·코호트 ROAS).
  await step('attribution', () =>
    saveAttributionRows(db, buildAttributionRows(customers)),
  )
  // GA ClientId가 적힌 상담(오기입 추적).
  await step('gaConsultations', () =>
    saveGaConsultations(db, buildGaConsultations(items, kindByBoardId)),
  )
  // 진행 중인 상담·방문체험(방치 현황).
  await step('followUps', () =>
    saveFollowUps(db, buildFollowUps(items, kindByBoardId)),
  )
  // 개인 KPI 재료(담당자별 방문체험 확정·결제 전환·매출).
  await step('kpiFacts', () =>
    saveKpiFacts(db, buildKpiFacts(items, kindByBoardId)),
  )
  // 기술 통계 재료(출장·AS·기술 문의·기타업무 — 번호 없는 기록 포함).
  await step('techFacts', () =>
    saveTechFacts(db, buildTechFacts(items, kindByBoardId)),
  )
  // 리드 분석의 리드 줄(상담 보드 기록 한 건이 한 줄 — 번호 없는 기록 포함).
  await step('leadFeed', () => saveLeadFeed(db, items, boards))
  return {
    customerCount: customers.length,
    ...counts,
    ...written,
    offlineSaleLines,
    ...(failedSteps.length > 0 ? { failedSteps } : {}),
  }
}

// 한 번에 몇 개 보드를 같이 돌릴지. 보드 하나는 Monday에서 받아오는 데만
// 큰 보드 기준 30초가 걸려서, 16개를 차례로 돌리면 함수 제한 시간(9분)에
// 닿는다. 4개씩 돌리면 전체가 1~2분에 끝나고, 이 정도는 Monday API의 분당
// 사용량 제한에도 걸리지 않았다(실측).
const SYNC_CONCURRENCY = 4

/** 등록된 보드를 전부(또는 boardId로 지정한 하나만) 동기화한다. 보드끼리는
 * 독립이라 하나가 실패해도 나머지는 계속 진행한다. 결과는 보드를 읽어온
 * 순서(등록 목록 순서)대로 돌려준다. */
export async function syncBoards(
  db: Firestore,
  apiKey: string,
  boardId?: string,
): Promise<MondaySyncSummary> {
  const startedAt = Date.now()
  const timer = createTimer()
  let boards: MondayBoard[]
  if (boardId) {
    const board = await getBoard(db, boardId)
    if (!board) throw new Error(`등록되지 않은 보드입니다(boardId: ${boardId})`)
    boards = [board]
  } else {
    boards = await timer.time('listBoards', () => listBoards(db))
  }

  // 전체 동기화면 성공한 보드의 item을 모아 고객 통합에 그대로 넘긴다 — 방금
  // 저장한 1만 건 남짓을 DB에서 다시 읽지 않게.
  const loaded = boardId ? undefined : new Map<string, MondayItem[]>()
  const results: MondayBoardSyncResult[] = new Array(boards.length)
  let nextIndex = 0
  // 일꾼 하나가 남은 보드를 하나씩 가져가 처리한다 — SYNC_CONCURRENCY개가
  // 같이 돈다. syncBoard는 실패해도 throw하지 않고 실패 결과를 돌려준다.
  const worker = async () => {
    while (nextIndex < boards.length) {
      const index = nextIndex++
      results[index] = await syncBoard(db, apiKey, boards[index], loaded, timer)
    }
  }
  // 'boards'는 보드 단계 전체의 벽시계 시간, 'boards.fetch'·'boards.write'는
  // 보드마다 걸린 시간의 합이다(4개씩 같이 돌아서 합이 더 크다).
  await timer.time('boards', () =>
    Promise.all(Array.from({ length: SYNC_CONCURRENCY }, worker)),
  )

  const summary: MondaySyncSummary = {
    boards: [],
    okCount: 0,
    failedCount: 0,
    customers: null,
  }
  boards.forEach((board, index) => {
    const result = results[index]
    summary.boards.push({ boardId: board.id, name: board.name, ...result })
    if (result.ok) summary.okCount += 1
    else summary.failedCount += 1
  })

  // 일부 보드가 실패했어도 다시 만든다 — 실패한 보드의 item은 이전 상태로
  // 남아 있으므로, 통합본은 "지금 저장돼 있는 것"을 그대로 반영하면 된다.
  const preloaded = loaded
    ? await timer.time('collectItems', () => collectItems(db, boards, loaded))
    : undefined
  summary.customers = await rebuildCustomersSafely(db, preloaded, timer)
  summary.timings = { totalMs: Date.now() - startedAt, steps: timer.steps }
  return summary
}

/** 고객 통합에 넘길 item 전체 — 메모리에 있는 것(성공한 보드) + 실패한 보드의
 * 저장된 것. 저장된 item 수와 맞지 않으면(등록에서 빠진 보드의 item이 남아
 * 있는 등) undefined를 돌려줘 예전처럼 DB에서 전부 읽게 한다 — 결과가 늘
 * 전부 읽을 때와 같도록. 확인은 count 집계라 읽기 10여 회다. */
async function collectItems(
  db: Firestore,
  boards: MondayBoard[],
  loaded: Map<string, MondayItem[]>,
): Promise<MondayItem[] | undefined> {
  try {
    const missing = boards.filter((board) => !loaded.has(board.id))
    const fromDb = await Promise.all(
      missing.map((board) => listBoardItems(db, board.id)),
    )
    const items = [...[...loaded.values()].flat(), ...fromDb.flat()]
    const stored = await countItems(db)
    if (stored !== items.length) {
      logger.warn(
        `고객 통합: 저장된 item ${stored}건과 모은 item ${items.length}건이 ` +
          '달라 DB에서 전부 다시 읽습니다',
      )
      return undefined
    }
    return items
  } catch (error) {
    logger.warn('고객 통합: item 모으기 실패 — DB에서 전부 다시 읽습니다', error)
    return undefined
  }
}

/** rebuildCustomers를 돌리되, 실패해도 호출부(이미 item 저장을 마친 동기화)를
 * 실패로 만들지 않는다 — 오류는 로그로 남기고 null을 돌려준다. */
export async function rebuildCustomersSafely(
  db: Firestore,
  preloaded?: MondayItem[],
  timer?: Timer,
): Promise<MondayCustomerRebuildResult | null> {
  try {
    return await rebuildCustomers(db, preloaded, timer)
  } catch (error) {
    logger.error('Monday 통합 고객 재생성 실패:', error)
    return null
  }
}

/** 보드를 동기화 대상으로 등록하고 곧바로 한 번 동기화한다. 이미 등록된
 * 보드면 phoneColumnId만 바꾸고 다시 동기화한다(등록 시각·이전 결과 유지). */
export async function registerBoard(
  db: Firestore,
  apiKey: string,
  boardId: string,
  phoneColumnId: string | null,
): Promise<MondayBoard> {
  const existing = await getBoard(db, boardId)
  const board: MondayBoard = existing
    ? { ...existing, phoneColumnId }
    : {
        id: boardId,
        name: '',
        columns: [],
        kind: 'other',
        phoneColumnId,
        resolvedPhoneColumnId: null,
        registeredAt: Date.now(),
        lastSync: null,
      }
  await saveBoard(db, board)
  await syncBoard(db, apiKey, board)
  return (await getBoard(db, boardId)) as MondayBoard
}
