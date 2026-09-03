import { useState } from 'react'
import { CsvImporter, ReportGenerator } from './components'
import './styles/cmip.scss'

type CmipTab = 'import' | 'report'

const TABS: readonly { id: CmipTab; label: string }[] = [
  { id: 'import', label: 'CSV 입력' },
  { id: 'report', label: '리포트 생성' },
]

export default function CmipScreen() {
  const [tab, setTab] = useState<CmipTab>('import')

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
        {tab === 'import' ? <CsvImporter /> : <ReportGenerator />}
      </div>
    </div>
  )
}
