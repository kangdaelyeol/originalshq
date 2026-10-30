import { useEffect, useRef, useState } from 'react'
import { FitCanvas } from './canvas'
import { COLUMNS, GATE } from './data'
import { useEngine, type Engine } from './engine'
import {
  fmtTime,
  fmtTokens,
  fmtUsd,
  useModel,
  type GraphStore,
  type Meta,
} from './model'

const pad2 = (n: number) => String(n).padStart(2, '0')
/** 8 201 처럼 — 천 단위를 띄어 쓴다. */
const grouped = (n: number) =>
  Math.floor(n).toLocaleString('en-US').replace(/,/g, ' ')

/** 저장 상태 한 줄 — 서버 작업본 버전과 지금 상태. */
const syncLabel = ({ status, savedAt }: Meta) => {
  switch (status) {
    case 'loading':
      return '불러오는 중…'
    case 'pending':
    case 'saving':
      return '저장 중…'
    case 'offline':
      return '오프라인 · 이 브라우저에 저장됨'
    case 'conflict':
      return '다른 곳에서 먼저 바뀜'
    default:
      return savedAt ? `${fmtTime(savedAt)} 저장` : '기본값'
  }
}

/** 망 버전·저장 상태·게시 — 게시한 버전을 소재 분석 API가 쓴다. */
function GraphSync({ store }: { store: GraphStore }) {
  const { meta } = useModel()
  const [publishing, setPublishing] = useState(false)
  const upToDate =
    meta.status === 'synced' && meta.published?.version === meta.version
  const publish = async () => {
    setPublishing(true)
    await store.publish()
    setPublishing(false)
  }
  return (
    <span
      className={`pn-sync is-${meta.status}`}
      title={meta.error ?? '망을 고치면 CMIP 서버에 저장되고 버전이 오릅니다'}
    >
      <b>graph v{meta.version}</b>
      <span>{syncLabel(meta)}</span>
      {meta.status === 'offline' && (
        <button type="button" onClick={() => store.retry()}>
          다시 시도
        </button>
      )}
      {meta.status === 'conflict' && (
        <>
          <button type="button" onClick={() => void store.takeServer()}>
            서버 것 불러오기
          </button>
          <button type="button" onClick={() => void store.overwrite()}>
            내 것으로 덮어쓰기
          </button>
        </>
      )}
      <em>{meta.published ? `게시 v${meta.published.version}` : '게시 전'}</em>
      <button
        type="button"
        className="is-publish"
        disabled={
          publishing ||
          upToDate ||
          meta.status === 'loading' ||
          meta.status === 'conflict' ||
          meta.status === 'offline'
        }
        title="지금 망을 게시 — 소재 분석 API가 이 버전으로 프롬프트를 만듭니다"
        onClick={() => void publish()}
      >
        {publishing ? '게시 중…' : upToDate ? '게시됨' : '게시'}
      </button>
    </span>
  )
}

export function TopBar({
  store,
  metricsOpen,
  onToggleMetrics,
}: {
  store: GraphStore
  metricsOpen: boolean
  onToggleMetrics: () => void
}) {
  return (
    <header className="pn-top">
      <b className="pn-top__brand">CMIP / PROMPT PERCEPTRON</b>
      <span className="pn-top__ver">
        <b>LAYER ONE</b>
      </span>
      <GraphSync store={store} />
      <span className="pn-top__flow">
        INPUT → FEATURE → HIDDEN → GATE → PROMPT
      </span>
      <span className="pn-top__who">xtool · creative-ai</span>
      <button
        type="button"
        className={`pn-toggle${metricsOpen ? '' : ' is-closed'}`}
        title="위 지표 줄 숨기기/보기 (H)"
        aria-expanded={metricsOpen}
        onClick={onToggleMetrics}
      >
        {metricsOpen ? '지표 숨기기' : '지표 보기'}
      </button>
    </header>
  )
}

// ── 지표 4칸 ────────────────────────────────────────────────────────────

/** 1초에 처리하는 신호 수(시뮬레이션) — 한 바퀴는 10 000개. */
const RATE = 380
const RUN_SIZE = 10000
const SQUARES = 32

