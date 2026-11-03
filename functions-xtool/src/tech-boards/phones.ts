import * as logger from 'firebase-functions/logger'
import { extractMondayPhones, isMobilePhone } from '../monday/helper'
import { fetchMonday } from '../monday/client'
import { changeColumnValues, fetchTechBoard } from './monday-api'
import { TechBoardKey } from './types'

// 출장업무 "전화번호" 칸 — item 이름("장성진 010-5060-1512")은 그대로 두고(고객
// 통합·Monday 자동화가 이름에서 번호를 읽는다), 이름에서 번호만 뽑아 따로 만든
// 전화번호 칸에 복사한다. 처음 한 번은 관리자가 일괄로(copyPhonesFromNames),
// 그 뒤로 새로 만들거나 이름을 바꾼 건은 webhook이 채운다(fillPhoneFromName).
// 전화번호 칸이 이미 채워진 건은 건드리지 않는다.

/** 전화번호를 복사하는 보드와 칸 제목 */
export const PHONE_COPY: Partial<Record<TechBoardKey, { title: string }>> = {
  fieldService: { title: '전화번호' },
}

// 한 번에 같이 보내는 쓰기 수 — Monday 분당 한도 안에서 너무 오래 걸리지 않게.
const WRITE_CONCURRENCY = 4

const compact = (title: string) => title.replace(/\s/g, '')

/** 보드에서 그 제목의 전화 칸 */
export const findPhoneColumn = (
  columns: Array<{ id: string; title: string; type: string }>,
  title: string,
) =>
  columns.find((c) => c.type === 'phone' && compact(c.title) === compact(title))

/** 이름에 적힌 대표 번호(숫자만) — 휴대폰이 있으면 휴대폰, 없으면 첫 번호. */
export function phoneFromName(name: string): string | null {
  const phones = extractMondayPhones(name)
  return phones.find(isMobilePhone) ?? phones[0] ?? null
}

/** Monday 전화 칸에 쓰는 값 */
export const phoneValue = (phone: string) => ({
  phone,
  countryShortName: 'KR',
})

/** 전화 칸 만들기 — 이름 칸 바로 옆에. 만든 칸 id. */
async function createPhoneColumn(
  apiKey: string,
  boardId: string,
  title: string,
): Promise<string> {
  const data = await fetchMonday<{ create_column: { id: string } }>(
    apiKey,
    `mutation TechPhoneColumn($boardId: ID!, $title: String!) {
      create_column(
        board_id: $boardId
        title: $title
        column_type: phone
        after_column_id: "name"
      ) { id }
    }`,
    { boardId, title },
  )
  return data.create_column.id
}

export interface PhoneCopyResult {
  column: { id: string | null; title: string; created: boolean }
  total: number
  /** 채울(채운) 건 */
  targets: Array<{ itemId: string; name: string; phone: string }>
  written: number
  alreadyFilled: number
  /** 이름에 번호가 없는 건 */
  noPhone: Array<{ itemId: string; name: string }>
  errors: Array<{ itemId: string; name: string; error: string }>
}

/**
 * 이름 → 전화번호 칸 일괄 복사. dryRun이면 칸을 만들지도 쓰지도 않고 무엇을 할지만
 * 돌려준다(칸이 아직 없으면 모든 번호 있는 건이 대상).
 */
export async function copyPhonesFromNames(
  apiKey: string,
  source: { key: TechBoardKey; boardId: string },
  dryRun: boolean,
): Promise<PhoneCopyResult> {
  const config = PHONE_COPY[source.key]
  if (!config) throw new Error(`${source.key} 보드는 전화번호 복사 대상이 아니에요`)
  const board = await fetchTechBoard(apiKey, source.boardId, false)
  let columnId = findPhoneColumn(board.columns, config.title)?.id ?? null
  let created = false
  if (!columnId && !dryRun) {
    columnId = await createPhoneColumn(apiKey, source.boardId, config.title)
    created = true
  }

  const result: PhoneCopyResult = {
    column: { id: columnId, title: config.title, created },
    total: board.items.length,
    targets: [],
    written: 0,
    alreadyFilled: 0,
    noPhone: [],
    errors: [],
  }
  for (const item of board.items) {
    const current = columnId
      ? item.column_values.find((c) => c.id === columnId)?.text
      : ''
    if (current?.trim()) {
      result.alreadyFilled += 1
      continue
    }
    const phone = phoneFromName(item.name)
    if (!phone) result.noPhone.push({ itemId: item.id, name: item.name })
    else result.targets.push({ itemId: item.id, name: item.name, phone })
  }
  if (dryRun || !columnId) return result

  const phoneColumnId = columnId
  const queue = [...result.targets]
  const work = async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      try {
        await changeColumnValues(apiKey, source.boardId, next.itemId, {
          [phoneColumnId]: phoneValue(next.phone),
        })
        result.written += 1
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.warn(`전화번호 복사 실패(${next.itemId}):`, message)
        result.errors.push({
          itemId: next.itemId,
          name: next.name,
          error: message,
        })
      }
    }
  }
  await Promise.all(Array.from({ length: WRITE_CONCURRENCY }, work))
  return result
}

/**
 * webhook 한 건 — 새로 만들었거나 이름을 바꾼 item의 전화번호 칸이 비어 있고 이름에
 * 번호가 있으면 채운다. 칸이 아직 없으면(일괄 복사 전) 아무것도 안 한다.
 */
export async function fillPhoneFromName(
  apiKey: string,
  source: { key: TechBoardKey; boardId: string },
  columns: Array<{ id: string; title: string; type: string }>,
  item: {
    itemId: string
    name: string
    values: Record<string, { text: string }>
  },
): Promise<boolean> {
  const config = PHONE_COPY[source.key]
  const column = config ? findPhoneColumn(columns, config.title) : undefined
  if (!column || item.values[column.id]?.text?.trim()) return false
  const phone = phoneFromName(item.name)
  if (!phone) return false
  await changeColumnValues(apiKey, source.boardId, item.itemId, {
    [column.id]: phoneValue(phone),
  })
  return true
}
