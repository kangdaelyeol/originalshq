// 상담 신청을 Monday 상담 보드에 아이템으로 만든다(예전 Zapier가 하던 일).
//
// 보드마다 같은 뜻의 컬럼이라도 id가 달라서(이메일·fbc·fbp·GA ClientId·
// 할부상담여부) 컬럼은 제목으로 찾는다 — 동기화 코드(fields.ts)와 같은 방식.
// 담당자는 Monday 자동화가 배정하므로 넣지 않는다.
import type { Inquiry } from './types'

const MONDAY_API_URL = 'https://api.monday.com/v2'

interface BoardShape {
  columns: { id: string; title: string; type: string }[]
  groups: { id: string; title: string }[]
}

const squash = (value: string) => value.replace(/\s+/g, '')

// 보드 구조는 자주 안 바뀌어서 인스턴스가 살아 있는 동안 10분씩 들고 있는다.
const BOARD_CACHE_MS = 10 * 60 * 1000
const boardCache = new Map<string, { at: number; shape: BoardShape }>()

const mondayRequest = async <T>(
  apiKey: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> => {
  const response = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      "Authorization": apiKey,
      'API-Version': '2024-10',
    },
    body: JSON.stringify({ query, variables }),
  })
  const body = (await response.json()) as {
    data?: T
    errors?: { message: string }[]
    error_message?: string
  }
  if (!response.ok || body.errors || body.error_message || !body.data) {
    const message =
      body.errors?.map((e) => e.message).join('; ') ??
      body.error_message ??
      `HTTP ${response.status}`
    throw new Error(`Monday API 오류: ${message}`)
  }
  return body.data
}

const loadBoard = async (
  apiKey: string,
  boardId: string,
): Promise<BoardShape> => {
  const cached = boardCache.get(boardId)
  if (cached && Date.now() - cached.at < BOARD_CACHE_MS) return cached.shape
  const data = await mondayRequest<{ boards: BoardShape[] }>(
    apiKey,
    'query ($id: [ID!]) { boards(ids: $id) { ' +
      'columns { id title type } groups { id title } } }',
    { id: [boardId] },
  )
  const shape = data.boards[0]
  if (!shape) throw new Error(`Monday 보드를 찾을 수 없습니다(${boardId})`)
  boardCache.set(boardId, { at: Date.now(), shape })
  return shape
}

/** Monday에 넣는 값 — [컬럼 제목 패턴, 값]. 빈 값은 넣지 않는다(예전 Zapier는
 * "null"·"GA_null" 글자를 넣었다). */
const columnEntries = (
  inquiry: Inquiry,
): [RegExp, string | Record<string, string>][] => [
  [/^전화번호/, inquiry.phoneFormatted],
  [/^할부상담여부$/, inquiry.installment],
  [/^고객문의상세내용$/, inquiry.message ?? ''],
  [/^도입시기$/, inquiry.introPeriod ?? ''],
  // B2B 보드 — 아이템 이름은 회사명이고 고객명은 담당자 칸으로 간다.
  [/^기업담당자성함$/, inquiry.name],
  [/^문의유형$/, inquiry.inquiryType ?? ''],
  [/^이메일$/, inquiry.email],
  [/^광고UTM$/i, inquiry.utmCampaign],
  [/^광고UTMmedium$/i, inquiry.utmMedium],
  [/^광고utm_?source$/i, inquiry.utmSource],
  [/^fbc/i, inquiry.fbc],
  [/^fbp/i, inquiry.fbp],
  // 기존 데이터와 같은 "GA_<id>" 모양으로 넣는다(ga-tracking.ts가 읽는 형식).
  [/^GAClientId$/i, inquiry.gaClientId ? `GA_${inquiry.gaClientId}` : ''],
  [/^접수일$/, { date: inquiry.receivedDate }],
  [/^상담진행상태$/, { label: '신규 상담 유입' }],
]

/** 아이템을 만들고 id를 돌려준다. 보드에 없는 컬럼은 건너뛴다. */
export const createMondayItem = async (
  apiKey: string,
  inquiry: Inquiry,
): Promise<string> => {
  const board = await loadBoard(apiKey, inquiry.boardId)
  const values: Record<string, unknown> = {}
  for (const [pattern, value] of columnEntries(inquiry)) {
    if (value === '' || value === null) continue
    const column = board.columns.find((c) => pattern.test(squash(c.title)))
    if (column) values[column.id] = value
  }
  // 새 문의는 "신규유입" 그룹에 — 없으면 보드 맨 위 그룹(Monday 기본).
  const group = board.groups.find((g) => squash(g.title) === '신규유입')

  const data = await mondayRequest<{ create_item: { id: string } }>(
    apiKey,
    `mutation ($board: ID!, $group: String, $name: String!, $values: JSON!) {
      create_item(
        board_id: $board, group_id: $group,
        item_name: $name, column_values: $values
      ) { id }
    }`,
    {
      board: inquiry.boardId,
      group: group?.id ?? null,
      // B2B는 회사명이 아이템 이름이다(회사명이 없으면 고객명).
      name:
        (inquiry.device === 'B2B' && inquiry.company) ||
        inquiry.name ||
        '이름 없음',
      values: JSON.stringify(values),
    },
  )
  return data.create_item.id
}
