import '../../styles/ad-settings.scss'
import '../../styles/insight-charts.scss'
import '../../styles/roas-charts.scss'
import '../../styles/ad-test.scss'
import { AutoHeight, LoadingPanel } from '@/components/glass'
import { useAdTestViewModel } from '../../view-model/use-ad-test-view-model'
import { TestDetail } from './test-detail'
import { TestList } from './test-list'

/**
 * "매체별 테스트" 탭 — 캠페인·광고셋 하나를 골라, 광고 설정의 장(변경 이력)마다
 * 나뉜 구간의 성과를 견준다. 구간은 설정에서 오므로 여기서 따로 나누거나
 * 저장하지 않는다. 위쪽 조회 기간과 상관없이, 그 대상의 일별 성과를 플랫폼
 * ID로 따로 받는다.
 */
export function AdTestPanel() {
  const vm = useAdTestViewModel()

  return (
    <section className="channel-insight__section ad-test">
      <AutoHeight className="channel-insight__section-body">
        {!vm.snapshot ? (
          vm.error ? (
            <p className="channel-insight__result-empty">
              광고 설정을 불러오지 못했습니다 — {vm.error}
            </p>
          ) : (
            <LoadingPanel label="광고 설정을 불러오는 중" minHeight={420} />
          )
        ) : (
          <div className="ad-test__inner">
            <div className="channel-insight__section-head">
              <h3 className="channel-insight__section-title">매체별 테스트</h3>
              <span className="ad-test__head-hint">
                광고 설정을 바꾼 날마다 구간이 나뉩니다 — 구간마다 성과를
                견줍니다
              </span>
            </div>
            <div className="ad-test__body">
              <TestList
                targets={vm.targets}
                selectedKey={vm.selectedKey}
                today={vm.today}
                onSelect={vm.select}
              />
              <div className="ad-test__detail">
                <TestDetail key={vm.selectedKey ?? 'none'} vm={vm} />
              </div>
            </div>
          </div>
        )}
      </AutoHeight>
    </section>
  )
}
