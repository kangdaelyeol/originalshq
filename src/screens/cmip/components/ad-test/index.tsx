import '../../styles/ad-settings.scss'
import '../../styles/insight-charts.scss'
import '../../styles/roas-charts.scss'
import '../../styles/ad-test.scss'
import { useEffect } from 'react'
import { AutoHeight, LoadingPanel } from '@/components/glass'
import { useAdTestViewModel } from '../../view-model/use-ad-test-view-model'
import { TestDetail } from './test-detail'
import { TestList } from './test-list'

/**
 * "매체별 테스트" 탭 — 캠페인·광고셋 하나를 골라 성과를 구간으로 나눠 견준다.
 * 테스트(구간·가설·판단 지표)는 모두가 같이 보는 DB(adTests)에 대상마다 하나.
 * 위쪽 조회 기간과 상관없이, 그 대상의 일별 성과를 플랫폼 ID로 따로 받는다.
 */
export function AdTestPanel() {
  const vm = useAdTestViewModel()
  const { notice, setNotice } = vm

  // 알림은 잠깐 보였다가 사라진다.
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(timer)
  }, [notice, setNotice])

  return (
    <section className="channel-insight__section ad-test">
      <AutoHeight className="channel-insight__section-body">
        {!vm.snapshot ? (
          vm.error ? (
            <p className="channel-insight__result-empty">
              테스트 목록을 불러오지 못했습니다 — {vm.error}
            </p>
          ) : (
            <LoadingPanel label="테스트를 불러오는 중" minHeight={420} />
          )
        ) : (
          <div className="ad-test__inner">
            <div className="channel-insight__section-head">
              <h3 className="channel-insight__section-title">매체별 테스트</h3>
              <span className="ad-test__head-hint">
                캠페인·광고셋 하나의 성과를 구간으로 나눠 견줍니다 — 저장하면
                모두가 같이 봅니다
              </span>
            </div>
            <div className="ad-test__body">
              <TestList
                tests={vm.snapshot.tests}
                entities={vm.snapshot.entities}
                selectedKey={vm.selectedKey}
                today={vm.today}
                hasDraft={vm.hasDraft}
                onSelect={vm.select}
              />
              <div className="ad-test__detail">
                <TestDetail key={vm.selectedKey ?? 'none'} vm={vm} />
              </div>
            </div>
            {notice && (
              <div className="ad-settings__notice" role="status">
                {notice}
              </div>
            )}
          </div>
        )}
      </AutoHeight>
    </section>
  )
}
