import { useState } from 'react'
import { MetaInsight, ReportGenerator } from './components'
import './styles/cmip.scss'

type CmipTab = 'insight' | 'report'

// '리포트 생성' 탭은 당분간 숨김 — 필요해지면 이 배열에 다시 추가하면 된다.
const TABS: readonly { id: CmipTab; label: string }[] = [
  { id: 'insight', label: '인사이트 조회' },
]

export default function CmipScreen() {
  const [tab, setTab] = useState<CmipTab>('insight')

  return (
    <div className="cmip">
      <nav className="cmip__tabs" role="tablist" aria-label="cmip">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`cmip__tab${tab === t.id ? ' is-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="cmip__panel" role="tabpanel">
        {tab === 'insight' ? <MetaInsight /> : <ReportGenerator />}
      </div>
    </div>
  )
}
