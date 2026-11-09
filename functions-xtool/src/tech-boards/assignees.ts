import * as logger from 'firebase-functions/logger'
import { fetchMonday } from '../monday/client'
import { squash } from '../monday/fields'
import { changeColumnValues, fetchTechBoard, TechRawItem } from './monday-api'
import { TechBoardKey } from './types'

// 담당자(엑스툴) 글자 칸 — 담당자는 우리 시스템(관리자 화면에 등록한 기술팀 명단)으로만
// 정한다. Monday 사용자 계정은 쓰지 않는다(직원들이 Monday를 떠난다). 그래서 보드마다 따로
// 만든 이 글자 칸에 구성원 이름을 ", "로 이어 쓴다. 원래 사람 칸("담당자")은 그대로 두고,
// 처음 한 번 관리자가 그 칸에 보이는 이름 글자를 이 칸으로 옮긴다(copyAssignees — 글자만
// 복사, Monday 사용자 조회·이메일 매핑 없음). 기록(record)의 담당자는 이 칸이 있으면 이
// 칸에서 읽는다(boards.ts).

export const ASSIGNEE_TITLE = '담당자(엑스툴)'
// 원래 담당자 — Monday 사람 칸 제목
const PEOPLE_TITLE = '담당자'

/** 담당자 칸이 있는 보드 */
export const ASSIGNEE_BOARDS: readonly TechBoardKey[] = [
  'fieldService',
  'repair',
  'techInquiry',
  'techTask',
  'rentals',
]

// 한 번에 같이 보내는 쓰기 수 — Monday 분당 한도 안에서 너무 오래 걸리지 않게.
const WRITE_CONCURRENCY = 4
// 한 번 부를 때 쓰는 시간 — 함수 제한 시간 안에 끝내고, 남은 건은 다시 불러 이어서
// 쓴다(이미 채운 건은 건너뛴다).
const WRITE_BUDGET_MS = 180_000

type Column = { id: string; title: string; type: string }

/** 보드의 담당자(엑스툴) 글자 칸 */
export const findAssigneeColumn = (columns: Column[]) =>
  columns.find(
    (c) => c.type === 'text' && squash(c.title) === squash(ASSIGNEE_TITLE),
  )

/** 글자 칸 만들기 — 원래 담당자 칸 바로 옆에. 만든 칸 id. */
async function createAssigneeColumn(
  apiKey: string,
  boardId: string,
  afterColumnId: string,
): Promise<string> {
  const data = await fetchMonday<{ create_column: { id: string } }>(
    apiKey,
    `mutation TechAssigneeColumn(
      $boardId: ID!
      $title: String!
      $after: ID
    ) {
      create_column(
        board_id: $boardId
        title: $title
        column_type: text
        after_column_id: $after
      ) { id }
    }`,
    { boardId, title: ASSIGNEE_TITLE, after: afterColumnId },
  )
  return data.create_column.id
}

/** 사람 칸 글자에 보이는 이름들(글자 그대로) — Monday가 지운 계정("삭제된 팀원")은
 * 빼고, 겹친 이름은 하나만. 담당자 규칙(rules.ts)도 쓴다. */
export function peopleNames(text: string): string[] {
  const names = text.split(',').map((s) => s.trim())
  return [
    ...new Set(names.filter((n) => n && !/^삭제된 팀원$/.test(n))),
  ]
}

/** 사람 칸 한 칸에 보이는 이름들 */
const namesOf = (cell: TechRawItem['column_values'][number] | undefined) =>
  peopleNames(cell?.text ?? '')

export interface AssigneeCopyResult {
  column: { id: string | null; title: string; created: boolean }
  total: number
  /** 채울(채운) 건 */
  targets: Array<{ itemId: string; name: string; assignees: string }>
  written: number
  alreadyFilled: number
  /** 시간이 모자라 이번에 못 쓴 건 — 다시 부르면 이어서 쓴다 */
  remaining: number
  errors: Array<{ itemId: string; name: string; error: string }>
}

/**
 * 원래 담당자(사람 칸에 보이는 이름) → 담당자(엑스툴) 글자 칸 일괄 복사. dryRun이면 칸을
 * 만들지도 쓰지도 않고 무엇을 할지만 돌려준다. 이미 채워진 건은 건드리지 않는다.
 */
export async function copyAssignees(
  apiKey: string,
  source: { key: TechBoardKey; boardId: string },
  dryRun: boolean,
): Promise<AssigneeCopyResult> {
  if (!ASSIGNEE_BOARDS.includes(source.key)) {
    throw new Error(`${source.key} 보드에는 담당자 칸이 없어요`)
  }
  const board = await fetchTechBoard(apiKey, source.boardId, false)
  const people = board.columns.find(
    (c) => c.type === 'people' && squash(c.title) === PEOPLE_TITLE,
  )
  let columnId = findAssigneeColumn(board.columns)?.id ?? null
  let created = false
  if (!columnId && !dryRun) {
    columnId = await createAssigneeColumn(
      apiKey,
      source.boardId,
      people?.id ?? 'name',
    )
    created = true
  }

  const result: AssigneeCopyResult = {
    column: { id: columnId, title: ASSIGNEE_TITLE, created },
    total: board.items.length,
    targets: [],
    written: 0,
    alreadyFilled: 0,
    remaining: 0,
    errors: [],
  }
  for (const item of board.items) {
    const current = columnId ?
      item.column_values.find((c) => c.id === columnId)?.text?.trim() :
      ''
    if (current) {
      result.alreadyFilled += 1
      continue
    }
    const cell = people ?
      item.column_values.find((c) => c.id === people.id) :
      undefined
    const names = namesOf(cell)
    if (names.length > 0) {
      result.targets.push({
        itemId: item.id,
        name: item.name,
        assignees: names.join(', '),
      })
    }
  }
  if (dryRun || !columnId) return result

  const target = columnId
  const queue = [...result.targets]
  const deadline = Date.now() + WRITE_BUDGET_MS
  const work = async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      if (Date.now() > deadline) {
        queue.unshift(next)
        return
      }
      try {
        await changeColumnValues(apiKey, source.boardId, next.itemId, {
          [target]: next.assignees,
        })
        result.written += 1
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.warn(`담당자 복사 실패(${next.itemId}):`, message)
        result.errors.push({
          itemId: next.itemId,
          name: next.name,
          error: message,
        })
      }
    }
  }
  await Promise.all(Array.from({ length: WRITE_CONCURRENCY }, work))
  result.remaining = queue.length
  return result
}
