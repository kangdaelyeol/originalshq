import * as logger from 'firebase-functions/logger'
import { Firestore } from 'firebase-admin/firestore'
import { TECH_BOARDS, TechBoardSource } from './boards'
import { toTechColumns } from './columns'
import {
  replaceBoardItems,
  saveBoardMeta,
  saveMondayUsers,
} from './firestore'
import { toItemDocs } from './items'
import { fetchMondayUsers, fetchTechBoard } from './monday-api'
import { TechBoardKey, TechSyncResult } from './types'

export interface TechBoardsSyncSummary {
  okCount: number
  failedCount: number
  boards: Array<{ key: TechBoardKey } & TechSyncResult>
  users: number | null
}

/** 보드 하나를 Monday에서 다시 읽어 컬럼·그룹·item을 맞춘다. 실패하면 저장된
 * 것은 두고 실패 결과만 남긴다(일시적인 오류가 "전부 삭제"로 이어지지 않게). */
async function syncTechBoard(
  db: Firestore,
  apiKey: string,
  source: TechBoardSource,
): Promise<TechSyncResult> {
  const startedAt = Date.now()
  try {
    const raw = await fetchTechBoard(apiKey, source.boardId, !!source.subitems)
    const docs = toItemDocs(source, raw, raw.items, Date.now())
    const { written, deleted } = await replaceBoardItems(
      db,
      source.key,
      docs,
      startedAt,
    )
    const result: TechSyncResult = {
      ok: true,
      at: Date.now(),
      count: docs.length,
      written,
      deleted,
    }
    await saveBoardMeta(db, source.key, {
      boardId: source.boardId,
      name: raw.name,
      columns: toTechColumns(raw.columns),
      groups: raw.groups,
      syncedAt: result.at,
      lastSync: result,
    })
    return result
  } catch (error) {
    logger.error(`기술 보드 동기화 실패(${source.key}):`, error)
    const result: TechSyncResult = {
      ok: false,
      at: Date.now(),
      count: 0,
      error: error instanceof Error ? error.message : String(error),
    }
    await saveBoardMeta(db, source.key, {
      boardId: source.boardId,
      lastSync: result,
    })
    return result
  }
}

/** 기술지원팀 보드 전부 + 담당자로 고를 Monday 사용자. 보드는 차례로 읽는다
 * (같은 시각에 도는 고객 통합 동기화와 Monday 요청 한도를 나눠 쓴다). */
export async function syncTechBoards(
  db: Firestore,
  apiKey: string,
): Promise<TechBoardsSyncSummary> {
  let users: number | null = null
  try {
    const list = await fetchMondayUsers(apiKey)
    await saveMondayUsers(
      db,
      list.map((user) => ({ ...user, id: String(user.id) })),
    )
    users = list.length
  } catch (error) {
    logger.error('Monday 사용자 목록 동기화 실패:', error)
  }

  const boards: TechBoardsSyncSummary['boards'] = []
  for (const source of TECH_BOARDS) {
    const result = await syncTechBoard(db, apiKey, source)
    boards.push({ key: source.key, ...result })
  }
  const okCount = boards.filter((board) => board.ok).length
  return { okCount, failedCount: boards.length - okCount, boards, users }
}
