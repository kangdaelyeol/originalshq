import { RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../../components/button'
import { ShowcaseStage } from '../showcase-stage'
import { AgentCard } from './agent-card'
import { ChipNode } from './chip-node'
import { D13Clock, D13ClockContext } from './d13-clock'
import {
  D13_PART_AGENTS,
  D13_PART_EVENTS,
  D13_PART_LANDS,
  D13_PART_TAPE,
  D13_PART_VERDICTS,
  D13_STATS,
} from './design13-data'
import { LandsPanel } from './lands-panel'
import { LivePill } from './live-pill'
import { OrbitScene } from './orbit-scene'
import { OrbitTag } from './orbit-tag'
import { ParticleRing } from './particle-ring'
import { StatCard } from './stat-card'
import { TapeBar } from './tape-bar'
import { VerdictBadge } from './verdict-badge'
import { VerdictList } from './verdict-list'

/** Design 13 — sample/design13-circle.mp4: 궤도 관제판(가운데 칩 둘레를 도는 에이전트 열과 실시간 판정판) */
export function Design13Showcase() {
  // 이 견본만의 시계 — "처음부터"는 숫자 오르기·막대 차오르기까지 영상 F0부터 다시
  const [clock] = useState(() => new D13Clock())

  return (
    <ShowcaseStage
      title="Design 13 — 궤도 관제판"
      note="sample/design13-circle.mp4 · 영상 규칙(사건 0.2975초·카드 19초 한 바퀴·입자 43~123°/초)대로 끝없이 돌아요(움직임 줄이기 설정이면 한 장면으로 멈춰요)"
      className="showcase-stage--d13"
      actions={
        <Button variant="ghost" size="sm" icon={RotateCcw} onClick={() => clock.restart()}>
          처음부터
        </Button>
      }
    >
      <D13ClockContext value={clock}>
        <div className="d13-scene">
          <div className="d13-page" lang="en">
            <OrbitScene />
            <div className="d13-board">
              <TapeBar />
              <div className="d13-stats">
                {D13_STATS.map((stat) => (
                  <StatCard key={stat.label} {...stat} />
                ))}
              </div>
              <div className="d13-panels">
                <VerdictList />
                <LandsPanel />
              </div>
            </div>
          </div>
        </div>
      </D13ClockContext>

      <div className="d13-parts">
        <section className="d13-part">
          <p className="d13-part__name">
            <code>{'<OrbitScene agents events chipLabel>'}</code> 카드 여섯 장·다른 사건 차례
          </p>
          <div className="d13-part__row">
            <figure>
              <div className="d13-part__well d13-part__well--scene">
                <OrbitScene agents={D13_PART_AGENTS} events={D13_PART_EVENTS} chipLabel="ATL" particles={90} />
              </div>
              <figcaption>agents 6 · particles 90</figcaption>
            </figure>
            <figure>
              <div className="d13-part__well d13-part__well--scene">
                <ParticleRing count={70} speed={[20, 60]} dashes={false} seed={5} />
              </div>
              <figcaption>
                <code>{'<ParticleRing count={70} speed={[20, 60]}>'}</code>
              </figcaption>
            </figure>
          </div>
        </section>

        <section className="d13-part">
          <p className="d13-part__name">
            <code>{'<ChipNode>'}</code> · <code>{'<AgentCard heat>'}</code> · <code>{'<OrbitTag>'}</code> ·{' '}
            <code>{'<VerdictBadge>'}</code>
          </p>
          <div className="d13-part__row">
            <figure>
              <div className="d13-part__well d13-part__well--chip">
                <ChipNode />
              </div>
              <figcaption>label=&quot;JEV&quot;</figcaption>
            </figure>
            <figure>
              <div className="d13-part__well d13-part__well--chip">
                <ChipNode label="ATL" serial={42} still />
              </div>
              <figcaption>serial 42 · still</figcaption>
            </figure>
            <figure>
              <div className="d13-part__well d13-part__well--cards">
                <AgentCard name="doom" sub="WASM frame" heat={0} />
                <AgentCard name="curate" sub="1,480 rows/s" heat={0.48} />
                <AgentCard name="killmyidea" sub="kill / fix / ship" heat={1} />
              </div>
              <figcaption>heat 0 · 0.48 · 1</figcaption>
            </figure>
            <figure>
              <div className="d13-part__well d13-part__well--chips">
                <OrbitTag text="SCO" />
                <OrbitTag text="CHO" tilt={-7} />
                <OrbitTag text="NOU" tilt={7} />
                <VerdictBadge p={0.83} word="keep" />
                <VerdictBadge p={0.12} word="drop" />
              </div>
              <figcaption>tilt ±7° · p / word</figcaption>
            </figure>
          </div>
        </section>

        <section className="d13-part">
          <p className="d13-part__name">
            <code>{'<TapeBar messages live>'}</code> · <code>{'<LivePill>'}</code> · <code>{'<StatCard>'}</code>
          </p>
          <div className="d13-part__stack">
            <div className="d13-part__well d13-part__well--wide">
              <TapeBar messages={D13_PART_TAPE} live={false} />
            </div>
            <div className="d13-part__row">
              <figure>
                <div className="d13-part__well d13-part__well--pill">
                  <LivePill />
                  <LivePill label="REC" />
                </div>
                <figcaption>label=&quot;REC&quot;</figcaption>
              </figure>
              <figure>
                <div className="d13-part__well d13-part__well--stats">
                  <StatCard {...D13_STATS[1]} />
                  <StatCard {...D13_STATS[3]} />
                  <StatCard {...D13_STATS[5]} />
                </div>
                <figcaption>count · rise · static(평평한 선)</figcaption>
              </figure>
            </div>
          </div>
        </section>

        <section className="d13-part">
          <p className="d13-part__name">
            <code>{'<VerdictList verdicts rows>'}</code> · <code>{'<LandsPanel bars>'}</code> 다른 값
          </p>
          <div className="d13-part__row">
            <figure>
              <div className="d13-part__well d13-part__well--panel">
                <VerdictList verdicts={D13_PART_VERDICTS} rows={3} judged={null} title="RELAY LOG" />
              </div>
              <figcaption>rows 3 · judged 없음</figcaption>
            </figure>
            <figure>
              <div className="d13-part__well d13-part__well--panel">
                <LandsPanel bars={D13_PART_LANDS} title="WHERE IT SETTLES" />
              </div>
              <figcaption>bars 2</figcaption>
            </figure>
          </div>
        </section>
      </div>
    </ShowcaseStage>
  )
}
