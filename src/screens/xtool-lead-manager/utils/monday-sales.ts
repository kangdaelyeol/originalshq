import type { MondayDailySale } from '../entity'
import type { PurchaseScope } from './monday-stats'

/** 제품 하나의 판매 합계 — 조회 기간 안에서. */
export interface SalesProduct {
  name: string
  /** 판매 수량 — 선택한 채널 기준. */
  quantity: number
  offlineQuantity: number
  onlineQuantity: number
  /** 판매 금액 — 선택한 채널 기준. */
  amount: number
}

export interface SalesSummary {
  quantity: number
  amount: number
  /** 팔린 제품의 가짓수. */
  productCount: number
  /** 가장 많이 팔린 제품(수량 기준) — 없으면 null. */
  top: SalesProduct | null
}

/** 조회 기간·채널의 판매 줄을 제품별로 합친다. 제품명이 같으면 한 제품으로
 * 본다 — 오프라인과 온라인이 같은 제품을 다른 이름으로 적은 경우는 서로
 * 다른 줄로 남는다. 결과는 수량이 많은 순. */
export const aggregateSales = (
  rows: MondayDailySale[],
  start: string,
  end: string,
  scope: PurchaseScope,
): SalesProduct[] => {
  const byName = new Map<string, SalesProduct>()

  for (const row of rows) {
    if (row.date < start || row.date > end) continue
    if (scope !== 'all' && row.origin !== scope) continue

    const product = byName.get(row.name) ?? {
      name: row.name,
      quantity: 0,
      offlineQuantity: 0,
      onlineQuantity: 0,
      amount: 0,
    }
    product.quantity += row.quantity
    product.amount += row.amount
    if (row.origin === 'offline') product.offlineQuantity += row.quantity
    else product.onlineQuantity += row.quantity
    byName.set(row.name, product)
  }

  return [...byName.values()].sort(
    (a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name),
  )
}

export const summarizeSales = (products: SalesProduct[]): SalesSummary => ({
  quantity: products.reduce((sum, product) => sum + product.quantity, 0),
  amount: products.reduce((sum, product) => sum + product.amount, 0),
  productCount: products.length,
  top: products[0] ?? null,
})

export type SalesSortKey =
  'name' | 'quantity' | 'offlineQuantity' | 'onlineQuantity' | 'amount'

/** 표에 보여줄 순서로 정렬한다. 값이 같으면 수량이 많은 제품이 위로 온다. */
export const sortSalesProducts = (
  products: SalesProduct[],
  key: SalesSortKey,
  direction: 'asc' | 'desc',
): SalesProduct[] => {
  const sign = direction === 'asc' ? 1 : -1
  return [...products].sort((a, b) => {
    const compared =
      key === 'name' ? a.name.localeCompare(b.name) : a[key] - b[key]
    return compared !== 0 ? compared * sign : b.quantity - a.quantity
  })
}
