import { useState } from 'react'
import {
  MetaInsight,
  ReportGenerator,
  GoogleTestPanel,
  Header,
} from './components'
import './styles/cmip.scss'

type CmipTab = 'insight' | 'report' | 'google-test'

// '리포트 생성' 탭은 당분간 숨김 — 필요해지면 이 배열에 다시 추가하면 된다.
// 'google-test'는 실 서비스 탭이 아니라 새로 붙인 Google Ads 연동(OAuth·데이터
// 추출)이 실제로 동작하는지 확인하기 위한 임시 테스트 탭이다.
const TABS: readonly { id: CmipTab; label: string }[] = [
  { id: 'insight', label: '인사이트 조회' },
  { id: 'google-test', label: 'Google 연동 테스트' },
]

export default function CmipScreen() {
  const [tab, setTab] = useState<CmipTab>('insight')

  return (
    <>
      <Header />
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
          {tab === 'insight' && <MetaInsight />}
          {tab === 'report' && <ReportGenerator />}
          {tab === 'google-test' && <GoogleTestPanel />}
        </div>
      </div>
    </>
  )
}
