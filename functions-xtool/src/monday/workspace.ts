import { fetchMonday } from './client'
import { MondayColumn } from './types'

// 한 요청에 받을 보드 수 — 보드마다 컬럼·그룹·예시 item까지 받아 무거워서
// 작게 잘라 여러 번 받는다.
const BOARD_PAGE_SIZE = 20

export interface MondayWorkspace {
  id: string
  name: string
  kind: string | null
  description: string | null
}

export interface MondayWorkspaceBoard {
  id: string
  name: string
  /** board · sub_items_board · document 등 — 하위 아이템 보드도 따로 나온다. */
  type: string | null
  state: string | null
  boardKind: string | null
  description: string | null
  itemsCount: number | null
  updatedAt: string | null
  folder: string | null
  groups: Array<{ id: string; title: string }>
  columns: MondayColumn[]
  /** 맨 앞 item 몇 개 — 컬럼에 실제로 뭐가 들어 있는지 보는 용도. */
  samples: Array<{
    id: string
    name: string
    group: string | null
    values: Record<string, string>
  }>
}

const WORKSPACES_QUERY = `
  query ListWorkspaces {
    workspaces(limit: 100) {
      id
      name
      kind
      description
    }
  }
`

const BOARDS_QUERY = `
  query ListWorkspaceBoards(
    $workspaceIds: [ID!]
    $limit: Int!
    $page: Int!
    $samples: Int!
  ) {
    boards(workspace_ids: $workspaceIds, limit: $limit, page: $page) {
      id
      name
      type
      state
      board_kind
      description
      items_count
      updated_at
      board_folder_id
      groups {
        id
        title
      }
      columns {
        id
        title
        type
      }
      items_page(limit: $samples) {
        items {
          id
          name
          group {
            title
          }
          column_values {
            id
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
        }
      }
    }
  }
`

const FOLDERS_QUERY = `
  query ListFolders($workspaceIds: [ID]) {
    folders(workspace_ids: $workspaceIds, limit: 100) {
      id
      name
    }
  }
`

interface RawBoard {
  id: string
  name: string
  type: string | null
  state: string | null
  board_kind: string | null
  description: string | null
  items_count: number | null
  updated_at: string | null
  board_folder_id: string | null
  groups: Array<{ id: string; title: string }> | null
  columns: MondayColumn[] | null
  items_page: {
    items: Array<{
      id: string
      name: string
      group: { title: string } | null
      column_values: Array<{
        id: string
        text: string | null
        display_value?: string | null
      }>
    }>
  } | null
}

export async function listWorkspaces(
  apiKey: string,
): Promise<MondayWorkspace[]> {
  const data = await fetchMonday<{ workspaces: MondayWorkspace[] | null }>(
    apiKey,
    WORKSPACES_QUERY,
    {},
  )
  return data.workspaces ?? []
}

/** 워크스페이스 하나의 보드 전부 — 이름·컬럼·그룹·item 수와 예시 item.
 * Monday에서 읽기만 한다(DB에 안 씀). */
export async function listWorkspaceBoards(
  apiKey: string,
  workspaceId: string,
  samples: number,
): Promise<MondayWorkspaceBoard[]> {
  const folders = await fetchMonday<{
    folders: Array<{ id: string; name: string }> | null
  }>(apiKey, FOLDERS_QUERY, { workspaceIds: [workspaceId] })
  const folderName = new Map(
    (folders.folders ?? []).map((f) => [String(f.id), f.name]),
  )

  const boards: MondayWorkspaceBoard[] = []
  for (let page = 1; ; page++) {
    const data = await fetchMonday<{ boards: RawBoard[] | null }>(
      apiKey,
      BOARDS_QUERY,
      { workspaceIds: [workspaceId], limit: BOARD_PAGE_SIZE, page, samples },
    )
    const raw = data.boards ?? []
    for (const b of raw) {
      boards.push({
        id: b.id,
        name: b.name,
        type: b.type,
        state: b.state,
        boardKind: b.board_kind,
        description: b.description,
        itemsCount: b.items_count,
        updatedAt: b.updated_at,
        folder: b.board_folder_id
          ? (folderName.get(String(b.board_folder_id)) ?? b.board_folder_id)
          : null,
        groups: b.groups ?? [],
        columns: b.columns ?? [],
        samples: (b.items_page?.items ?? []).map((item) => ({
          id: item.id,
          name: item.name,
          group: item.group?.title ?? null,
          values: Object.fromEntries(
            item.column_values
              .map((v) => [v.id, v.text || v.display_value || ''] as const)
              .filter(([, text]) => text),
          ),
        })),
      })
    }
    if (raw.length < BOARD_PAGE_SIZE) break
  }
  return boards
}
