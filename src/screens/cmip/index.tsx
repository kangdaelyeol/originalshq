import { useState } from 'react'
import { startGlassTransition, useGlassTheme } from '@/components/glass'
import { ChannelInsight, Header } from './components'
import { AdSettingsPanel } from './components/ad-settings'
import { AdTestPanel } from './components/ad-test'
import { RESULT_TAB_LABEL } from './components/channel-insight/constants'
import type { ResultTab } from './view-model/use-channel-insight-page-view-model'
import './styles/cmip.scss'
import './styles/cmip-glass.scss'

// 지금 화면은 인사이트 조회 하나다. 예전 최상위 탭 '리포트 생성'
// (ReportGenerator)·'Google 연동 테스트'(GoogleTestPanel, 개발자용 OAuth·데이터
// 추출 확인)는 숨겨 두었다 — 부품은 components/에 그대로 있어서, 다시 쓰려면
// 여기서 그려 주면 된다.

/** cmip 화면 — 유리(@/components/glass) 셸: 화면 뒤 배경 빛(glass_root), 맨 위
 * 줄(GlassHeader — 가운데 보기 단위 탭 + 테마 고르기). 보기 단위를 바꾸면 새
 * 보기가 흐릿하게 나타나고 맨 위 줄은 그대로 남는다. */
// 맨 위 탭 — 보기 단위(인사이트 결과) + 광고 설정.
type ScreenTab = ResultTab | 'adSettings'
const SCREEN_TAB_LABEL: Record<ScreenTab, string> = {
  ...RESULT_TAB_LABEL,
  adSettings: '광고 설정',
}

// 위쪽 조회(기간·인사이트)와 상관없이 따로 받는 탭 — 이 탭을 보는 동안
// 인사이트는 숨겨 두고(조회 결과는 그대로) 이 탭만 그린다.
const STANDALONE: ReadonlySet<ScreenTab> = new Set(['periodTest', 'adSettings'])

export default function CmipScreen() {
  const [tab, setTab] = useState<ScreenTab>('total')
  // 광고 설정을 보는 동안에도 인사이트는 마지막 보기 그대로 붙여 둔다(숨김) —
  // 돌아오면 다시 조회하지 않고 바로 보인다.
  const [resultTab, setResultTab] = useState<ResultTab>('total')
  // 테마 — 이 브라우저에 남긴다(<html data-glass-theme>, 바탕색은 그 테마).
  const [theme, setTheme] = useGlassTheme('cmip.theme')

  return (
    <div className="cmip-root glass_root">
      <Header
        tabs={SCREEN_TAB_LABEL}
        tab={tab}
        onSelectTab={(next) =>
          startGlassTransition(() => {
            setTab(next)
            if (!STANDALONE.has(next)) setResultTab(next as ResultTab)
          })
        }
        theme={theme}
        onSelectTheme={setTheme}
      />
      <main className="cmip glass_page">
        <div hidden={STANDALONE.has(tab)}>
          <ChannelInsight resultTab={resultTab} />
        </div>
        {tab === 'periodTest' && <AdTestPanel />}
        {tab === 'adSettings' && <AdSettingsPanel />}
      </main>
    </div>
  )
}