function SignalsMetric({ engine }: { engine: Engine }) {
  const numRef = useRef<HTMLElement>(null)
  const [head, setHead] = useState(0)
  useEffect(() => {
    let count = 562 + engine.frame.t * RATE
    let shown = -1
    return engine.onFrame(({ dt }) => {
      count += dt * RATE
      const v = Math.floor(count)
      if (v !== shown && numRef.current) {
        shown = v
        numRef.current.textContent = grouped(v)
      }
      setHead(Math.floor(((count % RUN_SIZE) / RUN_SIZE) * SQUARES))
    })
  }, [engine])
  return (
    <div className="pn-metric">
      <div className="pn-metric__label">SIGNALS · THIS RUN</div>
      <div className="pn-metric__value">
        <b ref={numRef}>562</b>
      </div>
      <div className="pn-squares">
        {Array.from({ length: SQUARES }, (_, i) => (
          <i
            key={i}
            className={i < head ? 'is-on' : i === head ? 'is-head' : undefined}
          />
        ))}
      </div>
      <div className="pn-metric__foot">SIM · one loop = 10 000</div>
    </div>
  )
}

/** 들쭉날쭉한 지연 시간 선 — 70ms마다 한 칸씩 밀린다. */
function LatencyMetric({ engine }: { engine: Engine }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const fit = new FitCanvas(canvasRef.current!)
    let seed = 11
    const rand = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }
    const values = Array.from({ length: 28 }, rand)
    let acc = 0
    let lastSlot = -1
    const off = engine.onFrame(({ slot, dt }) => {
      acc += dt
      if (acc >= 0.07) {
        acc = 0
        values.shift()
        values.push(rand())
        fit.dirty = true
      }
      if (slot !== lastSlot) {
        lastSlot = slot
        fit.dirty = true
      }
      if (!fit.dirty) return
      fit.dirty = false
      const { ctx, w, h } = fit
      ctx.clearRect(0, 0, w, h)
      ctx.lineWidth = 1.4
      ctx.lineJoin = 'round'
      ctx.strokeStyle = engine.model.graph.cases[slot].color
      ctx.beginPath()
      values.forEach((v, i) => {
        const x = (i / (values.length - 1)) * w
        const y = 2 + (1 - (0.15 + v * 0.8)) * (h - 4)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()
    })
    return () => {
      off()
      fit.dispose()
    }
  }, [engine])
  return (
    <div className="pn-metric pn-lat">
      <div className="pn-metric__label">MEDIAN LATENCY · NET</div>
      <div className="pn-metric__value">
        <b>~312</b>
        <small>ms</small>
      </div>
      <canvas className="pn-lat__spark" ref={canvasRef} />
      <div className="pn-lat__track">
        <i />
      </div>
      <div className="pn-metric__foot">mock runs · not SLAs</div>
    </div>
  )
}

/** 이 프롬프트의 비용 — 입력(프롬프트 글 + 경로가 함께 보내는 영상 프레임·표)
 * × 입력 단가 + 예상 응답 × 출력 단가. 보류면 Claude를 부르지 않아 $0. */
function CostMetric({ engine }: { engine: Engine }) {
  const model = useModel()
  const slot = useEngine(engine, (s) => s.slot)
  const { cost, hold } = model.cases[slot]
  const max = Math.max(cost.inCost, cost.outCost) || 1
  return (
    <div
      className="pn-metric pn-cost"
      title={`단가 $${cost.price.in} 입력 · $${cost.price.out} 출력 / 100만 토큰 — PROMPT 칸에서 바꿀 수 있습니다`}
    >
      <div className="pn-metric__label">COST · THIS PROMPT</div>
      <div className="pn-metric__value pn-cost__value">
        {hold ? '$0.00' : `≈ ${fmtUsd(cost.total)}`}
      </div>
      {hold ? (
        <div className="pn-cost__hold">보류 — Claude를 부르지 않습니다</div>
      ) : (
        <div className="pn-cost__rows">
          <span>in</span>
          <div className="pn-cost__bar">
            <span>
              <i
                className="is-in"
                style={{ width: `${(cost.inCost / max) * 100}%` }}
              />
            </span>
            <em>
              {fmtTokens(cost.inTokens)} tok · {fmtUsd(cost.inCost)}
            </em>
          </div>
          <span>out</span>
          <div className="pn-cost__bar">
            <span>
              <i style={{ width: `${(cost.outCost / max) * 100}%` }} />
            </span>
            <em>
              {fmtTokens(cost.outTokens)} tok · {fmtUsd(cost.outCost)}
            </em>
          </div>
        </div>
      )}
    </div>
  )
}

