import { ChevronDown, Crown } from 'lucide-react'
import { useState, type CSSProperties } from 'react'
import { cx } from '@/ohq-ui/lib/cx'
import { WaterBar } from '@/ohq-ui/water/charts/water-bar'
import { WaterCard } from '@/ohq-ui/water/surfaces/water-card'
import { WaterEmpty } from '@/ohq-ui/water/surfaces/water-empty'
import { WaterSkeletonBlock } from '@/ohq-ui/water/surfaces/water-skeleton'
import type { KingDef, KingPeriod, KingResult, KingRow } from '../../../data/tech-kings'
import { shortDate } from '../../../lib/dates'

// 처음에 보여 줄 순위 수 — 나머지는 "외 N명"
const SHOWN = 5

interface WaterKingCardProps {
  def: KingDef
  spanLabel: string
  previousLabel: string
  period: KingPeriod
  result: KingResult | null
  previousTop: KingRow | null
}

/**
 * 기술팀 왕(D7) — KingCard와 같은 props. 담당자 순위를 홈 막대로(위에서부터 21ms 간격으로 extend 스프링 차오름),
 * 1위는 어두운 표시 알약 속 왕관. 줄을 누르면 센 기록이 펼쳐진다 — 높이를 움직이지 않고(레이아웃 한 번) 기록 줄이
 * 위에서부터 21ms 간격으로 55ms 동안 진해지고, 꺾쇠는 D7 move 스프링으로 돈다. 불러오는 동안은 빈 홈 줄 + 빛.
 */
export function WaterKingCard({ def, spanLabel, previousLabel, period, result, previousTop }: WaterKingCardProps) {
  const [open, setOpen] = useState<string | null>(null)
  const max = Math.max(1, ...(result?.rows.map((r) => r.count) ?? [1]))
  const rows = result?.rows.slice(0, SHOWN) ?? []

  return (
    <WaterCard title={`${spanLabel} ${def.title}`} className="water-king" busy={result === null}>
      {result === null ? (
        <div className="water-king__skeleton">
          {[0, 1, 2].map((i) => (
            <div key={i} className="water-king__skel-row">
              <WaterSkeletonBlock shape="circle" width={22} height={22} />
              <WaterSkeletonBlock width={[56, 44, 50][i]} />
              <WaterSkeletonBlock width="100%" className="water-king__skel-bar" />
              <WaterSkeletonBlock width={28} />
            </div>
          ))}
          <span className="sr-only" role="status">
            불러오는 중…
          </span>
        </div>
      ) : rows.length === 0 ? (
        <WaterEmpty title={`아직 실적이 없어요 (${shortDate(period.start)}~${shortDate(period.end)})`} />
      ) : (
        <ol className="water-king__rank">
          {rows.map((row, i) => {
            const opened = open === row.name
            return (
              <li
                key={row.name}
                className={cx('water-king__item', 'water-reveal', i === 0 && 'is-top')}
                style={{ '--w-i': i } as CSSProperties}
              >
                <button
                  type="button"
                  className="water-king__row"
                  aria-expanded={opened}
                  onClick={() => setOpen(opened ? null : row.name)}
                >
                  <span className="water-king__no">
                    {i === 0 ? (
                      <>
                        <Crown size={13} strokeWidth={2.2} aria-hidden />
                        <span className="sr-only">1위</span>
                      </>
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span className="water-king__name">{row.name}</span>
                  <WaterBar value={row.count / max} index={i} size="sm" className="water-king__bar" />
                  <span className="water-king__count">{row.count}건</span>
                  <ChevronDown size={14} className={cx('water-king__chev', opened && 'is-open')} aria-hidden />
                </button>
                {opened && (
                  <ul className="water-king__facts">
                    {row.facts.slice(0, 12).map((fact, k) => (
                      <li key={fact.itemId} className="water-reveal" style={{ '--w-i': k } as CSSProperties}>
                        <span>
                          {def.dateLabel} {shortDate(fact.date)}
                        </span>
                        {fact.name || '(이름 없음)'}
                      </li>
                    ))}
                    {row.facts.length > 12 && <li className="water-king__more">외 {row.facts.length - 12}건</li>}
                    {row.facts.length === 0 && <li className="water-king__more">센 기록이 없어요</li>}
                  </ul>
                )}
              </li>
            )
          })}
        </ol>
      )}

      {result && (
        <footer className="water-king__foot">
          <span>합계 {result.total}건</span>
          {result.rows.length > SHOWN && <span>외 {result.rows.length - SHOWN}명</span>}
          {result.unassigned > 0 && <span>담당자 없음 {result.unassigned}건</span>}
          <span>
            {previousLabel} 1위 {previousTop ? `${previousTop.name} ${previousTop.count}건` : '없음'}
          </span>
        </footer>
      )}
    </WaterCard>
  )
}
