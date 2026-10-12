import * as logger from 'firebase-functions/logger'
import { Firestore } from 'firebase-admin/firestore'
import { fetchBoard } from './client'
import {
  getBoard,
  listBoards,
  replaceBoardItems,
  saveBoard,
  updateBoard,
} from './firestore'
import { buildMondayItems, detectPhoneColumnId } from './helper'
import {
  MondayBoard,
  MondayBoardPreview,
  MondayBoardSyncResult,
  MondaySyncSummary,
} from './types'

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
  const raw = await fetchBoard(apiKey, boardId)
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
    const raw = await fetchBoard(apiKey, board.id)
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

/** 등록된 보드를 전부(또는 boardId로 지정한 하나만) 동기화한다. 보드끼리는
 * 독립이라 하나가 실패해도 나머지는 계속 진행한다. Monday API의 분당
 * 사용량 제한에 걸리지 않도록 동시에 돌리지 않고 차례로 처리한다. */
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

  const summary: MondaySyncSummary = { boards: [], okCount: 0, failedCount: 0 }
  for (const board of boards) {
    const result = await syncBoard(db, apiKey, board)
    summary.boards.push({ boardId: board.id, name: board.name, ...result })
    if (result.ok) summary.okCount += 1
    else summary.failedCount += 1
  }
  return summary
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
        phoneColumnId,
        resolvedPhoneColumnId: null,
        registeredAt: Date.now(),
        lastSync: null,
      }
  await saveBoard(db, board)
  await syncBoard(db, apiKey, board)
  return (await getBoard(db, boardId)) as MondayBoard
}
