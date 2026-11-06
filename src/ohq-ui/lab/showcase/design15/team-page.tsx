import { Plus } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import { cssVars } from './d15-format'
import { EASE_IN_OUT_CUBIC, LAYOUT_MS, prefersReducedMotion } from './d15-motion'
import { D15_MEMBERS, D15_PAGE_HEAD, D15_TEAM_FILTERS, type D15TeamFilter } from './design15-data'
import { MemberCard } from './member-card'
import { PageHead } from './page-head'
import { PillTabs } from './pill-tabs'

interface TeamPageProps {
  onProfile: (id: string) => void
}

/**
 * Team(F358) — 부서 알약으로 거르면 맞지 않는 카드는 바로 빠지고, 남은 카드가 새 칸으로 가로로만 미끄러진다
 * (F362 누름 → F363.25~F374 easeInOutCubic 0.35초. 줄이 바뀌는 MK도 세로는 한 번에 올라가고 가로만 움직인다).
 */
export function TeamPage({ onProfile }: TeamPageProps) {
  const [filter, setFilter] = useState<D15TeamFilter>('All')
  const grid = useRef<HTMLDivElement>(null)
  const before = useRef<Map<string, number> | null>(null)
  const online = D15_MEMBERS.filter((m) => m.presence === 'online').length
  const members = D15_MEMBERS.filter((m) => filter === 'All' || m.dept === filter)
  const head = D15_PAGE_HEAD.team

  const measure = () => {
    const out = new Map<string, number>()
    const g = grid.current
    if (!g) return out
    const gr = g.getBoundingClientRect()
    const scale = gr.width / g.offsetWidth || 1
    g.querySelectorAll<HTMLElement>('[data-slot]').forEach((el) => {
      out.set(el.dataset.slot ?? '', (el.getBoundingClientRect().left - gr.left) / scale)
    })
    return out
  }

  const change = (next: D15TeamFilter) => {
    if (next === filter) return
    before.current = measure()
    setFilter(next)
  }

  useLayoutEffect(() => {
    const prev = before.current
    before.current = null
    if (!prev || prefersReducedMotion()) return
    const g = grid.current
    measure().forEach((x, id) => {
      const el = g?.querySelector<HTMLElement>(`[data-slot="${id}"]`)
      if (!el) return
      const old = prev.get(id)
      if (old === undefined) {
        el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: LAYOUT_MS, easing: EASE_IN_OUT_CUBIC })
        return
      }
      if (Math.abs(old - x) < 0.5) return
      el.animate([{ transform: `translateX(${old - x}px)` }, { transform: 'none' }], {
        duration: LAYOUT_MS,
        easing: EASE_IN_OUT_CUBIC,
      })
    })
  }, [filter])

  return (
    <div className="d15-team">
      <PageHead
        title={head.title}
        sub={head.sub}
        actions={
          <button type="button" className="d15-btn d15-btn--solid">
            <Plus aria-hidden strokeWidth={2.4} />
            Invite member
          </button>
        }
      />
      <div className="d15-toolbar d15-rise">
        <PillTabs options={D15_TEAM_FILTERS} value={filter} onChange={change} tourId="team-tab" label="Filter team" />
        <p className="d15-toolbar__note">
          <b>{online}</b> online now
        </p>
      </div>
      <div ref={grid} className="d15-team__grid">
        {members.map((m) => (
          <div key={m.id} className="d15-team__slot" data-slot={m.id}>
            <div className="d15-rise" style={cssVars({ '--i': 1 + D15_MEMBERS.indexOf(m) })}>
              <MemberCard member={m} onProfile={() => onProfile(m.id)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
