import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { FitCanvas } from './canvas'
import { COLUMNS, GATE, USE_CASES } from './data'
import { useEngine, type Engine, type Snapshot } from './engine'
import { fmtTime, fmtUsd, useModel, type Model } from './model'

const pad2 = (n: number) => String(n).padStart(2, '0')

const Panel = ({
  title,
  note,
  className,
  children,
}: {
  title: string
  note: ReactNode
  className: string
  children: ReactNode
}) => (
  <div className={`pn-panel ${className}`}>
    <div className="pn-panel__head">
      <b>
        <i />
        {title}
      </b>
      <span>{note}</span>
    </div>
    <div className="pn-panel__body">{children}</div>
  </div>
)

const LockIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path
      d="M4.5 7V5a3.5 3.5 0 0 1 7 0v2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    />
    <rect x="2.5" y="7" width="11" height="7.5" rx="1.2" fill="currentColor" />
  </svg>
)

// ── 병렬 특징 ───────────────────────────────────────────────────────────

/** 특징 종류별 색 — 아래 신뢰도 흐름의 선 색과 같다. */
const KIND_COLOR: Record<string, string> = {
  Choice: '#ff4f7b',
  Score: '#49dae4',
  Flag: '#cfe85e',
}

/** 이 입력에 대한 특징 질문의 답 — 막대는 신뢰도, 흰 눈금은 게이트(0.80).
 * 경로가 지나는 질문(테두리)의 신뢰도로 게이트를 판정한다. 줄을 누르면 그 노드를
 * 편집한다. */
function ParallelPanel({
  engine,
  onSelect,
}: {
  engine: Engine
  onSelect: (id: string) => void
}) {
  const model = useModel()
  const slot = useEngine(engine, (s) => s.slot)
  const asked = useEngine(engine, (s) => !s.fading && s.stepOn >= 2)
  const { features, def } = model.cases[slot]
  const answered = model.graph.layers[1].filter((n) => def.answers[n.id]).length
  return (
    <Panel
      title="PARALLEL FEATURES"
      note={`${answered} / ${model.graph.layers[1].length} answered`}
      className="pn-par"
    >
      {features.map((f) => (
        <button
          key={f.id}
          type="button"
          className={`pn-par__row${f.onPath ? ' is-path' : ''}${asked && f.onPath ? ' is-picked' : ''}`}
          title={`${f.kind} · ${f.name} — ${f.answer ? `${f.answer} (${f.conf.toFixed(2)})` : '답 없음'} · 눌러서 편집`}
          onClick={() => onSelect(f.id)}
        >
          <span>{f.name}</span>
          <div
            className="pn-par__track"
            style={
              {
                '--c': KIND_COLOR[f.kind] ?? '#9d98b3',
                '--gate': `${GATE * 100}%`,
              } as CSSProperties
            }
          >
            {f.answer !== null && <i style={{ width: `${f.conf * 100}%` }} />}
          </div>
          <em>{f.answer ?? '—'}</em>
        </button>
      ))}
      <p className="pn-panel__foot">typed answers · no LLM yet</p>
    </Panel>
  )
}

// ── 신뢰도 흐름 ─────────────────────────────────────────────────────────

/** 세 줄의 물결 — [진폭, 간격당 위상, 초당 위상, 시작 위상]의 합. */
const STREAMS: {
  name: string
  color: string
  base: number
  waves: number[][]
}[] = [
  {
    name: 'Choice',
    color: '#ff4f7b',
    base: 0.78,
    waves: [
      [0.17, 0.36, 2.3, 0],
      [0.05, 0.83, -1.4, 2],
    ],
  },
  {
    name: 'Score',
    color: '#49dae4',
    base: 0.72,
    waves: [
      [0.19, 0.31, 1.8, 1.4],
      [0.06, 0.71, 2.7, 0.5],
    ],
  },
  {
    name: 'Flag',
    color: '#cfe85e',
    base: 0.6,
    waves: [
      [0.2, 0.27, 1.4, 3.1],
      [0.06, 0.9, -2.3, 1],
    ],
  },
]
const STREAM_LO = 0.32
const STREAM_HI = 1.02

