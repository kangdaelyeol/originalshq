import { describe, expect, it } from 'vitest'
import type { MondayDailySale } from '../entity'
import { salesAsDays, splitSalesKey } from './monday-sales'

const rows: MondayDailySale[] = [
  { date: '2026-11-04', origin: 'offline', name: 'F2 울트라', quantity: 1, amount: 3_000_000 },
  { date: '2026-11-04', origin: 'online', name: 'F2 울트라', quantity: 2, amount: 6_000_000 },
  { date: '2026-11-04', origin: 'online', name: '잉크 세트', quantity: 3, amount: 90_000 },
]

describe('salesAsDays byChannel', () => {
  it('같은 제품도 채널별로 나눠 담고, 되돌리면 채널과 제품명이 나온다', () => {
    const [day] = salesAsDays(rows, 'all', 'quantity', true)
    expect(day.total).toBe(6)
    const parts = Object.entries(day.boards ?? {}).map(([key, value]) => ({ ...splitSalesKey(key), value }))
    expect(parts).toEqual([
      { channel: 'offline', name: 'F2 울트라', value: 1 },
      { channel: 'online', name: 'F2 울트라', value: 2 },
      { channel: 'online', name: '잉크 세트', value: 3 },
    ])
  })

  it('금액은 채널별로 만원으로 바꾼다', () => {
    const [day] = salesAsDays(rows, 'all', 'amount', true)
    expect(day.total).toBe(909)
    expect(splitSalesKey(Object.keys(day.boards ?? {})[0])).toEqual({ channel: 'offline', name: 'F2 울트라' })
    expect(Object.values(day.boards ?? {})).toEqual([300, 600, 9])
  })

  it('byChannel이 없으면 지금처럼 제품명으로만 합친다', () => {
    const [day] = salesAsDays(rows, 'all')
    expect(day.boards).toEqual({ 'F2 울트라': 3, '잉크 세트': 3 })
  })
})
