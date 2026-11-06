import { useLayoutEffect, useRef } from 'react'
import { D16_T, EASE, play } from './d16-motion'
import {
  D16_GOAL,
  D16_KPIS,
  D16_LIVE,
  D16_SOURCES,
  D16_SOURCES_SUB,
  D16_STOCK,
  D16_VISITOR_BARS,
  type OrderData,
  type RangeKey,
} from './design16-data'
import { GlassPanel } from './glass-panel'
import { GoalCard } from './goal-card'
import { KpiStat } from './kpi-stat'
import { LiveStoreCard } from './live-store-card'
import { PackingQueueCard } from './packing-queue-card'
import { RunningLowCard } from './running-low-card'
import { SalesSourcesCard } from './sales-sources-card'
import { SalesStudio } from './sales-studio'

interface DashboardPageProps {
  toPack: readonly OrderData[]
  onPacked?: (id: string) => void
  onOpenBoard?: () => void
  range: RangeKey
  onRangeChange?: (next: RangeKey) => void
  compare: boolean
  onCompareToggle?: () => void
  /** 열릴 때 카드가 차례로 오르고 숫자·선이 그려진다 */
  intro?: boolean
}

const CARD_DELAYS = [...D16_T.topCardDelays, ...D16_T.bottomCardDelays]

/**
 * 대시보드 — 위 줄: KPI+Sales studio 큰 판(346×238) · 오른쪽 목표(153×95)·라이브(153×135),
 * 아래 줄: 164px 판 셋(Packing queue · Running low · Where sales came from).
 */
export function DashboardPage({
  toPack,
  onPacked,
  onOpenBoard,
  range,
  onRangeChange,
  compare,
  onCompareToggle,
  intro = true,
}: DashboardPageProps) {
  const rootRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root || !intro) return
    const anims: (Animation | null)[] = []
    root.querySelectorAll<HTMLElement>('[data-enter="card"]').forEach((card, i) => {
      const delay = CARD_DELAYS[i] ?? 0
      const bottom = i >= 3
      anims.push(
        play(
          card,
          [
            { opacity: 0, translate: `0 calc(${bottom ? 16 : 12} * var(--d16-px))` },
            { opacity: 1, translate: '0 0' },
          ],
          { duration: D16_T.cardRise, delay, easing: EASE.cubicOut },
        ),
      )
      card.querySelectorAll<HTMLElement>('[data-enter-row]').forEach((row, j) =>
        anims.push(
          play(row, [{ opacity: 0 }, { opacity: 1 }], {
            duration: 0.25,
            delay: delay + D16_T.rowDelay + j * 0.04,
            easing: EASE.cubicOut,
          }),
        ),
      )
    })
    return () => anims.forEach((a) => a?.cancel())
  }, [intro])

  return (
    <div className="d16-dash" ref={rootRef}>
      <GlassPanel as="section" className="d16-dash__main" data-enter="card">
        <div className="d16-kpis">
          {D16_KPIS.map((kpi, i) => (
            <KpiStat key={kpi.label} {...kpi} countDelay={intro ? D16_T.countDelays[i] : null} />
          ))}
        </div>
        <SalesStudio
          range={range}
          onRangeChange={onRangeChange}
          compare={compare}
          onCompareToggle={onCompareToggle}
          introDelay={intro ? D16_T.chartDelay : null}
        />
      </GlassPanel>
      <div className="d16-dash__side">
        <GoalCard {...D16_GOAL} data-enter="card" />
        <LiveStoreCard {...D16_LIVE} bars={D16_VISITOR_BARS} data-enter="card" />
      </div>
      <div className="d16-dash__row">
        <PackingQueueCard orders={toPack} onPacked={onPacked} onOpenBoard={onOpenBoard} data-enter="card" />
        <RunningLowCard items={D16_STOCK} data-enter="card" />
        <SalesSourcesCard sub={D16_SOURCES_SUB} sources={D16_SOURCES} data-enter="card" />
      </div>
    </div>
  )
}
