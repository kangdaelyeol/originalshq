import { MondayColumn } from './types'

const MONDAY_API_URL = 'https://api.monday.com/v2'

// items_page 한 번에 몇 건씩 받을지 — Monday API 문서상 최대 500.
const PAGE_SIZE = 500

export interface RawMondayColumnValue {
  id: string
  type: string
  text: string | null
  /** 수식/미러/연결(FormulaValue/MirrorValue/BoardRelationValue) 컬럼만 있는
   * 필드 — 이 타입들은 text가 빈 값으로 내려오고 실제 값은 여기 담긴다. */
  display_value?: string | null
}

export interface RawMondayItem {
  id: string
  name: string
  url: string | null
  created_at: string | null
  updated_at: string | null
  group: { id: string; title: string } | null
  column_values: RawMondayColumnValue[]
}

export interface RawMondayBoard {
  id: string
  name: string
  columns: MondayColumn[]
  items: RawMondayItem[]
}

interface ItemsPage {
  cursor: string | null
  items: RawMondayItem[]
}

/** GraphQL POST 호출 하나 — Monday API 호출부가 전부 이 함수를 거친다.
 * REST와 달리 실패가 HTTP status가 아니라 body의 errors로도 올 수 있어
 * 둘 다 확인한다. */
async function fetchMonday<T>(
  apiKey: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': apiKey,
    },
    body: JSON.stringify({ query, variables }),
  })

  if (!response.ok) {
    throw new Error(
      `Monday API 호출 실패(${response.status}): ${await response.text()}`,
    )
  }

  const json = (await response.json()) as { data?: T; errors?: unknown }
  if (json.errors) {
    throw new Error(`Monday GraphQL 오류: ${JSON.stringify(json.errors)}`)
  }
  if (!json.data) {
    throw new Error('Monday API 응답에 data가 없습니다')
  }
  return json.data
}

// 컬럼을 ids로 고르지 않고 전부 받는다 — 보드마다 컬럼이 달라서, 어떤 컬럼이
// 필요한지는 저장한 뒤에 정한다.
const ITEM_FIELDS = `
  id
  name
  url
  created_at
  updated_at
  group {
    id
    title
  }
  column_values {
    id
    type
    text
    ... on MirrorValue {
      display_value
    }
    ... on FormulaValue {
      display_value
    }
    ... on BoardRelationValue {
      display_value
    }
  }
`

const BOARD_QUERY = `
  query GetBoard($boardId: ID!, $limit: Int!) {
    boards(ids: [$boardId]) {
      id
      name
      columns {
        id
        title
        type
      }
      items_page(limit: $limit) {
        cursor
        items {
          ${ITEM_FIELDS}
        }
      }
    }
  }
`

const NEXT_PAGE_QUERY = `
  query GetBoardNextPage($cursor: String!, $limit: Int!) {
    next_items_page(cursor: $cursor, limit: $limit) {
      cursor
      items {
        ${ITEM_FIELDS}
      }
    }
  }
`

/** 보드 하나의 이름·컬럼 정의·item 전부를 받아온다. 보드가 없거나 이 API
 * 키로 볼 수 없으면 throw — 호출부(sync.ts)가 "빈 보드"로 오해해 저장된
 * 문서를 지우는 일이 없도록, 못 읽은 것과 비어 있는 것을 여기서 구분한다. */
export async function fetchBoard(
  apiKey: string,
  boardId: string,
): Promise<RawMondayBoard> {
  const first = await fetchMonday<{
    boards: Array<{
      id: string
      name: string
      columns: MondayColumn[]
      items_page: ItemsPage
    }> | null
  }>(apiKey, BOARD_QUERY, { boardId, limit: PAGE_SIZE })

  const board = first.boards?.[0]
  if (!board) {
    throw new Error(`Monday 보드를 찾을 수 없습니다(boardId: ${boardId})`)
  }

  const items = [...board.items_page.items]
  let cursor = board.items_page.cursor
  while (cursor) {
    const next = await fetchMonday<{ next_items_page: ItemsPage }>(
      apiKey,
      NEXT_PAGE_QUERY,
      { cursor, limit: PAGE_SIZE },
    )
    items.push(...next.next_items_page.items)
    cursor = next.next_items_page.cursor
  }

  return { id: board.id, name: board.name, columns: board.columns, items }
}
