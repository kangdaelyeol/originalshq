import { pick, source } from './fields'
import {
  MondayItem,
  MondayItemColumn,
  MondayPayment,
  MondayPaymentIssue,
  MondayPurchase,
  MondayPurchaseLine,
  MondaySubitem,
} from './types'

// 결제 보드의 금액 규칙 — functions-cmip/src/monday-crm(오프라인 매출 집계)과
// 같은 기준이다. 두 코드베이스가 따로 배포돼서 코드를 공유하지 못하므로,
// 한쪽 기준을 바꾸면 다른 쪽도 같이 바꿔야 한다.
//
// 구매는 "계약" 기준으로 센다:
//   · 상품 줄이 있는 결제 건 = 계약 1건. 상품 줄의 합이 구매 금액이고, 계약한
//     날 전액을 구매로 잡는다.
//   · 그 계약의 돈을 나눠 낸 기록(상품 줄 없이 "계약금"/"분할납부" 줄만 있는
//     결제 건)은 구매가 아니라 납부다 — 구매로 세면 같은 돈이 두 번 잡힌다.
//   · 계약 건 안의 "계약금"/"분할납부" 줄은 보통 음수다. "아직 안 받은 잔금"
//     (계약 먼저, 납부 나중)이거나 "먼저 받은 계약금 차감"(계약금 먼저, 계약
//     나중)인데, 어느 쪽이든 고객별로 더하면 맞아떨어진다:
//       받은 돈 = Σ 계약 건(상품 합 + 그 음수 줄) + Σ 납부 건
//       잔금    = 구매 금액 − 받은 돈

// 품명(상품 보드 연결값)이 이 중 하나면 그 줄은 상품이 아니라 돈을 나눠 낸
// (또는 낼) 표시다.
const DEFERRED_PRODUCTS = new Set(['계약금', '분할납부'])
// 장기 할부 이자("12개월 장기 할부 이자" 등) — 고객이 카드사에 내는 이자.
const INTEREST_PATTERN = /장기\s*할부\s*이자/

const subitemText = (
  subitem: MondaySubitem,
  pattern: RegExp,
): string | null => {
  const columns: MondayItemColumn[] = Object.values(subitem.columns)
  for (const column of columns) {
    if (pattern.test(column.title.replace(/\s/g, '')) && column.text.trim()) {
      return column.text.trim()
    }
  }
  return null
}

const subitemNumber = (
  subitem: MondaySubitem,
  pattern: RegExp,
): number | null => {
  const text = subitemText(subitem, pattern)
  if (text === null) return null
  const value = Number(text.replace(/,/g, ''))
  return Number.isFinite(value) ? value : null
}

const toLine = (subitem: MondaySubitem): MondayPurchaseLine => {
  const product = subitemText(subitem, /^품명$/)
  const kind =
    product !== null && DEFERRED_PRODUCTS.has(product)
      ? 'deferred'
      : INTEREST_PATTERN.test(product ?? subitem.name)
        ? 'interest'
        : 'product'

  return {
    name: subitem.name,
    product,
    kind,
    price: subitemNumber(subitem, /^판매가$/),
    quantity: subitemNumber(subitem, /^구매수량$/),
    discount: subitemNumber(subitem, /^할인금액$/),
    total: subitemNumber(subitem, /^최종결제금액$/) ?? 0,
    memo: subitemText(subitem, /^비고란?$/),
  }
}

const sumOf = (lines: MondayPurchaseLine[], kind: MondayPurchaseLine['kind']) =>
  lines
    .filter((line) => line.kind === kind)
    .reduce((sum, line) => sum + line.total, 0)

const won = (amount: number): string => `${amount.toLocaleString('ko-KR')}원`

/** 최근 것이 앞에 오도록 — 날짜가 없는 기록은 맨 뒤로. */
const newestFirst = <T extends { paidAt: string | null }>(records: T[]): T[] =>
  [...records].sort((a, b) => (b.paidAt ?? '').localeCompare(a.paidAt ?? ''))

/** 한 고객의 결제 보드 item들을 구매(계약)와 납부로 나누고, 금액 합계와
 * 사람이 확인해야 할 애매한 기록을 뽑는다. */
