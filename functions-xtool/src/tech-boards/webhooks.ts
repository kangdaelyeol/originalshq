import * as logger from 'firebase-functions/logger'
import { Firestore } from 'firebase-admin/firestore'
import { findTechBoard, TECH_BOARDS } from './boards'
import { refreshItems } from './edits'
import { getBoardMeta, saveBoardMeta } from './firestore'
import { createWebhook, deleteWebhook } from './monday-api'

// Monday webhook — Monday에서 직접 고친 내용을 몇 초 안에 캐시에 반영한다.
// 내용(값)은 믿지 않는다: "이 보드의 이 item이 바뀌었다"만 보고 Monday에서 다시
// 읽는다. 그래서 누가 이 주소로 가짜 요청을 보내도 Monday를 다시 읽는 것뿐이다.

const ITEM_EVENTS = [
  'create_item',
  'change_column_value',
  'change_name',
  'item_moved_to_any_group',
  'item_archived',
  'item_deleted',
  'item_restored',
]
// 하위 아이템이 있는 보드만 — 하위 아이템이 바뀌면 부모 item을 다시 읽는다.
const SUBITEM_EVENTS = [
  'create_subitem',
  'change_subitem_column_value',
  'change_subitem_name',
  'subitem_archived',
  'subitem_deleted',
]

export interface MondayWebhookEvent {
  type?: string
  boardId?: number | string
  pulseId?: number | string
  itemId?: number | string
  parentItemId?: number | string
  parentItemBoardId?: number | string
}

/** webhook 하나 처리 — 우리 보드가 아니면 무시. */
export async function handleWebhookEvent(
  db: Firestore,
  apiKey: string,
  event: MondayWebhookEvent,
): Promise<'ignored' | 'refreshed'> {
  const boardId = String(event.parentItemBoardId ?? event.boardId ?? '')
  const itemId = String(
    event.parentItemId ?? event.pulseId ?? event.itemId ?? '',
  )
  const source = findTechBoard({ boardId })
  if (!source || !/^\d+$/.test(itemId)) return 'ignored'
  await refreshItems(db, apiKey, source, [itemId])
  return 'refreshed'
}

/** 보드마다 webhook을 (다시) 만든다 — 전에 만든 것은 지우고. */
export async function setupTechWebhooks(
  db: Firestore,
  apiKey: string,
  url: string,
): Promise<Array<{ key: string; created: number; errors: string[] }>> {
  const results = []
  for (const source of TECH_BOARDS) {
    const meta = await getBoardMeta(db, source.key)
    for (const id of meta?.webhooks?.ids ?? []) {
      await deleteWebhook(apiKey, id).catch((error) =>
        logger.warn(`webhook 삭제 실패(${source.key} ${id}):`, error),
      )
    }
    const events = [...ITEM_EVENTS, ...(source.subitems ? SUBITEM_EVENTS : [])]
    const ids: string[] = []
    const errors: string[] = []
    for (const event of events) {
      try {
        ids.push(await createWebhook(apiKey, source.boardId, url, event))
      } catch (error) {
        errors.push(
          `${event}: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }
    await saveBoardMeta(db, source.key, {
      boardId: source.boardId,
      webhooks: { ids, at: Date.now(), errors },
    })
    results.push({ key: source.key, created: ids.length, errors })
  }
  return results
}
