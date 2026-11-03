import { useState } from 'react'
import { ShowcaseStage } from '../showcase-stage'
import { LiquidTabBar } from './liquid-tab-bar'
import { LiquidTabButton } from './liquid-tab-button'
import { LIQUID_TABS } from './liquid-tab-data'

const [HOME, SEARCH, , HEART] = LIQUID_TABS

// 견본 이름표 — 함수 이름(Icon.name)은 배포 빌드에서 줄어들어서 따로 적는다.
const ICON_NAMES: Record<string, string> = {
  home: 'LiquidHomeIcon',
  search: 'LiquidSearchIcon',
  plus: 'LiquidPlusIcon',
  heart: 'LiquidHeartIcon',
  user: 'LiquidUserIcon',
}

/** Design 1 — sample/design1.mp4: 물이 차오르는 뉴모피즘 하단 탭 바 */
export function Design1Showcase() {
  // 영상 첫 장면처럼 홈이 선택된 채로 시작한다.
  const [tab, setTab] = useState('home')

  return (
    <ShowcaseStage
      title="Design 1 — 물이 차오르는 탭 바"
      note="sample/design1.mp4 · 마우스를 올리면 물이 차고, 누르면 선택돼요(키보드 Tab으로도)"
      className="showcase-stage--d1"
    >
      <div className="d1-scene">
        <LiquidTabBar value={tab} onChange={setTab} />
      </div>

      <div className="d1-parts">
        <section className="d1-part">
          <p className="d1-part__name">
            <code>{'<LiquidTabButton>'}</code> 상태
          </p>
          <div className="d1-part__row d1-part__row--buttons">
            <figure>
              <LiquidTabButton item={SEARCH} wet={false} />
              <figcaption>기본</figcaption>
            </figure>
            <figure>
              <LiquidTabButton item={SEARCH} wet />
              <figcaption>wet — 마우스를 올렸을 때</figcaption>
            </figure>
            <figure>
              <LiquidTabButton item={HEART} wet />
              <figcaption>fillOnWet — 하트는 속을 채움</figcaption>
            </figure>
            <figure>
              <LiquidTabButton item={HOME} selected wet={false} />
              <figcaption>selected — 색 아이콘 + 점</figcaption>
            </figure>
          </div>
        </section>

        <section className="d1-part">
          <p className="d1-part__name">
            <code>LIQUID_TABS</code> 아이콘 · 물 색
          </p>
          <div className="d1-part__row">
            {LIQUID_TABS.map(({ key, icon: Icon, tone }) => (
              <figure key={key} className="d1-tone">
                <span className="d1-tone__icon">
                  <Icon />
                </span>
                <span className="d1-tone__water" style={{ background: `linear-gradient(${tone.top}, ${tone.bottom})` }} />
                <figcaption>
                  <code>{ICON_NAMES[key]}</code>
                  <span>
                    {tone.top} → {tone.bottom}
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      </div>
    </ShowcaseStage>
  )
}
