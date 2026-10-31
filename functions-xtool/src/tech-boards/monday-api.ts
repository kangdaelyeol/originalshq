import { fetchMonday, RawMondayItem } from '../monday/client'
import { MondayColumn } from '../monday/types'

// tech 보드가 쓰는 Monday GraphQL — 고객 통합(monday/client.ts)의 호출 함수만
// 빌려 쓰고, 질의는 따로 둔다(쓰기·컬럼 설정·value까지 받아야 해서).

const PAGE_SIZE = 200

export interface TechRawColumn extends MondayColumn {
  /** 상태·드롭다운 라벨이 담긴 설정(JSON 문자열) */
  settings_str: string | null
}

export interface TechRawItem extends RawMondayItem {
  /** active · archived · deleted */
  state?: string
  board?: { id: string } | null
  column_values: Array<RawMondayItem['column_values'][number] & {
    value: string | null
  }>
}

export interface TechRawBoard {
  id: string
  name: string
  columns: TechRawColumn[]
  groups: Array<{ id: string; title: string }>
  items: TechRawItem[]
}

const COLUMN_VALUE_FIELDS = `
  id
  type
  text
  value
  ... on MirrorValue { display_value }
  ... on FormulaValue { display_value }
  ... on BoardRelationValue { display_value }
`

const itemFields = (withSubitems: boolean) => `
  id
  name
  url
  state
  created_at
  updated_at
  board { id }
  group { id title }
  column_values { ${COLUMN_VALUE_FIELDS} }
  ${withSubitems ? `subitems {
    id
    name
    column_values { ${COLUMN_VALUE_FIELDS} column { title } }
  }` : ''}
`

const BOARD_QUERY = `
  query TechBoard($boardId: ID!) {
    boards(ids: [$boardId]) {
      id
      name
      columns { id title type settings_str }
      groups { id title }
    }
  }
`

/** 보드 하나 — 이름·컬럼(설정 포함)·그룹·item 전부. 못 읽으면 throw. */
export async function fetchTechBoard(
  apiKey: string,
  boardId: string,
  withSubitems: boolean,
): Promise<TechRawBoard> {
  const meta = await fetchMonday<{
    boards: Array<Omit<TechRawBoard, 'items'>> | null
  }>(apiKey, BOARD_QUERY, { boardId })
  const board = meta.boards?.[0]
  if (!board) {
    throw new Error(`Monday 보드를 찾을 수 없습니다(boardId: ${boardId})`)
  }

  type Page = { cursor: string | null; items: TechRawItem[] }
  const first = await fetchMonday<{
    boards: Array<{ items_page: Page }> | null
  }>(
    apiKey,
    `query TechItems($boardId: ID!, $limit: Int!) {
      boards(ids: [$boardId]) {
        items_page(limit: $limit) {
          cursor
          items { ${itemFields(withSubitems)} }
        }
      }
    }`,
    { boardId, limit: PAGE_SIZE },
  )
  const firstPage = first.boards?.[0]?.items_page
  if (!firstPage) {
    throw new Error(`Monday 보드를 찾을 수 없습니다(boardId: ${boardId})`)
  }
  const items = [...firstPage.items]
  let cursor = firstPage.cursor
  while (cursor) {
    const next = await fetchMonday<{ next_items_page: Page }>(
      apiKey,
      `query TechNext($cursor: String!, $limit: Int!) {
        next_items_page(cursor: $cursor, limit: $limit) {
          cursor
          items { ${itemFields(withSubitems)} }
        }
      }`,
      { cursor, limit: PAGE_SIZE },
    )
    items.push(...next.next_items_page.items)
    cursor = next.next_items_page.cursor
  }
  return { ...board, items }
}

/** item 몇 개만 다시 읽기(수정 직후·webhook). 지워진 item은 결과에 없거나
 * state가 deleted/archived로 온다. */
export async function fetchTechItems(
  apiKey: string,
  itemIds: string[],
  withSubitems: boolean,
): Promise<TechRawItem[]> {
  const data = await fetchMonday<{ items: TechRawItem[] | null }>(
    apiKey,
    `query TechItemsById($ids: [ID!]) {
      items(ids: $ids) { ${itemFields(withSubitems)} }
    }`,
    { ids: itemIds },
  )
  return data.items ?? []
}

export async function fetchMondayUsers(apiKey: string): Promise<Array<{
  id: string
  name: string
  email: string
  enabled: boolean
}>> {
  const data = await fetchMonday<{
    users: Array<{ id: string; name: string; email: string; enabled: boolean }>
  }>(
    apiKey,
    `query TechUsers {
      users(kind: non_guests, limit: 500) { id name email enabled }
    }`,
    {},
  )
  return data.users ?? []
}

/** 이름·컬럼 값 바꾸기 — 한 번에 여러 칸. */
export async function changeColumnValues(
  apiKey: string,
  boardId: string,
  itemId: string,
  columnValues: Record<string, unknown>,
): Promise<void> {
  await fetchMonday(
    apiKey,
    `mutation TechChange($boardId: ID!, $itemId: ID!, $values: JSON!) {
      change_multiple_column_values(
        board_id: $boardId
        item_id: $itemId
        column_values: $values
      ) { id }
    }`,
    { boardId, itemId, values: JSON.stringify(columnValues) },
  )
}

/** 그룹(진행 단계) 옮기기 */
export async function moveItemToGroup(
  apiKey: string,
  itemId: string,
  groupId: string,
): Promise<void> {
  await fetchMonday(
    apiKey,
    `mutation TechMove($itemId: ID!, $groupId: String!) {
      move_item_to_group(item_id: $itemId, group_id: $groupId) { id }
    }`,
    { itemId, groupId },
  )
}

/** 새 item — 만든 item id를 돌려준다. */
export async function createItem(
  apiKey: string,
  boardId: string,
  groupId: string | null,
  name: string,
  columnValues: Record<string, unknown>,
): Promise<string> {
  const data = await fetchMonday<{ create_item: { id: string } }>(
    apiKey,
    `mutation TechCreate(
      $boardId: ID!
      $groupId: String
      $name: String!
      $values: JSON
    ) {
      create_item(
        board_id: $boardId
        group_id: $groupId
        item_name: $name
        column_values: $values
      ) { id }
    }`,
    { boardId, groupId, name, values: JSON.stringify(columnValues) },
  )
  return data.create_item.id
}

export async function createWebhook(
  apiKey: string,
  boardId: string,
  url: string,
  event: string,
): Promise<string> {
  const data = await fetchMonday<{ create_webhook: { id: string } }>(
    apiKey,
    `mutation TechWebhook(
      $boardId: ID!
      $url: String!
      $event: WebhookEventType!
    ) {
      create_webhook(board_id: $boardId, url: $url, event: $event) { id }
    }`,
    { boardId, url, event },
  )
  return data.create_webhook.id
}

export async function deleteWebhook(apiKey: string, id: string): Promise<void> {
  await fetchMonday(
    apiKey,
    `mutation TechWebhookDelete($id: ID!) {
      delete_webhook(id: $id) { id }
    }`,
    { id },
  )
}
