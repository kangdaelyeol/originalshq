import { useLocation } from 'react-router-dom'
import { WaterSegmented } from '@/ohq-ui/water/controls'
import { SyncStatus } from '../components/layout/sync-status'
import { TopbarTitle } from '../components/layout/topbar-title'
import { usePeriod } from '../context/period-context'
import { PERIOD_OPTIONS } from '../data/period'
import { MY_WORK_PATH, xtPath } from '../paths'

/**
 * 물 레이아웃 상단바 — 왼쪽 제목(지금 레이아웃과 같은 규칙: 보드 이름·직원 이름·메뉴 이름), 오른쪽 저장 표시와
 * 기간 고르기. 기간은 보드·내 업무에서만 — 숫자 카드의 "… 완료"가 이 기간을 센다. 유리 판 없이 무대 위에 바로.
 */
export function WaterTopbar() {
  const { pathname } = useLocation()
  const { period, setPeriod } = usePeriod()
  const periodic = pathname.startsWith(xtPath('/boards/')) || pathname.startsWith(MY_WORK_PATH)
  return (
    <header className="wl-topbar">
      <TopbarTitle />
      <div className="wl-topbar__controls">
        <SyncStatus />
        {periodic && (
          <WaterSegmented ariaLabel="기간" size="sm" options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
        )}
      </div>
    </header>
  )
}