/** 신뢰도 — 은닉층을 지나면 세기 시작해, 게이트에서 통과/보류가 붙는다. */
function ConfidenceMetric({ engine }: { engine: Engine }) {
  const text = useEngine(engine, (s) => s.confText)
  const phase = useEngine(engine, (s) => s.confPhase)
  const verdict = useEngine(engine, (s) => s.verdict)
  const value = phase === 'pending' ? 0 : Number(text)
  const tone =
    phase === 'counting'
      ? ' is-count'
      : phase === 'final'
        ? value < GATE
          ? ' is-hold'
          : ' is-pass'
        : ''
  return (
    <div className={`pn-metric pn-conf${tone}`}>
      <div className="pn-metric__label">CONFIDENCE · LIVE</div>
      <div className="pn-metric__value">
        <b className="pn-conf__num">{text}</b>
        {verdict && (
          <span className="pn-conf__badge">
            {verdict === 'pass' ? 'PASS' : 'HOLD'}
          </span>
        )}
      </div>
      <div className="pn-conf__bar">
        <i style={{ width: `${value * 100}%` }} />
        <em style={{ left: `${GATE * 100}%` }} />
      </div>
      <div className="pn-metric__foot">
        <span>calibrate on yours</span>
        <b>gate {GATE.toFixed(2)}</b>
      </div>
    </div>
  )
}

export function MetricRow({ engine }: { engine: Engine }) {
  return (
    <div className="pn-metrics">
      <SignalsMetric engine={engine} />
      <LatencyMetric engine={engine} />
      <CostMetric engine={engine} />
      <ConfidenceMetric engine={engine} />
    </div>
  )
}

// ── 케이스 머리 ─────────────────────────────────────────────────────────

/** 단계 버튼 — 빛 점이 있는 층만 채워지고, 지나간 층은 천천히 꺼진다. */
function Stages({ engine }: { engine: Engine }) {
  const model = useModel()
  const current = useEngine(engine, (s) =>
    s.fading || s.stepOn === 0
      ? -1
      : engine.model.cases[s.slot].timeline.steps[s.stepOn - 1].col,
  )
  const slot = useEngine(engine, (s) => s.slot)
  const hold = model.cases[slot].hold
  return (
    <div className="pn-stages">
      {COLUMNS.map((c, i) => (
        <span
          key={c.stage}
          className={`pn-stage${i === current ? (hold && i >= 3 ? ' is-warn' : ' is-on') : ''}`}
        >
          {c.stage}
        </span>
      ))}
    </div>
  )
}

export function CaseHeader({ engine }: { engine: Engine }) {
  const model = useModel()
  const slot = useEngine(engine, (s) => s.slot)
  const count = useEngine(engine, (s) => (s.fading ? 0 : s.subtitleCount))
  const { def: c, hold, subtitle } = model.cases[slot]
  return (
    <div className="pn-case">
      <span className="pn-case__pill">CASE {pad2(c.id)} / 12</span>
      <div className="pn-case__text">
        <h1 className="pn-case__title">{c.title}</h1>
        <p className="pn-case__sub">
          {subtitle.slice(0, count).map((seg, i) => (
            <span
              key={`${slot}:${i}`}
              className={
                hold && i % 2 === 1
                  ? 'is-warn'
                  : i === 1
                    ? 'is-strong'
                    : undefined
              }
            >
              {i > 0 && <em>→</em>}
              {seg}
            </span>
          ))}
        </p>
      </div>
      <Stages engine={engine} />
    </div>
  )
}
