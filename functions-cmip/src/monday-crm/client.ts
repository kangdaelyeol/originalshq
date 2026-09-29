import type { OfflineSaleRow } from './types'

const MONDAY_API_URL = 'https://api.monday.com/v2'

// 오프라인 매출을 기록하는 Monday 보드 — 지금은 이 하나로 고정.
const OFFLINE_SALES_BOARD_ID = '5027377796'

// item(고객/접수) 컬럼 — 접수일.
const ITEM_DATE_COLUMN_ID = 'date_mm1g8781'
// item(고객/접수) 컬럼 — 그 item의 subitem 이름들을 모아 보여주는 미러(lookup)
// 컬럼. display_value가 정확히 "분할납부"면 그 item 자체가 기존 계약의 분할
// 납부 회차 수금 건이라는 뜻이다(buildOfflineSaleRows가 item째로 건너뛴다).
const ITEM_LOOKUP_COLUMN_ID = 'lookup_mm1s9nfs'

// subitem(품목/할부 이자 등 결제 라인) 컬럼.
const SUBITEM_REVENUE_COLUMN_ID = 'numeric_mm1rvgfs' // 매출액
const SUBITEM_DISCOUNT_COLUMN_ID = 'numeric_mm19vata' // 할인액
const SUBITEM_TOTAL_PAID_COLUMN_ID = 'formula_mm1gsc6e' // 총 결제금액(수식)
// subitem이 어느 항목(상품/계약금/분할납부)에 연결됐는지 보여주는 board relation
// 컬럼 — display_value가 "계약금"/"분할납부"면 그 subitem의 금액(총결제금액
// 컬럼에 음수로 기록됨)은 "아직 안 걷은 잔금"을 뜻한다.
const SUBITEM_BOARD_RELATION_COLUMN_ID = 'board_relation_mm1g3mnp'

// 장기 할부 이자 subitem 이름 — 고객이 할부로 결제해 카드사에 내는 이자라
// 매장 매출이 아니다. helper.ts의 sumRows가 이 이름과 일치하는 행을 매출
// 집계(revenue/discount/totalPaid/lineCount)에서 빼고 installmentInterest로
// 따로 더한다.
const INSTALLMENT_INTEREST_NAMES = new Set([
  '12개월 장기 할부 이자',
  '24개월 장기 할부 이자',
  '36개월 장기 할부 이자',
])

// subitem의 board relation(SUBITEM_BOARD_RELATION_COLUMN_ID) display_value가
// 이 중 하나면, 그 subitem의 금액은 "총 계약금액 중 아직 안 걷고 나중에
// 분할로 받을 잔금"이다 — 계약 체결일에 상품가 전체를 매출로 잡기 위해
// helper.ts의 sumRows가 이 행을 매출 집계에서 빼고 deferredBalance로 따로
// (음수 값 그대로) 더한다.
const DEFERRED_BALANCE_RELATION_VALUES = new Set(['계약금', '분할납부'])

// item의 lookup(ITEM_LOOKUP_COLUMN_ID) display_value가 정확히 이 값이면, 그
// item은 새 계약이 아니라 기존 계약의 분할납부 회차를 수금한 기록이다 —
// 계약 체결일에 이미 총 계약금액으로 인식했으므로(위 DEFERRED_BALANCE_RELATION
// _VALUES) 이 item은 통째로 건너뛴다(중복 집계 방지).
const INSTALLMENT_PAYMENT_ITEM_LOOKUP_VALUE = '분할납부'

// items_page 한 번에 몇 건씩 받을지 — Monday API 문서상 최대 500.
const PAGE_SIZE = 500

interface MondayColumnValue {
  id: string
  text: string | null
  /** 수식/미러 컬럼(FormulaValue/MirrorValue)만 있는 필드 — 이 두 컬럼
   * 타입은 text가 항상 빈 문자열로 내려오고, 실제 계산된 값은 여기 담긴다. */
  display_value?: string
}

interface MondaySubitem {
  id: string
  name: string
  column_values: MondayColumnValue[]
}

interface MondayItem {
  id: string
  name: string
  column_values: MondayColumnValue[]
  subitems: MondaySubitem[]
}

interface MondayItemsPage {
  cursor: string | null
  items: MondayItem[]
}

/** GraphQL POST 호출 하나 — Monday API 호출부가 전부 이 함수를 거친다.
 * REST와 달리 실패가 HTTP status가 아니라 body의 errors로도 올 수 있어
 * 둘 다 확인한다. */
