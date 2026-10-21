import { useSearchParams } from 'react-router-dom'
import { BatchLogPanel } from './components/batch-log-panel'
import { UsagePanel } from './components/usage-panel'
import './styles/index.scss'

type LogTab = 'batch' | 'usage'

const TABS: readonly { id: LogTab; label: string }[] = [
  { id: 'batch', label: '배치 로그' },
  { id: 'usage', label: '사용 분석' },
]

/**
 * 로그(/log) — 두 탭.
 *   · 배치 로그: 예약 실행 함수가 제때 돌았는지(batchRuns).
 *   · 사용 분석: xtool-lead-manager·cmip를 어떤 탭에서 얼마나 봤는지
 *     (usageSegments).
 * 어느 탭인지는 주소의 ?tab= 에 둬서 새로고침·공유해도 같은 탭이 열린다.
 */
export default function LogScreen() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab: LogTab = searchParams.get('tab') === 'usage' ? 'usage' : 'batch'

  return (
    <div className="batch-log">
      <nav className="batch-log__tabs" role="tablist" aria-label="로그">
        {TABS.map((each) => (
          <button
            key={each.id}
            type="button"
            role="tab"
            aria-selected={each.id === tab}
            className={each.id === tab ? 'is-active' : ''}
            onClick={() =>
              setSearchParams(each.id === 'batch' ? {} : { tab: each.id })
            }
          >
            {each.label}
          </button>
        ))}
      </nav>
      {tab === 'batch' ? <BatchLogPanel /> : <UsagePanel />}
    </div>
  )
}
