import { useState } from 'react'
import { startGlassTransition, useGlassTheme } from '@/components/glass'
import { ChannelInsight, Header } from './components'
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
export default function CmipScreen() {
  const [resultTab, setResultTab] = useState<ResultTab>('total')
  // 테마 — 이 브라우저에 남긴다(<html data-glass-theme>, 바탕색은 그 테마).
  const [theme, setTheme] = useGlassTheme('cmip.theme')

  return (
    <div className="cmip-root glass_root">
      <Header
        tabs={RESULT_TAB_LABEL}
        tab={resultTab}
        onSelectTab={(next) => startGlassTransition(() => setResultTab(next))}
        theme={theme}
        onSelectTheme={setTheme}
      />
      <main className="cmip glass_page">
        <ChannelInsight resultTab={resultTab} />
      </main>
    </div>
  )
}
