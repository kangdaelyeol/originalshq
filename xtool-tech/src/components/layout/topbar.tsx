import { Bell, Plus, Search } from 'lucide-react'
import { usePeriod } from '../../context/period-context'
import { PERIOD_OPTIONS } from '../../data/period'
import { Button } from '../ui/button'
import { SegmentedControl } from '../ui/segmented-control'

export function Topbar() {
  const { period, setPeriod } = usePeriod()
  return (
    <header className="glass topbar">
      <label className="search">
        <Search size={15} aria-hidden />
        <input type="search" placeholder="서비스, 커밋, 이슈 번호 검색…" aria-label="검색" />
      </label>
      <div className="topbar__controls">
        <SegmentedControl ariaLabel="조회 기간" options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
        <button type="button" className="icon-button" aria-label="알림 — 새 알림 있음">
          <Bell size={16} aria-hidden />
          <span className="icon-button__dot" aria-hidden />
        </button>
        <Button icon={Plus}>새 이슈</Button>
      </div>
    </header>
  )
}