async function fetchMonday<T>(
  query: string,
  variables: Record<string, unknown>,
  apiKey: string,
): Promise<T> {
  const response = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: apiKey,
    },
    body: JSON.stringify({ query, variables }),
  })

  if (!response.ok) {
    throw new Error(`Monday API 호출 실패(${response.status}): ${await response.text()}`)
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

const ITEM_FIELDS = `
  id
  name
  column_values(ids: ["${ITEM_DATE_COLUMN_ID}", "${ITEM_LOOKUP_COLUMN_ID}"]) {
    id
    text
    ... on MirrorValue {
      display_value
    }
  }
  subitems {
    id
    name
    column_values(ids: ["${SUBITEM_REVENUE_COLUMN_ID}", "${SUBITEM_DISCOUNT_COLUMN_ID}", "${SUBITEM_TOTAL_PAID_COLUMN_ID}", "${SUBITEM_BOARD_RELATION_COLUMN_ID}"]) {
      id
      text
      ... on FormulaValue {
        display_value
      }
      ... on BoardRelationValue {
        display_value
      }
    }
  }
`

const FIRST_PAGE_QUERY = `
  query GetOfflineSalesFirstPage($boardId: ID!, $limit: Int!) {
    boards(ids: [$boardId]) {
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
  query GetOfflineSalesNextPage($cursor: String!, $limit: Int!) {
    next_items_page(cursor: $cursor, limit: $limit) {
      cursor
      items {
        ${ITEM_FIELDS}
      }
    }
  }
`

/** 보드 전체를 cursor 기반으로 끝까지 페이지네이션해서 items를 다 모은다 —
 * limit 500이면 ~3000건 기준 페이지 6~7번 정도. */
async function fetchAllItems(apiKey: string): Promise<MondayItem[]> {
  const items: MondayItem[] = []

  const first = await fetchMonday<{
    boards: { items_page: MondayItemsPage }[]
  }>(
    FIRST_PAGE_QUERY,
    { boardId: OFFLINE_SALES_BOARD_ID, limit: PAGE_SIZE },
    apiKey,
  )
  const firstPage = first.boards[0]?.items_page
  if (!firstPage) return items

  items.push(...firstPage.items)
  let cursor = firstPage.cursor

  while (cursor) {
    const next = await fetchMonday<{ next_items_page: MondayItemsPage }>(
      NEXT_PAGE_QUERY,
      { cursor, limit: PAGE_SIZE },
      apiKey,
    )
    items.push(...next.next_items_page.items)
    cursor = next.next_items_page.cursor
  }

  return items
}

function columnText(columnValues: MondayColumnValue[], columnId: string): string {
  return columnValues.find((c) => c.id === columnId)?.text ?? ''
}

/** 수식/미러 컬럼은 text가 항상 비어 있어 display_value를 우선 쓰고, 그마저
 * 없으면 text로 폴백한다. */
function columnDisplayValue(
  columnValues: MondayColumnValue[],
  columnId: string,
): string {
  const column = columnValues.find((c) => c.id === columnId)
  return column?.display_value || column?.text || ''
}

/** items(+subitems) 트리를 Firestore/집계가 바로 쓸 수 있는 평탄 행으로
 * 편다 — subitem 하나가 행 하나. 접수일이 없는 item(입력 누락 등)은
 * 집계 대상이 아니라서 건너뛴다. item 자체가 기존 계약의 분할납부 회차
 * 수금 건(lookup === "분할납부")이면, 계약 체결일에 이미 총 계약금액으로
 * 인식했으므로 이 item은 통째로 건너뛴다(중복 집계 방지 — 조건 2). */
function buildOfflineSaleRows(items: MondayItem[]): OfflineSaleRow[] {
  const rows: OfflineSaleRow[] = []

  for (const item of items) {
    const date = columnText(item.column_values, ITEM_DATE_COLUMN_ID)
    if (!date) continue

    const itemLookup = columnDisplayValue(
      item.column_values,
      ITEM_LOOKUP_COLUMN_ID,
    )
    if (itemLookup === INSTALLMENT_PAYMENT_ITEM_LOOKUP_VALUE) continue

    for (const subitem of item.subitems) {
      const boardRelation = columnDisplayValue(
        subitem.column_values,
        SUBITEM_BOARD_RELATION_COLUMN_ID,
      )
      rows.push({
        mondayItemId: item.id,
        mondaySubitemId: subitem.id,
        date,
        customerName: item.name,
        productName: subitem.name,
        revenue:
          Number(columnText(subitem.column_values, SUBITEM_REVENUE_COLUMN_ID)) ||
          0,
        discount:
          Number(
            columnText(subitem.column_values, SUBITEM_DISCOUNT_COLUMN_ID),
          ) || 0,
        totalPaid:
          Number(
            columnDisplayValue(
              subitem.column_values,
              SUBITEM_TOTAL_PAID_COLUMN_ID,
            ),
          ) || 0,
        isInstallmentInterest: INSTALLMENT_INTEREST_NAMES.has(subitem.name),
        isDeferredBalance: DEFERRED_BALANCE_RELATION_VALUES.has(boardRelation),
      })
    }
  }

  return rows
}

/** Monday 오프라인 매출 보드 전체를 지금 상태 그대로 가져온다 — 페이지네이션
 * 끝까지 돈 뒤 평탄화까지 마친 행 배열을 반환한다. */
export const fetchOfflineSalesFromMonday = async (
  apiKey: string,
): Promise<OfflineSaleRow[]> => {
  const items = await fetchAllItems(apiKey)
  return buildOfflineSaleRows(items)
}