function StreamPanel({ engine }: { engine: Engine }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const fit = new FitCanvas(canvasRef.current!)
    let time = 0
    const off = engine.onFrame(({ dt }) => {
      time += dt
      const { ctx, w, h } = fit
      if (w === 0) return
      const yOf = (v: number) =>
        4 + (1 - (v - STREAM_LO) / (STREAM_HI - STREAM_LO)) * (h - 8)
      ctx.clearRect(0, 0, w, h)
      // 게이트 선.
      ctx.setLineDash([3, 3])
      ctx.lineWidth = 1
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'
      ctx.beginPath()
      ctx.moveTo(0, yOf(GATE))
      ctx.lineTo(w, yOf(GATE))
      ctx.stroke()
      ctx.setLineDash([])
      ctx.font = `600 ${Math.max(8, h * 0.085)}px "JetBrains Mono", monospace`
      ctx.fillStyle = 'rgba(255,255,255,0.75)'
      ctx.textAlign = 'right'
      ctx.fillText(GATE.toFixed(2), w - 2, yOf(GATE) - 4)
      // 물결.
      const n = 64
      ctx.lineWidth = 1.5
      for (const s of STREAMS) {
        ctx.strokeStyle = s.color
        ctx.beginPath()
        for (let i = 0; i <= n; i++) {
          let v = s.base
          for (const [a, k, speed, phase] of s.waves)
            v += a * Math.sin(i * k + time * speed + phase)
          const x = (i / n) * w
          if (i === 0) ctx.moveTo(x, yOf(v))
          else ctx.lineTo(x, yOf(v))
        }
        ctx.stroke()
      }
    })
    return () => {
      off()
      fit.dispose()
    }
  }, [engine])
  return (
    <Panel title="CONFIDENCE STREAM" note="SIM" className="pn-stream">
      <canvas className="pn-stream__canvas" ref={canvasRef} />
      <div className="pn-stream__legend">
        {STREAMS.map((s) => (
          <b key={s.name} style={{ color: s.color }}>
            {s.name}
          </b>
        ))}
        <span>under → human</span>
      </div>
    </Panel>
  )
}

// ── 12가지 쓰임 ─────────────────────────────────────────────────────────

/** 도는 케이스는 눌러서 바로 그 케이스로 — 나머지는 아직 경로가 없다. */
function UseCasesPanel({ engine }: { engine: Engine }) {
  const model = useModel()
  const slot = useEngine(engine, (s) => s.slot)
  const cases = model.graph.cases
  const active = cases[slot].id
  return (
    <Panel
      title="12 USE CASES"
      note={`case ${pad2(active)}`}
      className="pn-uses"
    >
      <div className="pn-uses__grid">
        {USE_CASES.map((name, i) => {
          const id = i + 1
          const index = cases.findIndex((c) => c.id === id)
          const dot = cases[index]?.color
          return (
            <button
              key={name}
              type="button"
              disabled={index < 0}
              title={index < 0 ? '아직 경로가 없는 쓰임' : `${name} 케이스로`}
              className={`pn-use${id === active ? ' is-active' : ''}${dot ? ' is-loop' : ''}`}
              onClick={() => engine.jump(index)}
            >
              <b>{pad2(id)}</b>
              <span>{name}</span>
              {id === active ? (
                <LockIcon />
              ) : dot ? (
                <i style={{ background: dot }} />
              ) : null}
            </button>
          )
        })}
      </div>
    </Panel>
  )
}

// ── prompt.md ───────────────────────────────────────────────────────────

/** 초당 줄 수 — 출력 노드가 조립되기 시작하면 그 케이스의 프롬프트를 친다. */
const LPS = 14

