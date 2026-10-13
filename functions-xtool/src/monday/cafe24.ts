import { MondayPurchase, MondayPurchaseLine } from './types'

/** functions-cmip의 Cafe24 동기화가 저장하는 주문 1건 —
 * cafe24OrderCustomers/{orderId}. 두 코드베이스가 같은 DB를 쓰지만 코드는
 * 공유하지 못해서, 여기 타입은 functions-cmip/src/cafe24/types.ts의
 * Cafe24OrderCustomerRow와 손으로 맞춰 둔 사본이다 — 한쪽을 바꾸면 다른
 * 쪽도 같이 바꿔야 한다. */
export interface Cafe24Order {
  orderId: string
  orderDate: string
  paymentDate: string | null
  cancelDate: string | null
  paid: boolean
  /** "T"(전체 취소) / "F" / "M"(일부 품목만 취소). */
  canceled: string
  /** "self"(자체몰), "mobile", "shopn"(스마트스토어), "NCHECKOUT"(네이버페이)… */
  marketId: string
  memberId: string | null
  buyerName: string | null
  buyerPhone: string | null
  buyerEmail: string | null
  receiverNames: string[]
  receiverPhones: string[]
  items: {
    productName: string
    option: string
    quantity: number
    price: number
    discount: number
    statusText: string
    cancelled: boolean
  }[]
}

/** 온라인 구매 기록의 출처 표시 — Monday 보드 이름 자리에 들어간다. */
export const CAFE24_SOURCE_ID = 'cafe24'
export const CAFE24_SOURCE_NAME = 'Cafe24 온라인몰'

const MARKET_LABEL: Record<string, string> = {
  self: '자체몰',
  mobile: '자체몰(모바일)',
  shopn: '스마트스토어',
  NCHECKOUT: '네이버페이',
  KAKAOPAY: '카카오페이',
}

const toLine = (item: Cafe24Order['items'][number]): MondayPurchaseLine => ({
  name: item.option ? `${item.productName} (${item.option})` : item.productName,
  product: null,
  // 취소·반품된 품목은 남겨 두되 구매 금액에는 넣지 않는다.
  kind: item.cancelled ? 'cancelled' : 'product',
  price: item.price,
  quantity: item.quantity,
  discount: item.discount || null,
  total: item.price * item.quantity - item.discount,
  memo: item.cancelled ? item.statusText : null,
})

/** 주문의 상태 문구 — 전체 취소 / 일부 취소 / (그 외에는) 품목들의 진행 상태. */
const statusOf = (order: Cafe24Order): string => {
  if (order.canceled === 'T') return '결제 취소'
  if (order.canceled === 'M') return '일부 취소'
  const active = order.items.filter((item) => !item.cancelled)
  return active[0]?.statusText || '결제완료'
}

/** Cafe24 주문 1건을 구매 기록으로 바꾼다 — 오프라인 결제(Monday)와 같은
 * 모양이라 화면과 통계가 둘을 똑같이 다룬다. 금액은 취소되지 않은 품목의
 * 상품 금액(할인 반영, 배송비 제외)이다. 온라인은 선결제라 계약금·분할납부·
 * 잔금이 없다. */
export const toOnlinePurchase = (order: Cafe24Order): MondayPurchase => {
  const lines = order.items.map(toLine)
  const amount = lines
    .filter((line) => line.kind === 'product')
    .reduce((sum, line) => sum + line.total, 0)

  return {
    itemId: `${CAFE24_SOURCE_ID}-${order.orderId}`,
    boardId: CAFE24_SOURCE_ID,
    boardName: CAFE24_SOURCE_NAME,
    name: order.buyerName ?? '',
    url: null,
    createdAt: order.orderDate,
    updatedAt: order.cancelDate ?? order.paymentDate ?? order.orderDate,
    origin: 'online',
    paidAt: order.paymentDate ?? order.orderDate,
    orders: order.items.map((item) => item.productName).join(', ') || null,
    status: statusOf(order),
    channel: MARKET_LABEL[order.marketId] ?? order.marketId,
    method: null,
    pickup: null,
    businessType: null,
    assignee: null,
    memo: `주문번호 ${order.orderId}`,
    lines,
    amount,
    interestAmount: 0,
    deferredAmount: 0,
    // 전체 취소됐거나, 품목이 하나씩 다 취소·반품된 주문.
    cancelled:
      order.canceled === 'T' ||
      (lines.length > 0 && lines.every((line) => line.kind === 'cancelled')),
    pending: false,
  }
}
