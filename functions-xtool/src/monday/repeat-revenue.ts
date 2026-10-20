import { MondayCustomer, MondayDailyRepeatRevenue } from './types'

/**
 * 날짜별 신규·재구매 금액을 만든다(순수 함수). 고객마다 취소되지 않은 구매
 * 중 가장 이른 결제일을 첫 구매일로 보고, 그날의 구매는 신규, 그 뒤는
 * 재구매로 나눈다. 결제일이 없는 구매는 어느 날에도 넣을 수 없어 뺀다.
 *
 * 데이터가 2026-01-01부터라, 그 전에 산 적이 있는 고객도 올해 첫 구매는
 * 신규로 잡힌다(초기 몇 달은 재구매가 실제보다 적게 나온다).
 */
export const buildDailyRepeatRevenue = (
  customers: MondayCustomer[],
): MondayDailyRepeatRevenue[] => {
  const byDate = new Map<string, MondayDailyRepeatRevenue>()

  for (const customer of customers) {
    const purchases = customer.purchases.filter(
      (purchase) => !purchase.cancelled && purchase.paidAt,
    )
    const firstDate = purchases
      .map((purchase) => purchase.paidAt as string)
      .sort()[0]
    for (const purchase of purchases) {
      const date = purchase.paidAt as string
      const row = byDate.get(date) ?? {
        date,
        offlineNew: 0,
        offlineRepeat: 0,
        onlineNew: 0,
        onlineRepeat: 0,
      }
      const repeat = date !== firstDate
      if (purchase.origin === 'online') {
        if (repeat) row.onlineRepeat += purchase.amount
        else row.onlineNew += purchase.amount
      } else if (repeat) {
        row.offlineRepeat += purchase.amount
      } else {
        row.offlineNew += purchase.amount
      }
      byDate.set(date, row)
    }
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}
