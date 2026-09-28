import { useState } from 'react'
import {
  ChannelInsight,
  ReportGenerator,
  GoogleTestPanel,
  Header,
} from './components'
import './styles/cmip.scss'

type CmipTab = 'insight' | 'report' | 'google-test'

// '리포트 생성' 탭은 당분간 숨김 — 필요해지면 이 배열에 다시 추가하면 된다.
// 'google-test'(Google Ads 연동 OAuth·데이터 추출 확인용 임시 탭)도 실 서비스
// 탭이 아니라 개발자 전용이라 같은 이유로 당분간 숨긴다 — 필요해지면 아래
// 주석을 풀면 된다.
const TABS: readonly { id: CmipTab; label: string }[] = [
  { id: 'insight', label: '인사이트 조회' },
  // { id: 'google-test', label: 'Google 연동 테스트' },
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
          {tab === 'insight' && <ChannelInsight />}
          {tab === 'report' && <ReportGenerator />}
          {tab === 'google-test' && <GoogleTestPanel />}
        </div>
      </div>
    </>
  )
}
