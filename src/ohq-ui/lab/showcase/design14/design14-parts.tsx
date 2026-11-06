import { BrainHint } from './brain-hint'
import { BrainStatusBar } from './brain-status-bar'
import { CoreNode } from './core-node'
import { STATUS_ORDER, STATUS_TEXT, WAITING_COUNT, departmentById } from './design14-data'
import { HubNode } from './hub-node'
import { SeatNode } from './seat-node'
import { SignalLine } from './signal-line'
import { StarField } from './star-field'
import { YouNode } from './you-node'

const MKT = departmentById('marketing')

// 상태마다 영상에서 보인 자리 하나씩
const SAMPLE: Record<string, { name: string; progress?: number }> = {
  working: { name: 'Scriptwriter', progress: 0.35 },
  'runs-itself': { name: 'Publisher' },
  waiting: { name: 'Repurposer' },
  'not-running': { name: 'Call Researcher' },
  'in-head': { name: 'Community Manager' },
}

/** 부품 견본 — 장면 아래에 부품마다 따로(위치·배율 없이 1배) */
export function Design14Parts() {
  return (
    <div className="d14-parts">
      <section className="d14-part">
        <p className="d14-part__name">
          <code>{'<HubNode state>'}</code> 부서 고리 — 전체 보기·초점·다른 부서에 초점
        </p>
        <div className="d14-part__row">
          {(['idle', 'focused', 'dim'] as const).map((state) => (
            <figure key={state}>
              <div className="d14-part__well d14-part__well--hub">
                <HubNode count={MKT.seats.length + 1} name={MKT.name} sub={MKT.sub} state={state} tabIndex={-1} />
              </div>
              <figcaption>state=&quot;{state}&quot;</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="d14-part">
        <p className="d14-part__name">
          <code>{'<SeatNode status>'}</code> 자리 — 머리와 상태 다섯 가지(점·고리·호·숨쉬는 고리·▲)
        </p>
        <div className="d14-part__row">
          <figure>
            <div className="d14-part__well d14-part__well--seat">
              <SeatNode head name={MKT.head.name} status="working" tabIndex={-1} />
            </div>
            <figcaption>head</figcaption>
          </figure>
          {STATUS_ORDER.map((status) => (
            <figure key={status}>
              <div className="d14-part__well d14-part__well--seat">
                <SeatNode
                  name={SAMPLE[status].name}
                  status={status}
                  progress={SAMPLE[status].progress}
                  side="right"
                  tabIndex={-1}
                />
              </div>
              <figcaption>{STATUS_TEXT[status]}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="d14-part">
        <p className="d14-part__name">
          <code>{'<CoreNode>'}</code> · <code>{'<YouNode badge>'}</code> · <code>{'<SignalLine>'}</code> ·{' '}
          <code>{'<StarField>'}</code>
        </p>
        <div className="d14-part__row">
          <figure>
            <div className="d14-part__well d14-part__well--core">
              <CoreNode tabIndex={-1} />
            </div>
            <figcaption>KNOWLEDGE CORE</figcaption>
          </figure>
          <figure>
            <div className="d14-part__well d14-part__well--core">
              <YouNode badge={WAITING_COUNT} tabIndex={-1} />
            </div>
            <figcaption>badge={WAITING_COUNT}</figcaption>
          </figure>
          <figure>
            <div className="d14-part__well d14-part__well--line">
              <SignalLine />
            </div>
            <figcaption>270w/s, 꼬리 70w</figcaption>
          </figure>
          <figure>
            <div className="d14-part__well d14-part__well--stars">
              <StarField density={900} />
            </div>
            <figcaption>화면에 붙은 별, 일부만 반짝임</figcaption>
          </figure>
        </div>
      </section>

      <section className="d14-part">
        <p className="d14-part__name">
          <code>{'<BrainStatusBar>'}</code> · <code>{'<BrainHint>'}</code>
        </p>
        <div className="d14-part__stack">
          <div className="d14-part__well d14-part__well--bar">
            <BrainStatusBar signals={2078} inFlight={56} autoTour={false} onAutoTourChange={() => {}} />
          </div>
          <div className="d14-part__well d14-part__well--bar">
            <BrainHint />
          </div>
        </div>
      </section>
    </div>
  )
}
