import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { FitCanvas } from './canvas'
import { COLUMNS, GATE, LOOP, USE_CASES } from './data'
import {
  LOOP_LEN,
  TIMELINES,
  useEngine,
  type Engine,
  type Snapshot,
} from './engine'

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

function ParallelPanel({ engine }: { engine: Engine }) {
  const slot = useEngine(engine, (s) => s.slot)
  const asked = useEngine(engine, (s) => !s.fading && s.stepOn >= 2)
  return (
    <Panel title="PARALLEL FEATURES" note="one input" className="pn-par">
      {LOOP[slot].parallel.map((r) => (
        <div
          key={r.label}
          className={`pn-par__row${asked && r.picked ? ' is-picked' : ''}`}
        >
          <span>{r.label}</span>
          <div
            className="pn-par__track"
            style={
              { '--c': KIND_COLOR[r.label.split(' ')[0]] } as CSSProperties
            }
          >
            <i style={{ width: `${r.value * 100}%` }} />
          </div>
          <em>{r.answer}</em>
        </div>
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

const LOOP_COLOR = new Map(LOOP.map((c) => [c.id, c.color]))

function UseCasesPanel({ engine }: { engine: Engine }) {
  const slot = useEngine(engine, (s) => s.slot)
  const active = LOOP[slot].id
  return (
    <Panel
      title="12 USE CASES"
      note={`case ${pad2(active)}`}
      className="pn-uses"
    >
      <div className="pn-uses__grid">
        {USE_CASES.map((name, i) => {
          const id = i + 1
          const dot = LOOP_COLOR.get(id)
          return (
            <div
              key={name}
              className={`pn-use${id === active ? ' is-active' : ''}${dot ? ' is-loop' : ''}`}
            >
              <b>{pad2(id)}</b>
              <span>{name}</span>
              {id === active ? (
                <LockIcon />
              ) : dot ? (
                <i style={{ background: dot }} />
              ) : null}
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

// ── prompt.md ───────────────────────────────────────────────────────────

/** 초당 줄 수 — 출력 노드가 조립되기 시작하면 그 케이스의 프롬프트를 친다. */
const LPS = 14
const PROMPT_LINES = LOOP.map((c) => c.prompt.split('\n'))

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
  const [view, setView] = useState({ slot: -1, lines: 0, chars: 0 })
  useEffect(
    () =>
      engine.onFrame(({ slot, tau }) => {
        const start = TIMELINES[slot].assembleStart
        const all = PROMPT_LINES[slot]
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
  const rows =
    view.slot < 0
      ? []
      : [
          ...PROMPT_LINES[(view.slot + LOOP.length - 1) % LOOP.length].map(
            (line, i) => ({ key: `p${i}`, text: line, line }),
          ),
          { key: 'gap', text: '', line: '' },
          ...PROMPT_LINES[view.slot].slice(0, view.lines).map((line, i) => ({
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
const logCount = (s: Snapshot) => {
  if (s.fading) return 5
  if (s.stepOn >= TIMELINES[s.slot].steps.length && s.assembled > 0) return 5
  if (s.verdict) return 4
  if (s.confPhase === 'final') return 3
  return Math.min(2, s.stepOn)
}

const LOG_ROWS = 7

function LogPanel({ engine }: { engine: Engine }) {
  const slot = useEngine(engine, (s) => s.slot)
  const count = useEngine(engine, logCount)
  const before = (k: number) => (slot + LOOP.length - k) % LOOP.length
  const rows = [before(2), before(1), slot]
    .flatMap((sl) =>
      LOOP[sl].log
        .slice(0, sl === slot ? count : undefined)
        .map(([src, text], i) => ({
          key: `${sl}:${i}`,
          src,
          text,
          warn: src === 'gate' && LOOP[sl].confidence < GATE,
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

function SplitPanel({ engine }: { engine: Engine }) {
  // Claude는 마지막에 프롬프트 한 장만 — 그 전까지는 망이 다 정한다.
  const written = useEngine(
    engine,
    (s) => s.assembled >= 8 && LOOP[s.slot].confidence >= GATE,
  )
  return (
    <Panel title="THE SPLIT" note="who does what" className="pn-split">
      <div className="pn-split__row">
        <span>Claude writes</span>
        <Segs on={written ? 3 : 0} color="#8f86ff" />
      </div>
      <div className="pn-split__row is-strong">
        <span>net decides</span>
        <Segs on={18} color="var(--pn-accent)" />
      </div>
      <div className="pn-split__row">
        <span>code acts</span>
        <Segs on={13} color="#49dae4" />
      </div>
    </Panel>
  )
}

// ── 가드레일 ────────────────────────────────────────────────────────────

const PROMPT_COST = 0.3
const SPEND_CAP = 5

function GuardPanel({ engine }: { engine: Engine }) {
  // 이번 바퀴에서 다 만든 프롬프트 수(보류는 빼고).
  const done = useEngine(engine, (s) => {
    let n = 0
    for (let i = 0; i < s.slot; i++) if (LOOP[i].confidence >= GATE) n++
    if (LOOP[s.slot].confidence >= GATE && s.assembled >= 8) n++
    return n
  })
  const spend = done * PROMPT_COST
  return (
    <Panel title="GUARDRAILS" note="always on" className="pn-guard">
      <div className="pn-guard__row">
        <span>spend cap</span>
        <div className="pn-guard__track">
          <i style={{ width: `${(spend / SPEND_CAP) * 100}%` }} />
        </div>
        <b>
          ${spend.toFixed(2)} / {SPEND_CAP.toFixed(2)}
        </b>
      </div>
      <div className="pn-guard__row">
        <span>prompts</span>
        <Segs on={done} color="var(--pn-accent)" total={10} />
        <b>{done} / 10</b>
      </div>
      <p className="pn-guard__lock">
        <LockIcon />
        never auto-publish · progress saved
      </p>
    </Panel>
  )
}

export function Panels({ engine }: { engine: Engine }) {
  return (
    <section className="pn-panels">
      <ParallelPanel engine={engine} />
      <StreamPanel engine={engine} />
      <UseCasesPanel engine={engine} />
      <PromptPanel engine={engine} />
      <LogPanel engine={engine} />
      <SplitPanel engine={engine} />
      <GuardPanel engine={engine} />
    </section>
  )
}

/** 맨 아래 — 반복 안의 위치를 보여 주는 눈금자와 한 줄 요약. */
export function Footer({ engine }: { engine: Engine }) {
  const tickRef = useRef<HTMLElement>(null)
  useEffect(
    () =>
      engine.onFrame(({ t }) => {
        if (tickRef.current)
          tickRef.current.style.left = `${(t / LOOP_LEN) * 100}%`
      }),
    [engine],
  )
  return (
    <footer className="pn-foot">
      <div className="pn-foot__scrub">
        <i ref={tickRef} />
      </div>
      <b>SIGNALS IN · NETWORK DECIDES · PROMPT OUT</b>
      <span>metrics illustrative · mock data</span>
    </footer>
  )
}
