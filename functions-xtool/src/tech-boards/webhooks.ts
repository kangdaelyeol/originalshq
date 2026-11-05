import * as logger from 'firebase-functions/logger'
import { Firestore } from 'firebase-admin/firestore'
import { findTechBoard, RETIRED_TECH_BOARDS, TECH_BOARDS } from './boards'
import { refreshItems } from './edits'
import { getBoardMeta, saveBoardMeta } from './firestore'
import { createWebhook, deleteWebhook } from './monday-api'
import { fillPhoneFromName, PHONE_COPY } from './phones'
import { refreshItemUpdates } from './updates'

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

// 새로 만들었거나 이름을 바꾼 item — 전화번호 칸 채우기(phones.ts)를 본다. Monday가
// 보내는 type은 구독 이름과 달라서(create_pulse·update_name) 둘 다 받는다.
const NAME_EVENT_TYPES = new Set([
  'create_pulse',
  'create_item',
  'update_name',
  'change_name',
])

// 업데이트(댓글)를 세는 보드만 — 달리거나 지워지면 그 item을 다시 읽어 개수를 맞추고
// 업데이트 캐시(techItemUpdates)도 새로 쓴다.
const UPDATE_EVENTS = ['create_update', 'edit_update', 'delete_update']

/** 업데이트 이벤트인지 — Monday가 보내는 type이 구독 이름과 다를 수 있어 본문 필드도
 * 본다(업데이트 이벤트에는 updateId가 실려 온다). */
const isUpdateEvent = (event: MondayWebhookEvent) =>
  event.updateId !== undefined ||
  /(^|_)(create|edit|delete)_update$/.test(String(event.type ?? ''))

export interface MondayWebhookEvent {
  type?: string
  boardId?: number | string
  pulseId?: number | string
  itemId?: number | string
  parentItemId?: number | string
  parentItemBoardId?: number | string
  updateId?: number | string
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
  const meta = await getBoardMeta(db, source.key)
  const updates =
    source.updates && isUpdateEvent(event) ?
      refreshItemUpdates(db, apiKey, source.key, itemId).catch((error) =>
        logger.warn(`업데이트 캐시 갱신 실패(${itemId}):`, error),
      ) :
      null
  const refreshed = await refreshItems(db, apiKey, source, [itemId], meta)
  await updates
  const doc = refreshed.get(itemId)
  // 하위 아이템 이벤트(parentItemId)는 부모 이름이 바뀐 게 아니라 빼고 본다.
  if (
    doc &&
    meta &&
    PHONE_COPY[source.key] &&
    !event.parentItemId &&
    NAME_EVENT_TYPES.has(String(event.type ?? ''))
  ) {
    // 채우면 Monday가 change_column_value를 다시 보내서 캐시는 그때 맞춰진다.
    await fillPhoneFromName(apiKey, source, meta.columns, doc).catch((error) =>
      logger.warn(`전화번호 칸 채우기 실패(${itemId}):`, error),
    )
  }
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
    const events = [
      ...ITEM_EVENTS,
      ...(source.subitems ? SUBITEM_EVENTS : []),
      ...(source.updates ? UPDATE_EVENTS : []),
    ]
    // 보드 안의 이벤트는 동시에 만든다 — Monday가 만들 때마다 우리 주소로 확인
    // 요청(challenge)을 보내서, 하나씩 하면 보드 9개에 1분 반이 걸린다.
    const settled = await Promise.allSettled(
      events.map((event) => createWebhook(apiKey, source.boardId, url, event)),
    )
    const ids: string[] = []
    const errors: string[] = []
    settled.forEach((result, i) => {
      if (result.status === 'fulfilled') ids.push(result.value)
      else {
        const reason = result.reason
        errors.push(
          `${events[i]}: ${reason instanceof Error ? reason.message : reason}`,
        )
      }
    })
    await saveBoardMeta(db, source.key, {
      boardId: source.boardId,
      webhooks: { ids, at: Date.now(), errors },
    })
    results.push({ key: source.key, created: ids.length, errors })
  }
  // 연결을 끊은 보드 — 전에 만든 webhook만 지운다(새로 만들지 않는다). 지우지 못한 것은 기록에 남겨
  // 다음에 다시 지운다.
  for (const retired of RETIRED_TECH_BOARDS) {
    const meta = await getBoardMeta(db, retired.key)
    const ids = meta?.webhooks?.ids ?? []
    if (ids.length === 0) continue
    const left: string[] = []
    const errors: string[] = []
    for (const id of ids) {
      await deleteWebhook(apiKey, id).catch((error) => {
        left.push(id)
        errors.push(`${id}: ${error instanceof Error ? error.message : error}`)
        logger.warn(`webhook 삭제 실패(${retired.key} ${id}):`, error)
      })
    }
    await saveBoardMeta(db, retired.key, {
      webhooks: { ids: left, at: Date.now(), errors },
    })
  }
  return results
}
