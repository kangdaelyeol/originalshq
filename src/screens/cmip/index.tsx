import { useState } from 'react'
import { startGlassTransition, useGlassTheme } from '@/components/glass'
import {
  ChannelInsight,
  ReportGenerator,
  GoogleTestPanel,
  Header,
} from './components'
import './styles/cmip.scss'
import './styles/cmip-glass.scss'

type CmipTab = 'insight' | 'report' | 'google-test'

// '리포트 생성' 탭은 당분간 숨김 — 필요해지면 이 객체에 다시 추가하면 된다.
// 'google-test'(Google Ads 연동 OAuth·데이터 추출 확인용 임시 탭)도 실 서비스
// 탭이 아니라 개발자 전용이라 같은 이유로 당분간 숨긴다 — 필요해지면 아래
// 주석을 풀면 된다.
const TABS = {
  insight: '인사이트 조회',
  // report: '리포트 생성',
  // 'google-test': 'Google 연동 테스트',
} as Record<CmipTab, string>

/** cmip 화면 — 유리(@/components/glass) 셸: 화면 뒤 배경 빛(glass_root), 맨 위
 * 줄(GlassHeader + 테마 고르기), 탭을 바꾸면 새 화면이 흐릿하게 나타난다. */
export default function CmipScreen() {
  const [tab, setTab] = useState<CmipTab>('insight')
  // 테마 — 이 브라우저에 남긴다(<html data-glass-theme>, 바탕색은 그 테마).
  const [theme, setTheme] = useGlassTheme('cmip.theme')

  return (
    <div className="cmip-root glass_root">
      <Header
        tabs={TABS}
        tab={tab}
        onSelectTab={(next) => startGlassTransition(() => setTab(next))}
        theme={theme}
        onSelectTheme={setTheme}
      />
      <main className="cmip glass_page" role="tabpanel">
        {tab === 'insight' && <ChannelInsight />}
        {tab === 'report' && <ReportGenerator />}
        {tab === 'google-test' && <GoogleTestPanel />}
      </main>
    </div>
  )
}
