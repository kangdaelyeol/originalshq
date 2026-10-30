import { useEffect, useRef, useState } from 'react'
import { FitCanvas } from './canvas'
import { COLUMNS, GATE, LOOP } from './data'
import { TIMELINES, useEngine, type Engine } from './engine'

const pad2 = (n: number) => String(n).padStart(2, '0')
/** 8 201 처럼 — 천 단위를 띄어 쓴다. */
const grouped = (n: number) =>
  Math.floor(n).toLocaleString('en-US').replace(/,/g, ' ')

export function TopBar() {
  return (
    <header className="pn-top">
      <b className="pn-top__brand">CMIP / PROMPT PERCEPTRON</b>
      <span className="pn-top__ver">
        <b>LAYER ONE</b> · mlp-0.1.0
      </span>
      <span className="pn-top__flow">
        INPUT → FEATURE → HIDDEN → GATE → PROMPT
      </span>
      <span className="pn-top__who">xtool · creative-ai</span>
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
      ctx.strokeStyle = LOOP[slot].color
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

function CostMetric() {
  return (
    <div className="pn-metric pn-cost">
      <div className="pn-metric__label">COST · 1 PROMPT</div>
      <div className="pn-metric__value pn-cost__value">≈ $0.30</div>
      <div className="pn-cost__rows">
        <span>net</span>
        <div className="pn-cost__net">
          <i />
          <em>$4 in · $20 out / M tok</em>
        </div>
        <span>claude</span>
        <div className="pn-cost__llm">
          <i />
        </div>
      </div>
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
      <CostMetric />
      <ConfidenceMetric engine={engine} />
    </div>
  )
}

// ── 케이스 머리 ─────────────────────────────────────────────────────────

/** 단계 버튼 — 빛 점이 있는 층만 채워지고, 지나간 층은 천천히 꺼진다. */
function Stages({ engine }: { engine: Engine }) {
  const current = useEngine(engine, (s) =>
    s.fading || s.stepOn === 0 ? -1 : TIMELINES[s.slot].steps[s.stepOn - 1].col,
  )
  const slot = useEngine(engine, (s) => s.slot)
  const hold = LOOP[slot].confidence < GATE
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
  const slot = useEngine(engine, (s) => s.slot)
  const count = useEngine(engine, (s) => (s.fading ? 0 : s.subtitleCount))
  const c = LOOP[slot]
  const hold = c.confidence < GATE
  return (
    <div className="pn-case">
      <span className="pn-case__pill">CASE {pad2(c.id)} / 12</span>
      <div className="pn-case__text">
        <h1 className="pn-case__title">{c.title}</h1>
        <p className="pn-case__sub">
          {c.subtitle.slice(0, count).map((seg, i) => (
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
