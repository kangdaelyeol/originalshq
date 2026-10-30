import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import {
  boolean,
  oneOf,
  usePersistentState,
} from '@/hooks/use-persistent-state'
import { Engine, useEngine } from './engine'
import { CaseHeader, MetricRow, TopBar } from './hud'
import { Inspector } from './inspector'
import { GraphStore, ModelContext, addNode, useGraphModel } from './model'
import { Network, type CameraMode } from './network'
import { Footer, Panels } from './panels'
import { CASE_LEN } from './timeline'
import './perceptron.scss'

const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700;800&display=swap'

/** 망과 시계 — 망을 고치면 시계가 바로 새 모델을 받는다(React보다 먼저). ?t=12.3
 * 이면 그 시점부터, ?pause 가 있으면 거기 멈춰서(화면 확인용). */
const createRuntime = () => {
  const store = new GraphStore()
  const q = new URLSearchParams(window.location.search)
  const t = Number(q.get('t') ?? 0)
  const engine = new Engine(
    store.get(),
    Number.isFinite(t) ? t : 0,
    q.has('pause'),
  )
  store.subscribe(() => engine.setModel(store.get()))
  return { store, engine }
}

const CAMERA_MODES: readonly CameraMode[] = ['auto', 'free']

/** 입력란에서 치는 키는 단축키로 쓰지 않는다. */
const isField = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))

/** 접히는 구역 — 위 지표 줄·아래 패널. 접으면 그만큼 신경망이 커진다. */
const Fold = ({ open, children }: { open: boolean; children: ReactNode }) => (
  <div className={`pn-fold${open ? '' : ' is-closed'}`} aria-hidden={!open}>
    <div className="pn-fold__inner">{children}</div>
  </div>
)

/**
 * 프롬프트 퍼셉트론 — 입력 신호가 특징·인코더·게이트 층을 지나 마지막 노드
 * 하나에서 AI 프롬프트가 되는 모습을 다층 신경망처럼 보여 준다(목업 데이터).
 * 카드를 누르면 그 노드를 고칠 수 있고, 고친 내용은 프롬프트에 바로 반영된다.
 */
export default function PerceptronScreen() {
  const [{ store, engine }] = useState(createRuntime)
  const model = useGraphModel(store)
  const slot = useEngine(engine, (s) => s.slot)
  // 카메라 — AUTO(빛 점을 따라감) · FREE(직접 옮기고 확대). 다음에 들어와도 그대로.
  const [mode, setMode] = usePersistentState<CameraMode>(
    'pn.camera',
    'auto',
    oneOf(CAMERA_MODES),
  )
  // 위 지표 줄·아래 패널 — 숨겨 두면 다음에 들어와도 숨겨진 채로.
  const [metricsOpen, setMetricsOpen] = usePersistentState(
    'pn.show.metrics',
    true,
    boolean,
  )
  const [panelsOpen, setPanelsOpen] = usePersistentState(
    'pn.show.panels',
    true,
    boolean,
  )
  const toggleMetrics = useCallback(
    () => setMetricsOpen((v) => !v),
    [setMetricsOpen],
  )
  const togglePanels = useCallback(
    () => setPanelsOpen((v) => !v),
    [setPanelsOpen],
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedRef = useRef<string | null>(null)
  // 편집을 열 때 재생 중이었으면, 닫을 때 다시 재생한다.
  const resumeRef = useRef(false)
  const inspectorRef = useRef<HTMLElement>(null)

  const select = useCallback(
    (id: string | null) => {
      const prev = selectedRef.current
      if (id && !prev) {
        resumeRef.current = engine.getSnapshot().playing
        engine.pause()
      }
      if (!id && prev && resumeRef.current) engine.play()
      selectedRef.current = id
      setSelectedId(id)
    },
    [engine],
  )

  const add = (col: number) => {
    let created = ''
    store.update((g) => {
      const [next, id] = addNode(g, col)
      created = id
      return next
    })
    select(created)
  }

  const replay = () => {
    resumeRef.current = false
    select(null)
    engine.seek(engine.frame.slot * CASE_LEN, false)
  }

  useEffect(() => {
    engine.start()
    // 시험용 — 개발자 도구에서 __pn.simulate(10, 12.3)으로 그 장면을 본다.
    Object.assign(window, { __pn: engine, __pnStore: store })
    return () => engine.stop()
  }, [engine, store])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isField(e.target)) {
        if (e.key === 'Escape') (e.target as HTMLElement).blur()
        return
      }
      if (e.key === ' ') {
        // 버튼에 포커스가 있으면 Space는 그 버튼을 누르는 키다.
        if (e.target instanceof HTMLButtonElement) return
        e.preventDefault()
        engine.toggle()
      } else if (e.key === 'ArrowLeft') engine.jump(engine.frame.slot - 1)
      else if (e.key === 'ArrowRight') engine.jump(engine.frame.slot + 1)
      else if (e.key === 'Escape') select(null)
      else if (e.key === 'a' || e.key === 'A') setMode('auto')
      else if (e.key === 'f' || e.key === 'F') setMode('free')
      else if (e.key === 'h' || e.key === 'H') toggleMetrics()
      else if (e.key === 'p' || e.key === 'P') togglePanels()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [engine, select, setMode, toggleMetrics, togglePanels])

  useEffect(() => {
    const previousTitle = document.title
    const previousBackground = document.body.style.backgroundColor
    document.title = 'Prompt Perceptron · CMIP'
    document.body.style.backgroundColor = '#0c0b10'
    // 이 화면에서만 쓰는 고정폭 글꼴.
    if (!document.head.querySelector(`link[href="${FONT_HREF}"]`)) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = FONT_HREF
      document.head.append(link)
    }
    return () => {
      document.title = previousTitle
      document.body.style.backgroundColor = previousBackground
    }
  }, [])

  return (
    <ModelContext.Provider value={model}>
      <div
        className={`pn${metricsOpen ? '' : ' no-metrics'}${panelsOpen ? '' : ' no-panels'}`}
        style={
          {
            '--pn-accent': model.graph.cases[slot].color,
          } as CSSProperties
        }
      >
        <TopBar metricsOpen={metricsOpen} onToggleMetrics={toggleMetrics} />
        <Fold open={metricsOpen}>
          <MetricRow engine={engine} />
        </Fold>
        <CaseHeader engine={engine} />
        <Network
          engine={engine}
          mode={mode}
          onMode={setMode}
          selectedId={selectedId}
          onSelect={select}
          onAdd={add}
          inspectorRef={inspectorRef}
        />
        <Fold open={panelsOpen}>
          <Panels engine={engine} onSelect={select} />
        </Fold>
        <Footer
          engine={engine}
          panelsOpen={panelsOpen}
          onTogglePanels={togglePanels}
        />
        {selectedId && model.nodes.has(selectedId) && (
          <Inspector
            key={selectedId}
            ref={inspectorRef}
            store={store}
            engine={engine}
            id={selectedId}
            onClose={() => select(null)}
            onSelect={select}
            onReplay={replay}
          />
        )}
      </div>
    </ModelContext.Provider>
  )
}
