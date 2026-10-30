import { createContext, useContext } from 'react'
import type { Period } from '../data/period'

export interface PeriodState {
  period: Period
  setPeriod: (period: Period) => void
}

/** 상단바의 조회 기간 — 아래의 모든 KPI·차트가 같은 기간을 본다. */
export const PeriodContext = createContext<PeriodState | null>(null)

export function usePeriod(): PeriodState {
  const state = useContext(PeriodContext)
  if (!state) throw new Error('usePeriod는 PeriodProvider 안에서만 쓸 수 있어요')
  return state
}
