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
  /** 업데이트(댓글) id — 업데이트 개수를 세는 보드에서만 받는다. */
  updates?: Array<{ id: string }>
}

export interface TechRawBoard {
  id: string
  name: string
  columns: TechRawColumn[]
  groups: Array<{ id: string; title: string }>
  items: TechRawItem[]
  /** 하위 아이템 보드 — 하위 아이템까지 받은 보드만. */
  subitemBoard?: { id: string; columns: TechRawColumn[] }
}

/** 하위 아이템 칸(subtasks)의 설정에 적힌 하위 아이템 보드 id */
const subitemBoardId = (columns: TechRawColumn[]): string | null => {
  const column = columns.find((c) => c.type === 'subtasks')
  try {
    const ids = JSON.parse(column?.settings_str ?? '{}').boardIds as
      | Array<number | string>
      | undefined
    return ids?.length ? String(ids[0]) : null
  } catch {
    return null
  }
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

// 업데이트 개수를 셀 때 받는 최대 수 — 말풍선 배지에 쓴다(넘으면 그 수로 보인다).
const UPDATE_COUNT_LIMIT = 100

const itemFields = (withSubitems: boolean, withUpdates = false) => `
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
  ${withUpdates ? `updates(limit: ${UPDATE_COUNT_LIMIT}) { id }` : ''}
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
  withUpdates = false,
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
          items { ${itemFields(withSubitems, withUpdates)} }
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
          items { ${itemFields(withSubitems, withUpdates)} }
        }
      }`,
      { cursor, limit: PAGE_SIZE },
    )
    items.push(...next.next_items_page.items)
    cursor = next.next_items_page.cursor
  }

  let subitemBoard: TechRawBoard['subitemBoard']
  const subId = withSubitems ? subitemBoardId(board.columns) : null
  if (subId) {
    const sub = await fetchMonday<{
      boards: Array<{ id: string; columns: TechRawColumn[] }> | null
    }>(
      apiKey,
      `query TechSubBoard($boardId: ID!) {
        boards(ids: [$boardId]) { id columns { id title type settings_str } }
      }`,
      { boardId: subId },
    )
    if (sub.boards?.[0]) subitemBoard = sub.boards[0]
  }
  return { ...board, items, subitemBoard }
}

/** item 몇 개만 다시 읽기(수정 직후·webhook). 지워진 item은 결과에 없거나
 * state가 deleted/archived로 온다. */
export async function fetchTechItems(
  apiKey: string,
  itemIds: string[],
  withSubitems: boolean,
  withUpdates = false,
): Promise<TechRawItem[]> {
  const data = await fetchMonday<{ items: TechRawItem[] | null }>(
    apiKey,
    `query TechItemsById($ids: [ID!]) {
      items(ids: $ids) { ${itemFields(withSubitems, withUpdates)} }
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

/** 하위 아이템 만들기 — 만든 id를 돌려준다. */
export async function createSubitem(
  apiKey: string,
  parentId: string,
  name: string,
  columnValues: Record<string, unknown>,
): Promise<string> {
  const data = await fetchMonday<{ create_subitem: { id: string } }>(
    apiKey,
    `mutation TechSubCreate($parentId: ID!, $name: String!, $values: JSON) {
      create_subitem(
        parent_item_id: $parentId
        item_name: $name
        column_values: $values
      ) { id }
    }`,
    { parentId, name, values: JSON.stringify(columnValues) },
  )
  return data.create_subitem.id
}

/** item(하위 아이템 포함) 지우기 — Monday 휴지통으로 간다. */
export async function deleteItem(
  apiKey: string,
  itemId: string,
): Promise<void> {
  await fetchMonday(
    apiKey,
    `mutation TechDelete($itemId: ID!) {
      delete_item(item_id: $itemId) { id }
    }`,
    { itemId },
  )
}

const MONDAY_FILE_URL = 'https://api.monday.com/v2/file'

/** 파일 칸에 파일 붙이기 — 기존 파일 뒤에 더해진다(덮어쓰지 않음). 파일 업로드는
 * 일반 API가 아니라 /v2/file로 multipart로 보낸다. */
export async function addFileToColumn(
  apiKey: string,
  itemId: string,
  columnId: string,
  file: { name: string; type: string; data: Buffer },
): Promise<string> {
  // 질의 문자열에 그대로 넣으므로 모양을 엄격히 확인한다.
  if (!/^\d+$/.test(itemId) || !/^[A-Za-z0-9_]+$/.test(columnId)) {
    throw new Error('잘못된 항목·칸 id')
  }
  const form = new FormData()
  form.append(
    'query',
    `mutation ($file: File!) {
      add_file_to_column(
        item_id: ${itemId}
        column_id: "${columnId}"
        file: $file
      ) { id }
    }`,
  )
  form.append(
    'variables[file]',
    new Blob([new Uint8Array(file.data)], { type: file.type }),
    file.name,
  )
  const response = await fetch(MONDAY_FILE_URL, {
    method: 'POST',
    headers: { Authorization: apiKey },
    body: form,
  })
  const json = (await response.json().catch(() => ({}))) as {
    data?: { add_file_to_column?: { id: string } }
    errors?: unknown
    error_message?: string
  }
  if (!response.ok || json.errors || !json.data?.add_file_to_column) {
    throw new Error(
      `Monday 파일 업로드 실패(${response.status}): ` +
        JSON.stringify(json.errors ?? json.error_message ?? json),
    )
  }
  return json.data.add_file_to_column.id
}

export interface MondayAsset {
  id: string
  name: string
  /** 임시 공개 주소 — 1시간 유효 */
  public_url: string | null
  /** 썸네일 주소 — 사진만 */
  url_thumbnail: string | null
  file_extension: string | null
  file_size: number | null
}

export async function fetchAssets(
  apiKey: string,
  ids: string[],
): Promise<MondayAsset[]> {
  if (ids.length === 0) return []
  const data = await fetchMonday<{ assets: MondayAsset[] | null }>(
    apiKey,
    `query TechAssets($ids: [ID!]!) {
      assets(ids: $ids) {
        id name public_url url_thumbnail file_extension file_size
      }
    }`,
    { ids },
  )
  return data.assets ?? []
}
