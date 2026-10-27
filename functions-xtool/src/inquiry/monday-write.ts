// 상담 신청을 Monday 상담 보드에 아이템으로 만든다(예전 Zapier가 하던 일).
//
// 보드마다 같은 뜻의 컬럼이라도 id가 달라서(이메일·fbc·fbp·GA ClientId·
// 할부상담여부) 컬럼은 제목으로 찾는다 — 동기화 코드(fields.ts)와 같은 방식.
// 담당자는 Monday 자동화가 배정하므로 넣지 않는다.
import {
  fetchWithTimeout,
  isTransientStatus,
  TransientError,
  withRetry,
} from './retry'
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

// 요청 한도 초과·Monday 내부 오류 — 잠깐 뒤 다시 하면 될 수 있다.
const TRANSIENT_GRAPHQL =
  /complexity|rate ?limit|too many|internal server error|timeout|try again/i

const mondayRequest = async <T>(
  apiKey: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> => {
  const response = await fetchWithTimeout(
    MONDAY_API_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        "Authorization": apiKey,
        'API-Version': '2024-10',
      },
      body: JSON.stringify({ query, variables }),
    },
    'Monday',
  )
  // 5xx는 HTML 오류 페이지가 올 수도 있어서 JSON이 아니어도 넘어간다.
  const body = (await response.json().catch(() => ({}))) as {
    data?: T
    errors?: { message: string }[]
    error_message?: string
  }
  if (!response.ok || body.errors || body.error_message || !body.data) {
    const message =
      body.errors?.map((e) => e.message).join('; ') ??
      body.error_message ??
      `HTTP ${response.status}`
    const text = `Monday API 오류: ${message}`
    // 429·한도 초과는 처리 전에 거절된 것이고, 5xx는 처리됐는지 알 수 없다.
    if (response.status === 429) throw new TransientError(text, false)
    if (isTransientStatus(response.status)) {
      throw new TransientError(text, true)
    }
    if (TRANSIENT_GRAPHQL.test(message)) throw new TransientError(text, false)
    throw new Error(text)
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

/** 아이템 이름 — B2B는 회사명이 아이템 이름이다(회사명이 없으면 고객명). */
const itemName = (inquiry: Inquiry) =>
  (inquiry.device === 'B2B' && inquiry.company) || inquiry.name || '이름 없음'

// 중복 확인 때 보는 최근 아이템 수 — 재시도 사이에 다른 문의가 몇 건
// 더 들어와도 찾을 수 있을 만큼.
const RECENT_ITEM_LIMIT = 50

/**
 * 이 문의로 이미 만든 아이템이 있는지 — 보드의 최근 생성 아이템 중 이름과
 * 전화번호가 같고 접수 뒤에 만들어진 것. 응답이 끊겨 실패로 본 요청이
 * 실제로는 처리된 경우, 다시 만들어 아이템이 두 개 되는 것을 막는다.
 * (전화번호로 검색하는 API는 색인이 늦어 방금 만든 아이템을 못 찾는다.)
 */
const findCreatedItem = async (
  apiKey: string,
  board: BoardShape,
  inquiry: Inquiry,
): Promise<string | null> => {
  const phone = board.columns.find((c) => /^전화번호/.test(squash(c.title)))
  const data = await mondayRequest<{
    boards: {
      items_page: {
        items: {
          id: string
          name: string
          created_at: string
          column_values: { text: string | null }[]
        }[]
      }
    }[]
  }>(
    apiKey,
    `query ($board: ID!, $limit: Int!, $columns: [String!]) {
      boards(ids: [$board]) {
        items_page(
          limit: $limit,
          query_params: {
            order_by: [{ column_id: "__creation_log__", direction: desc }]
          }
        ) { items { id name created_at column_values(ids: $columns) { text } } }
      }
    }`,
    {
      board: inquiry.boardId,
      limit: RECENT_ITEM_LIMIT,
      columns: phone ? [phone.id] : [],
    },
  )
  const name = itemName(inquiry)
  // Monday 시계와 조금 어긋나도 놓치지 않게 접수 1분 전부터 본다.
  const since = inquiry.receivedAt - 60_000
  const found = (data.boards[0]?.items_page.items ?? []).find(
    (item) =>
      item.name === name &&
      Date.parse(item.created_at) >= since &&
      (!phone || item.column_values[0]?.text === inquiry.phoneFormatted),
  )
  return found?.id ?? null
}

/**
 * 아이템을 만들고 id와 시도 횟수를 돌려준다. 보드에 없는 컬럼은 건너뛴다.
 *
 * 일시적인 오류는 최대 3번까지 시도한다. 만들기 요청이 Monday에 닿았을 수
 * 있는 실패(타임아웃·5xx) 뒤에는, 다시 만들기 전에 이미 만들어졌는지 먼저
 * 확인한다. checkFirst면 첫 시도 전에도 확인한다(화면에서 다시 등록할 때 —
 * 앞선 처리가 중간에 끊겼을 수 있다).
 */
export const createMondayItem = async (
  apiKey: string,
  inquiry: Inquiry,
  { checkFirst = false }: { checkFirst?: boolean } = {},
): Promise<{ itemId: string; attempts: number }> => {
  let maybeCreated = checkFirst
  const { value, attempts } = await withRetry(async () => {
    const board = await loadBoard(apiKey, inquiry.boardId)
    if (maybeCreated) {
      const existing = await findCreatedItem(apiKey, board, inquiry)
      if (existing) return existing
      maybeCreated = false
    }
    const values: Record<string, unknown> = {}
    for (const [pattern, value] of columnEntries(inquiry)) {
      if (value === '' || value === null) continue
      const column = board.columns.find((c) => pattern.test(squash(c.title)))
      if (column) values[column.id] = value
    }
    // 새 문의는 "신규유입" 그룹에 — 없으면 보드 맨 위 그룹(Monday 기본).
    const group = board.groups.find((g) => squash(g.title) === '신규유입')

    try {
      const data = await mondayRequest<{ create_item: { id: string } }>(
        apiKey,
        `mutation (
          $board: ID!, $group: String, $name: String!, $values: JSON!
        ) {
          create_item(
            board_id: $board, group_id: $group,
            item_name: $name, column_values: $values
          ) { id }
        }`,
        {
          board: inquiry.boardId,
          group: group?.id ?? null,
          name: itemName(inquiry),
          values: JSON.stringify(values),
        },
      )
      return data.create_item.id
    } catch (error) {
      if (error instanceof TransientError && error.sent) maybeCreated = true
      throw error
    }
  })
  return { itemId: value, attempts }
}