const lineClass = (line: string) =>
  line.startsWith('## ')
    ? 'is-h2'
    : line.startsWith('# ')
      ? 'is-h1'
      : line.startsWith('- ')
        ? 'is-li'
        : /^[[{]/.test(line)
          ? 'is-json'
          : undefined

/** 화면에 남겨 둘 줄 수 — 넘치는 위쪽은 잘린다(터미널처럼 위로 밀려 올라간다). */
const PROMPT_ROWS = 16

function PromptPanel({ engine }: { engine: Engine }) {
  const model = useModel()
  const [view, setView] = useState({ slot: -1, lines: 0, chars: 0 })
  useEffect(
    () =>
      engine.onFrame(({ slot, tau }) => {
        const { timeline, prompt: all } = engine.model.cases[slot]
        const start = timeline.assembleStart
        let lines = 0
        let chars = 0
        if (tau >= start) {
          const x = (tau - start) * LPS
          lines = Math.min(all.length, Math.floor(x) + 1)
          chars =
            x >= all.length
              ? all[lines - 1].length
              : Math.floor((x % 1) * (all[lines - 1].length + 1))
        }
        setView((v) =>
          v.slot === slot && v.lines === lines && v.chars === chars
            ? v
            : { slot, lines, chars },
        )
      }),
    [engine],
  )
  // 앞 케이스의 프롬프트 아래에 이번 프롬프트가 이어서 쳐진다.
  const n = model.cases.length
  const rows =
    view.slot < 0
      ? []
      : [
          ...model.cases[(view.slot + n - 1) % n].prompt.map((line, i) => ({
            key: `p${i}`,
            text: line,
            line,
          })),
          { key: 'gap', text: '', line: '' },
          ...model.cases[view.slot].prompt
            .slice(0, view.lines)
            .map((line, i) => ({
              key: `c${i}`,
              line,
              text: i === view.lines - 1 ? line.slice(0, view.chars) : line,
            })),
        ].slice(-PROMPT_ROWS)
  return (
    <Panel title="prompt.md" note={`${LPS} l/s`} className="pn-code">
      <div className="pn-code__lines">
        {rows.map((r, i) => (
          <div key={r.key} className={lineClass(r.line)}>
            {r.text || ' '}
            {i === rows.length - 1 && <i className="pn-code__cursor" />}
          </div>
        ))}
      </div>
    </Panel>
  )
}

// ── 실행 기록 ───────────────────────────────────────────────────────────

const LOG_COLOR: Record<string, string> = {
  in: COLUMNS[0].color,
  ask: '#6d6b7b',
  hid: COLUMNS[2].color,
  gate: COLUMNS[3].color,
  out: COLUMNS[4].color,
}

/** 지금 케이스에서 찍힌 줄 수 — 입력·질문·은닉 결과·게이트·출력 순. */
const logCount = (model: Model, s: Snapshot) => {
  if (s.fading) return 5
  if (s.stepOn >= model.cases[s.slot].timeline.steps.length && s.assembled > 0)
    return 5
  if (s.verdict) return 4
  if (s.confPhase === 'final') return 3
  return Math.min(2, s.stepOn)
}

const LOG_ROWS = 7

function LogPanel({ engine }: { engine: Engine }) {
  const model = useModel()
  const slot = useEngine(engine, (s) => s.slot)
  const count = useEngine(engine, (s) => logCount(engine.model, s))
  const n = model.cases.length
  const before = (k: number) => (slot + n - k) % n
  const rows = [before(2), before(1), slot]
    .flatMap((sl) =>
      model.cases[sl].log
        .slice(0, sl === slot ? count : undefined)
        .map(([src, text], i) => ({
          key: `${sl}:${i}`,
          src,
          text,
          warn: src === 'gate' && model.cases[sl].hold,
        })),
    )
    .slice(-LOG_ROWS)
  return (
    <Panel title="RUN LOG" note="per step" className="pn-log">
      <div className="pn-log__lines">
        {rows.map((r) => (
          <div key={r.key} className={r.warn ? 'is-warn' : undefined}>
            <span style={{ color: LOG_COLOR[r.src] }}>{r.src}</span>
            <p>{r.text}</p>
          </div>
        ))}
      </div>
    </Panel>
  )
}

// ── 역할 분담 ───────────────────────────────────────────────────────────

const SEGMENTS = 20

const Segs = ({
  on,
  color,
  total = SEGMENTS,
}: {
  on: number
  color: string
  total?: number
}) => (
  <div
    className="pn-segs"
    style={{ '--c': color, '--n': total } as CSSProperties}
  >
    {Array.from({ length: total }, (_, i) => (
      <i key={i} className={i < on ? 'is-on' : undefined} />
    ))}
  </div>
)

/** 이 케이스에서 누가 무엇을 했나 — 망(답한 특징 질문 + 인코더 + 게이트)은
 * 공짜로 대부분을 정하고, Claude는 통과한 프롬프트로 한 번, 코드는 입력을
 * 가져와 칸을 조립하고 저장한다. */
function SplitPanel({ engine }: { engine: Engine }) {
  const model = useModel()
  const slot = useEngine(engine, (s) => s.slot)
  const { split, hold, cost } = model.cases[slot]
  return (
    <Panel title="THE SPLIT" note="who does what" className="pn-split">
      <div className="pn-split__row is-strong">
        <span>net decides</span>
        <Segs on={split.net} color="var(--pn-accent)" />
        <b>{split.net} · $0</b>
      </div>
      <div className="pn-split__row">
        <span>Claude writes</span>
        <Segs on={split.claude} color="#8f86ff" />
        <b>
          {hold ? 'hold · $0' : `${split.claude} call · ${fmtUsd(cost.total)}`}
        </b>
      </div>
      <div className="pn-split__row">
        <span>code acts</span>
        <Segs on={split.code} color="#49dae4" />
        <b>{split.code} steps</b>
      </div>
    </Panel>
  )
}

// ── 가드레일 ────────────────────────────────────────────────────────────

/** 이번 달 Claude 지출 한도($) — 목업. */
const SPEND_CAP = 5

function GuardPanel({ engine }: { engine: Engine }) {
  const model = useModel()
  // 이번 바퀴에서 다 만든 프롬프트(보류 빼고)와 그 비용의 합.
  const done = useEngine(engine, (s) => {
    const { cases, graph } = engine.model
    let n = 0
    for (let i = 0; i < s.slot; i++) if (!cases[i].hold) n++
    if (!cases[s.slot].hold && s.assembled >= graph.layers[4].length) n++
    return n
  })
  const slot = useEngine(engine, (s) => s.slot)
  const spend = model.cases
    .slice(0, slot + 1)
    .filter((c) => !c.hold)
    .slice(0, done)
    .reduce((sum, c) => sum + c.cost.total, 0)
  const { version, savedAt } = model.meta
  return (
    <Panel title="GUARDRAILS" note="always on" className="pn-guard">
      <div className="pn-guard__row">
        <span>spend cap</span>
        <div className="pn-guard__track">
          <i style={{ width: `${Math.min(1, spend / SPEND_CAP) * 100}%` }} />
        </div>
        <b>
          {fmtUsd(spend)} / {SPEND_CAP.toFixed(2)}
        </b>
      </div>
      <div className="pn-guard__row">
        <span>prompts</span>
        <Segs on={done} color="var(--pn-accent)" total={10} />
        <b>{done} / 10</b>
      </div>
      <p className="pn-guard__lock">
        <LockIcon />
        never auto-publish ·{' '}
        {savedAt ? `saved v${version} ${fmtTime(savedAt)}` : 'default graph'}
      </p>
    </Panel>
  )
}

export function Panels({
  engine,
  onSelect,
}: {
  engine: Engine
  onSelect: (id: string) => void
}) {
  return (
    <section className="pn-panels">
      <ParallelPanel engine={engine} onSelect={onSelect} />
      <StreamPanel engine={engine} />
      <UseCasesPanel engine={engine} />
      <PromptPanel engine={engine} />
      <LogPanel engine={engine} />
      <SplitPanel engine={engine} />
      <GuardPanel engine={engine} />
    </section>
  )
}

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d={d} fill="currentColor" />
  </svg>
)

const ICON = {
  prev: 'M3 3h2v10H3zM13 3v10L6 8z',
  next: 'M11 3h2v10h-2zM3 3v10l7-5z',
  play: 'M4 2.5v11L13.5 8z',
  pause: 'M3.5 3h3v10h-3zM9.5 3h3v10h-3z',
}

/** 맨 아래 — 재생 조작, 반복 안의 위치를 보여 주는(누르거나 끌면 옮겨 가는)
 * 눈금자, 한 줄 요약. */
export function Footer({
  engine,
  panelsOpen,
  onTogglePanels,
}: {
  engine: Engine
  panelsOpen: boolean
  onTogglePanels: () => void
}) {
  const tickRef = useRef<HTMLElement>(null)
  const playing = useEngine(engine, (s) => s.playing)
  const slot = useEngine(engine, (s) => s.slot)
  useEffect(
    () =>
      engine.onFrame(({ t }) => {
        if (tickRef.current)
          tickRef.current.style.left = `${(t / engine.loopLen) * 100}%`
      }),
    [engine],
  )
  const seekAt = (el: HTMLElement, clientX: number) => {
    const r = el.getBoundingClientRect()
    const k = Math.min(0.999, Math.max(0, (clientX - r.left) / r.width))
    engine.seek(k * engine.loopLen)
  }
  return (
    <footer className="pn-foot">
      <div
        className="pn-foot__scrub"
        title="눌러서 그 시점으로"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          seekAt(e.currentTarget, e.clientX)
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            seekAt(e.currentTarget, e.clientX)
        }}
      >
        <i ref={tickRef} />
      </div>
      <div className="pn-foot__left">
        <div className="pn-ctrl">
          <button
            type="button"
            aria-label="이전 케이스"
            onClick={() => engine.jump(slot - 1)}
          >
            <Icon d={ICON.prev} />
          </button>
          <button
            type="button"
            className="is-main"
            aria-label={playing ? '멈춤' : '재생'}
            onClick={() => engine.toggle()}
          >
            <Icon d={playing ? ICON.pause : ICON.play} />
          </button>
          <button
            type="button"
            aria-label="다음 케이스"
            onClick={() => engine.jump(slot + 1)}
          >
            <Icon d={ICON.next} />
          </button>
        </div>
        <button
          type="button"
          className={`pn-toggle${panelsOpen ? '' : ' is-closed'}`}
          title="아래 패널 숨기기/보기 (P)"
          aria-expanded={panelsOpen}
          onClick={onTogglePanels}
        >
          {panelsOpen ? '패널 숨기기' : '패널 보기'}
        </button>
        <b className="pn-foot__slogan">
          SIGNALS IN · NETWORK DECIDES · PROMPT OUT
        </b>
      </div>
      <span className="pn-foot__hint">
        노드를 눌러 편집 · Space 재생 · ←→ 케이스 · A/F 카메라 · H/P 지표·패널 ·
        목업 데이터
      </span>
    </footer>
  )
}
