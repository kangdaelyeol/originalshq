import { useSearchParams } from 'react-router-dom'
import { BatchLogPanel } from './components/batch-log-panel'
import { InquiryPanel } from './components/inquiry-panel'
import { UsagePanel } from './components/usage-panel'
import './styles/index.scss'

type LogTab = 'batch' | 'inquiry' | 'usage'

const TABS: readonly { id: LogTab; label: string }[] = [
  { id: 'batch', label: '배치 로그' },
  { id: 'inquiry', label: '문의 접수' },
  { id: 'usage', label: '사용 분석' },
]

/**
 * 로그(/log) — 세 탭.
 *   · 배치 로그: 예약 실행 함수가 제때 돌았는지(batchRuns).
 *   · 문의 접수: 웹사이트 상담 신청이 Monday·문자까지 처리됐는지(inquiries).
 *   · 사용 분석: xtool-lead-manager·cmip를 어떤 탭에서 얼마나 봤는지
 *     (usageSegments).
 * 어느 탭인지는 주소의 ?tab= 에 둬서 새로고침·공유해도 같은 탭이 열린다.
 */
export default function LogScreen() {
  const [searchParams, setSearchParams] = useSearchParams()
  const param = searchParams.get('tab')
  const tab: LogTab = TABS.some((each) => each.id === param)
    ? (param as LogTab)
    : 'batch'

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
      {tab === 'batch' && <BatchLogPanel />}
      {tab === 'inquiry' && <InquiryPanel />}
      {tab === 'usage' && <UsagePanel />}
    </div>
  )
}
