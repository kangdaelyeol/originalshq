import { createHash } from 'node:crypto'
import { buildMondayItems, detectPhoneColumnId } from '../monday/helper'
import { MondayColumn } from '../monday/types'
import { convertTechItem, TechBoardSource } from './boards'
import { TechRawItem } from './monday-api'
import { TechCellValue, TechItemDoc, TechSubitemDoc } from './types'
import { inquiryDelayDue } from './inquiry-delay-due'

/** Monday에서 받은 item들 → techItems 문서. 보드 이름·컬럼은 item에 없어서
 * 따로 받는다(전체 동기화는 방금 받은 보드, 한 건 갱신은 저장된 meta). */
export function toItemDocs(
  source: TechBoardSource,
  board: { name: string; columns: MondayColumn[] },
  items: TechRawItem[],
  syncedAt: number,
): TechItemDoc[] {
  const phoneColumnId =
    source.phoneColumnId === undefined
      ? detectPhoneColumnId(board.columns)
      : source.phoneColumnId
  const mondayItems = buildMondayItems(
    { id: source.boardId, name: board.name, columns: board.columns, items },
    phoneColumnId,
    syncedAt,
  )
  return mondayItems.map((item, i) => {
    const values: Record<string, TechCellValue> = {}
    for (const cell of items[i].column_values) {
      values[cell.id] = {
        text: cell.display_value ?? cell.text ?? '',
        value: cell.value ?? null,
      }
    }
    const record = convertTechItem(source.key, item)
    const subitems: TechSubitemDoc[] = (items[i].subitems ?? []).map((sub) => ({
      id: String(sub.id),
      name: sub.name,
      values: Object.fromEntries(
        sub.column_values.map((cell) => [
          cell.id,
          {
            text: cell.display_value ?? cell.text ?? '',
            value: (cell as { value?: string | null }).value ?? null,
          },
        ]),
      ),
    }))
    const body = {
      itemId: item.id,
      boardKey: source.key,
      boardId: source.boardId,
      name: item.name,
      groupId: item.groupId,
      record,
      values,
      subitems,
      ...(source.updates
        ? { updateCount: items[i].updates?.length ?? 0 }
        : {}),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      // 아톡문의 10분 지연 알림 — 보낼 시각(1분마다 이 시각이 지난 것만 본다)
      ...(source.key === 'techInquiry' ?
        {
          delayDueAt: inquiryDelayDue(board.columns, values, item.groupTitle),
        } :
        {}),
    }
    // 수정 시각은 빼고 비교한다 — 값이 같으면 다시 쓰지 않게.
    const hash = createHash('sha1')
      .update(JSON.stringify({ ...body, updatedAt: null, record: null }))
      .update(JSON.stringify({ ...record, updatedAt: null }))
      .digest('hex')
    return { ...body, syncedAt, hash } as TechItemDoc
  })
}

/** 지워졌거나 보관된 item — 캐시에서 뺀다. */
export const isGone = (item: TechRawItem | undefined): boolean =>
  !item || (item.state !== undefined && item.state !== 'active')
