import * as logger from 'firebase-functions/logger'
import { Firestore } from 'firebase-admin/firestore'
import { fetchBoard } from './client'
import { buildCustomers, buildDailyInflow, detectBoardKind } from './customers'
import {
  getBoard,
  listBoards,
  listCafe24Orders,
  listItems,
  replaceBoardItems,
  replaceCustomers,
  saveBoard,
  saveDailyInflow,
  saveAttributionRows,
  saveDailyRepeatRevenue,
  saveDailySales,
  saveFollowUps,
  saveKpiFacts,
  updateBoard,
} from './firestore'
import { buildMondayItems, detectPhoneColumnId } from './helper'
import { buildFollowUps } from './followups'
import { buildKpiFacts } from './kpi'
import { buildDailySales } from './purchases'
import { buildDailyRepeatRevenue } from './repeat-revenue'
import { buildAttributionRows } from './attribution'
import {
  MondayBoard,
  MondayBoardPreview,
  MondayBoardSyncResult,
  MondayColumn,
  MondayCustomerRebuildResult,
  MondaySyncSummary,
} from './types'

/** 하위 아이템까지 받아야 하는 보드인지 — 결제 보드는 금액이 품목 줄(하위
 * 아이템)에만 있다. */
const needsSubitems = (columns: MondayColumn[]): boolean =>
  detectBoardKind(columns) === 'purchase'

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
): Promise<MondayBoardSyncResult> {
  try {
    const raw = await fetchBoard(apiKey, board.id, needsSubitems)
    const resolvedPhoneColumnId =
      board.phoneColumnId ?? detectPhoneColumnId(raw.columns)
    const syncedAt = Date.now()
    const items = buildMondayItems(raw, resolvedPhoneColumnId, syncedAt)
    const deletedCount = await replaceBoardItems(db, board.id, items)

    const result: MondayBoardSyncResult = {
      ok: true,
      at: syncedAt,
      itemCount: items.length,
      deletedCount,
      missingPhoneCount: items.filter((item) => !item.phone).length,
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
    await updateBoard(db, board.id, { lastSync: result })
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
): Promise<MondayCustomerRebuildResult> {
  const [boards, items, orders] = await Promise.all([
    listBoards(db),
    listItems(db),
    listCafe24Orders(db),
  ])
  // kind는 동기화 때 저장해 두지만, 추정 규칙이 바뀐 직후에도 바로 맞도록
  // 저장된 컬럼 정의에서 다시 추정한다.
  const kindByBoardId = new Map(
    boards.map((board) => [board.id, detectBoardKind(board.columns)]),
  )
  const { customers, ...counts } = buildCustomers(
    items,
    kindByBoardId,
    Date.now(),
    orders,
  )
  const written = await replaceCustomers(db, customers)
  // 같은 item들로 날짜별 인입 건수도 다시 센다(통계 탭).
  await saveDailyInflow(db, buildDailyInflow(items, kindByBoardId))
  // 판매 통계(제품별 판매 수량)도 — 결제 보드의 품목 줄과 Cafe24 주문 품목.
  await saveDailySales(
    db,
    buildDailySales(
      items.filter((item) => kindByBoardId.get(item.boardId) === 'purchase'),
      orders,
    ),
  )
  // 날짜별 신규·재구매 금액(cmip ROAS 탭의 신규 고객 ROAS).
  await saveDailyRepeatRevenue(db, buildDailyRepeatRevenue(customers))
  // 광고 기여 ROAS 재료(cmip ROAS 탭의 ROAS 하한·코호트 ROAS).
  await saveAttributionRows(db, buildAttributionRows(customers))
  // 진행 중인 상담·방문체험(방치 현황).
  await saveFollowUps(db, buildFollowUps(items, kindByBoardId))
  // 개인 KPI 재료(담당자별 방문체험 확정·결제 전환·매출).
  await saveKpiFacts(db, buildKpiFacts(items, kindByBoardId))
  return { customerCount: customers.length, ...counts, ...written }
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
  let boards: MondayBoard[]
  if (boardId) {
    const board = await getBoard(db, boardId)
    if (!board) throw new Error(`등록되지 않은 보드입니다(boardId: ${boardId})`)
    boards = [board]
  } else {
    boards = await listBoards(db)
  }

  const results: MondayBoardSyncResult[] = new Array(boards.length)
  let nextIndex = 0
  // 일꾼 하나가 남은 보드를 하나씩 가져가 처리한다 — SYNC_CONCURRENCY개가
  // 같이 돈다. syncBoard는 실패해도 throw하지 않고 실패 결과를 돌려준다.
  const worker = async () => {
    while (nextIndex < boards.length) {
      const index = nextIndex++
      results[index] = await syncBoard(db, apiKey, boards[index])
    }
  }
  await Promise.all(Array.from({ length: SYNC_CONCURRENCY }, worker))

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
  summary.customers = await rebuildCustomersSafely(db)
  return summary
}

/** rebuildCustomers를 돌리되, 실패해도 호출부(이미 item 저장을 마친 동기화)를
 * 실패로 만들지 않는다 — 오류는 로그로 남기고 null을 돌려준다. */
export async function rebuildCustomersSafely(
  db: Firestore,
): Promise<MondayCustomerRebuildResult | null> {
  try {
    return await rebuildCustomers(db)
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
