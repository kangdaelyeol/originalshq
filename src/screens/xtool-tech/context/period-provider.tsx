import { useMemo, useState, type ReactNode } from 'react'
import type { Period } from '../data/period'
import { PeriodContext } from './period-context'

export function PeriodProvider({ children }: { children: ReactNode }) {
  // 샘플 영상처럼 30일이 기본.
  const [period, setPeriod] = useState<Period>('30d')
  const value = useMemo(() => ({ period, setPeriod }), [period])
  return <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>
}