export const buildPurchaseRecords = (
  items: MondayItem[],
): {
  purchases: MondayPurchase[]
  payments: MondayPayment[]
  issues: MondayPaymentIssue[]
  money: {
    purchaseAmount: number
    receivedAmount: number
    balanceAmount: number
    interestAmount: number
  }
} => {
  const purchases: MondayPurchase[] = []
  const payments: MondayPayment[] = []
  const issues: MondayPaymentIssue[] = []

  const issue = (
    type: MondayPaymentIssue['type'],
    message: string,
    record: MondayPurchase | MondayPayment,
  ) =>
    issues.push({
      type,
      message,
      itemId: record.itemId,
      boardName: record.boardName,
      name: record.name,
      url: record.url,
      date: record.paidAt,
    })

  for (const item of items) {
    // 하위 아이템을 받기 전에 저장된 문서에는 이 필드가 없다.
    const lines = (item.subitems ?? []).map(toLine)
    const status = pick(item, /^결제상태$/)
    const common = {
      ...source(item),
      paidAt: pick(item, /^결제일자$/),
      status,
      method: pick(item, /^결제수단$/),
      assignee: pick(item, /^담당자$/),
      memo: pick(item, /^비고란?$/),
      lines,
      cancelled: status !== null && /취소/.test(status),
      pending: status !== null && /입금\s*대기/.test(status),
    }

    const isPaymentOnly =
      lines.length > 0 && lines.every((line) => line.kind === 'deferred')

    if (isPaymentOnly) {
      payments.push({ ...common, amount: sumOf(lines, 'deferred') })
      continue
    }

    const purchase: MondayPurchase = {
      ...common,
      orders: pick(item, /^주문목록$/),
      channel: pick(item, /^구매경로$/),
      pickup: pick(item, /^수령방식$/),
      businessType: pick(item, /^사업자$/),
      amount: sumOf(lines, 'product'),
      interestAmount: sumOf(lines, 'interest'),
      deferredAmount: sumOf(lines, 'deferred'),
    }
    purchases.push(purchase)

    if (purchase.cancelled) continue
    if (lines.length === 0) {
      issue(
        'purchase-without-lines',
        '결제 건에 품목(하위 아이템)이 없어 금액을 알 수 없습니다.',
        purchase,
      )
    }
    if (purchase.deferredAmount > 0) {
      issue(
        'deferred-positive',
        `계약 건 안의 계약금/분할납부 줄이 양수(${won(purchase.deferredAmount)})` +
          '입니다. 잔금이나 차감이면 음수여야 합니다.',
        purchase,
      )
    }
  }

  const activePurchases = purchases.filter((purchase) => !purchase.cancelled)
  const activePayments = payments.filter((payment) => !payment.cancelled)

  const purchaseAmount = activePurchases.reduce((sum, p) => sum + p.amount, 0)
  // 결제상태가 "입금대기"여도 받은 것으로 센다 — 이 상태는 돈이 들어온 뒤에도
  // 그대로 남아 있는 건이 많아서(몇 달 전 계약, 이후 분할납부까지 끝난 건도
  // 입금대기), 이걸 믿고 빼면 잔금이 실제보다 훨씬 크게 나온다. 잔금은
  // 계약금/분할납부 줄만으로 계산하고, 입금대기는 뱃지로만 보여준다.
  const receivedAmount =
    activePurchases.reduce((sum, p) => sum + p.amount + p.deferredAmount, 0) +
    activePayments.reduce((sum, p) => sum + p.amount, 0)
  const balanceAmount = purchaseAmount - receivedAmount

  // 납부는 "계약금/분할납부 줄이 있는 계약"에 대한 것이어야 한다 — 그런 계약이
  // 하나도 없으면 어느 계약의 돈인지 알 수 없다(다른 번호로 계약했거나, 계약
  // 건이 아직 입력되지 않았거나).
  const hasSplitContract = activePurchases.some(
    (purchase) => purchase.deferredAmount !== 0,
  )
  if (!hasSplitContract) {
    for (const payment of activePayments) {
      issue(
        'payment-without-contract',
        `납부 기록(${won(payment.amount)})에 대응하는 계약 건을 찾지 못했습니다. ` +
          '계약 건의 전화번호가 다르거나 아직 입력되지 않았을 수 있습니다.',
        payment,
      )
    }
  } else if (balanceAmount < 0) {
    const latest =
      newestFirst(activePayments)[0] ?? newestFirst(activePurchases)[0]
    issue(
      'overpaid',
      `받은 금액이 계약 금액보다 ${won(-balanceAmount)} 많습니다. ` +
        '계약금/분할납부 줄의 금액이나 부호를 확인해 주세요.',
      latest,
    )
  }

  return {
    purchases: newestFirst(purchases),
    payments: newestFirst(payments),
    issues,
    money: {
      purchaseAmount,
      receivedAmount,
      balanceAmount,
      interestAmount: activePurchases.reduce(
        (sum, p) => sum + p.interestAmount,
        0,
      ),
    },
  }
}
