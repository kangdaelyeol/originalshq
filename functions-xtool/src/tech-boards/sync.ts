import * as logger from 'firebase-functions/logger'
import { Firestore } from 'firebase-admin/firestore'
import { fetchBoard } from '../monday/client'
import { buildMondayItems } from '../monday/helper'
import { convertTechBoard, TECH_BOARDS } from './boards'
import { saveTechBoard, saveTechBoardFailure } from './firestore'
import { TechBoardKey, TechBoardSyncResult } from './types'

export interface TechBoardsSyncSummary {
  okCount: number
  failedCount: number
  boards: Array<{ key: TechBoardKey } & TechBoardSyncResult>
}

/** 보드 하나를 Monday에서 읽어 기록으로 바꿔 저장한다. 실패하면 저장된
 * 기록은 두고 실패 결과만 남긴다. */
async function syncTechBoard(
  db: Firestore,
  apiKey: string,
  key: TechBoardKey,
  boardId: string,
): Promise<TechBoardSyncResult> {
  try {
    const raw = await fetchBoard(apiKey, boardId)
    const at = Date.now()
    // 연락처는 기록에 적힌 그대로 쓰므로 휴대폰 컬럼을 고르지 않는다(null).
    const records = convertTechBoard(key, buildMondayItems(raw, null, at))
    const result: TechBoardSyncResult = { ok: true, at, count: records.length }
    await saveTechBoard(db, { key, boardId, name: raw.name, records, result })
    return result
  } catch (error) {
    logger.error(`기술 보드 동기화 실패(${key}, boardId: ${boardId}):`, error)
    const result: TechBoardSyncResult = {
      ok: false,
      at: Date.now(),
      count: 0,
      error: error instanceof Error ? error.message : String(error),
    }
    await saveTechBoardFailure(db, key, boardId, result)
    return result
  }
}

/** 기술지원팀 전용 보드 전부 — 보드 다섯 개라 차례로 읽는다. */
export async function syncTechBoards(
  db: Firestore,
  apiKey: string,
): Promise<TechBoardsSyncSummary> {
  const boards: TechBoardsSyncSummary['boards'] = []
  for (const { key, boardId } of TECH_BOARDS) {
    boards.push({ key, ...(await syncTechBoard(db, apiKey, key, boardId)) })
  }
  const okCount = boards.filter((board) => board.ok).length
  return { okCount, failedCount: boards.length - okCount, boards }
}
