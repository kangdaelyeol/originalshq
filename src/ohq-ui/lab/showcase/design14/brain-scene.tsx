import {
  Fragment,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type Ref,
} from 'react'
import { cx } from '../../../lib/cx'
import { BrainEngine, type BrainFocus, type BrainMode } from './brain-engine'
import { BrainHint } from './brain-hint'
import { BrainStatusBar } from './brain-status-bar'
import { CoreNode } from './core-node'
import { DEPARTMENTS, WAITING_COUNT, WALK_ORDER, type BrainStop, type DepartmentId } from './design14-data'
import { HubNode, type NodeState } from './hub-node'
import { SeatNode } from './seat-node'
import { StarField } from './star-field'
import { usePrefersReducedMotion } from './use-reduced-motion'
import { YouNode } from './you-node'

export type { BrainFocus, BrainMode }

/** 밖에서 장면을 움직이는 손잡이 — 음성 모드 대본이 화면을 바꿀 때 쓴다 */
export interface BrainSceneHandle {
  /** 부서·YOU에 초점, 'overview'면 전체 보기 */
  focus: (target: BrainFocus) => void
  /** ← → 와 같다(1 = 오른쪽 다음 부서) */
  walk: (step: 1 | -1) => void
  overview: () => void
  getFocus: () => BrainFocus
}

/**
 * 음성 모드(design14/voice) 끼울 자리 — 장면을 다시 쓰지 않고 붙인다.
 * - headSlot: 부서 초점에서 머리 자리 대신 그린다(VoiceOrb). 주면 그 부서의 머리 점·이름이 숨는다.
 * - aboveHead: 머리 자리에 붙어 그 위로 놓인다(SpeechBubble). 칸의 (0,0)이 머리 자리 가운데.
 * - youSlot: YOU에 초점일 때 YOU 자리에 붙는다(FounderConstellation). 그동안 캔버스의 YOU 주제 점은 숨는다.
 * - overlay: 장면 위 덮개 층의 위 가운데, 가운데가 화면 위에서 2.725em(VoiceModeBar). 위 줄은 statusBar={false}로 숨긴다.
 * - screen: 화면에 붙은 층(지도 위, 막대 아래) — 크기가 장면 전체라 자식이 장면 가운데(= 둥근 테두리 가운데)를
 *   기준으로 자리를 잡는다(VoiceOrb·SpeechBubble). 겹침: 지도 < 붙는 칸 < screen < overlay.
 * - mode='voice': 음성 모드 화면 — 확대·세로가 전체 보기와 같고 방위각만 초점 쪽으로 돈다, 초점 밖 무리는 사라지고
 *   초점 부서의 머리 자리는 숨는다(F480 구슬 아래에 Head of Sales가 없다), 지도는 누를 수 없고 Esc는 onEscape로 간다.
 * headSlot·aboveHead·youSlot 칸은 엔진이 매 프레임 transform으로 옮기고 CSS 변수 --d14-s(원근 × 확대, 0.005 넘게
 * 바뀔 때만)를 준다. youSlot은 transform에 배율 --d14-s / 0.855도 들어 있다 — 음성 화면 정면(확대 0.76 × 원근 1.125)에서 1배.
 * 화면 바꾸기는 ref 손잡이(focus·walk·overview)나 제어 props(focus + onFocusChange).
 */
export interface BrainSceneProps {
  ref?: Ref<BrainSceneHandle>
  /** 지금 초점(제어) — 안 주면 안에서 관리 */
  focus?: BrainFocus
  defaultFocus?: BrainFocus
  onFocusChange?: (focus: BrainFocus) => void
  /** 사용자가 직접 움직였을 때(누르기·키) — 자동 둘러보기를 끄는 데 쓴다 */
  onInteract?: () => void
  headSlot?: ReactNode
  aboveHead?: ReactNode
  youSlot?: ReactNode
  overlay?: ReactNode
  screen?: ReactNode
  /** 지도(기본) 또는 음성 모드 화면 */
  mode?: BrainMode
  /** 초점 부서의 머리 자리를 눌렀을 때(음성 모드로 들어가기 등) — true를 돌려주면 자리 강조를 하지 않는다 */
  onHeadSelect?: (department: DepartmentId) => boolean | void
  /** 음성 모드에서 Esc를 눌렀을 때 */
  onEscape?: () => void
  /** 위 줄(BRAIN · LIVE · 숫자) */
  statusBar?: boolean
  /** 아래 안내 줄 */
  hint?: boolean
  /** 위 줄 오른쪽 AUTO TOUR 알약 */
  autoTour?: boolean
  onAutoTourChange?: (on: boolean) => void
  className?: string
}

/** 회사 두뇌 지도 — 전체 보기(천천히 돈다) ↔ 부서 초점(그 부서가 정면으로 돌아오고 자리 이름이 뜬다). */
export function BrainScene({
  ref,
  focus,
  defaultFocus = 'overview',
  onFocusChange,
  onInteract,
  headSlot,
  aboveHead,
  youSlot,
  overlay,
  screen,
  mode = 'map',
  onHeadSelect,
  onEscape,
  statusBar = true,
  hint = true,
  autoTour,
  onAutoTourChange,
  className,
}: BrainSceneProps) {
  const [inner, setInner] = useState<BrainFocus>(defaultFocus)
  const current = focus ?? inner
  const [selected, setSelected] = useState<string | null>(null)
  const reduced = usePrefersReducedMotion()

  const viewRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const hazeRef = useRef<HTMLDivElement>(null)
  const nodesRef = useRef<HTMLDivElement>(null)
  const headRef = useRef<HTMLDivElement>(null)
  const youRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<BrainEngine | null>(null)
  const currentRef = useRef(current)

  useEffect(() => {
    currentRef.current = current
  }, [current])

  useEffect(() => {
    const root = viewRef.current
    const canvas = canvasRef.current
    const ring = ringRef.current
    const haze = hazeRef.current
    const nodes = nodesRef.current
    if (!root || !canvas || !ring || !haze || !nodes) return
    const engine = new BrainEngine(
      { root, canvas, ring, haze, nodes, headAnchor: headRef.current, youAnchor: youRef.current },
      { reduced },
    )
    engineRef.current = engine
    return () => {
      engine.dispose()
      engineRef.current = null
    }
  }, [reduced])

  useEffect(() => {
    engineRef.current?.setFocus(current)
  }, [current, reduced])

  useEffect(() => {
    engineRef.current?.setMode(mode)
  }, [mode, reduced])

  const hasHeadSlot = !!headSlot
  useEffect(() => {
    engineRef.current?.setHeadHidden(hasHeadSlot)
  }, [hasHeadSlot, reduced])

  // YOU 초점에 youSlot(FounderConstellation)이 있으면 그쪽이 주제를 그린다 — 캔버스 주제 점은 숨긴다
  const hasYouSlot = !!youSlot
  useEffect(() => {
    engineRef.current?.showYouTopics(!(hasYouSlot && current === 'you'))
  }, [hasYouSlot, current, reduced])

  const select = (next: BrainFocus) => {
    if (next === currentRef.current) return
    currentRef.current = next
    setSelected(null)
    if (focus === undefined) setInner(next)
    onFocusChange?.(next)
  }

  const walk = (step: 1 | -1) => {
    const from = currentRef.current
    let next: BrainStop
    if (from === 'overview') next = engineRef.current?.nearestStop() ?? WALK_ORDER[1]
    else {
      const n = WALK_ORDER.length
      next = WALK_ORDER[(WALK_ORDER.indexOf(from) + step + n) % n]
    }
    select(next)
  }

  useImperativeHandle(ref, () => ({
    focus: (target) => select(target),
    walk,
    overview: () => select('overview'),
    getFocus: () => currentRef.current,
  }))

  const interact = () => onInteract?.()

  const voice = mode === 'voice'

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // 음성 모드는 대본이 화면을 정한다 — Esc만 받는다
    if (voice) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onEscape?.()
      }
      return
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      interact()
      walk(e.key === 'ArrowRight' ? 1 : -1)
    } else if (e.key === 'Escape' && currentRef.current !== 'overview') {
      e.preventDefault()
      interact()
      select('overview')
    }
  }

  // 빈 곳을 누르면 전체 보기로(덮개 층 위 부품은 빼고)
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    viewRef.current?.focus({ preventScroll: true })
    if (voice || (e.target as HTMLElement).closest('.d14-overlay > *')) return
    if (currentRef.current === 'overview') return
    interact()
    select('overview')
  }

  const focusDept = current === 'overview' || current === 'you' ? null : current
  const stateOf = (id: BrainStop): NodeState => (current === 'overview' ? 'idle' : current === id ? 'focused' : 'dim')

  return (
    <div className={cx('d14-scene', className)}>
      <div
        ref={viewRef}
        className="d14-view"
        data-focus={current}
        data-mode={mode}
        data-reduced={reduced || undefined}
        tabIndex={0}
        role="group"
        aria-roledescription="brain map"
        aria-label="BRAIN — ← → walk the departments, Esc for the whole brain"
        onKeyDown={onKeyDown}
        onClick={onClick}
      >
        <StarField className="d14-view__stars" density={440} twinkle={!reduced} />
        <div ref={hazeRef} className="d14-view__haze" aria-hidden="true" />
        <div ref={ringRef} className="d14-view__ring" aria-hidden="true" />
        <canvas ref={canvasRef} className="d14-view__canvas" aria-hidden="true" />

        <div ref={nodesRef} className="d14-view__nodes">
          <div className="d14-node" data-d14-node="core">
            <CoreNode
              dim={current !== 'overview'}
              tabIndex={-1}
              onSelect={() => {
                interact()
                select('overview')
              }}
            />
          </div>
          {DEPARTMENTS.map((d) => {
            const state = stateOf(d.id)
            const open = state === 'focused'
            return (
              <Fragment key={d.id}>
                <div className="d14-node" data-d14-node={`hub:${d.id}`}>
                  <HubNode
                    count={d.seats.length + 1}
                    name={d.name}
                    sub={d.sub}
                    state={state}
                    onSelect={() => {
                      interact()
                      select(d.id)
                    }}
                  />
                </div>
                <div
                  className="d14-node"
                  data-d14-node={`seat:${d.id}:0`}
                  data-replaced={(open && (!!headSlot || voice)) || undefined}
                >
                  <SeatNode
                    head
                    name={d.head.name}
                    status="working"
                    labelled={open}
                    dim={state === 'dim'}
                    selected={open && selected === `${d.id}:0`}
                    tabIndex={open ? 0 : -1}
                    onSelect={() => {
                      interact()
                      select(d.id)
                      if (open && onHeadSelect?.(d.id)) return
                      setSelected(`${d.id}:0`)
                    }}
                  />
                </div>
                {d.seats.map((s, i) => (
                  <div key={s.name} className="d14-node" data-d14-node={`seat:${d.id}:${i + 1}`}>
                    <SeatNode
                      name={s.name}
                      status={s.status}
                      progress={s.progress}
                      side={s.at[0] < 0 ? 'left' : 'right'}
                      labelled={open}
                      dim={state === 'dim'}
                      selected={open && selected === `${d.id}:${i + 1}`}
                      tabIndex={open ? 0 : -1}
                      onSelect={() => {
                        interact()
                        select(d.id)
                        setSelected((cur) => (cur === `${d.id}:${i + 1}` && open ? null : `${d.id}:${i + 1}`))
                      }}
                    />
                  </div>
                ))}
              </Fragment>
            )
          })}
          <div className="d14-node" data-d14-node="you">
            <YouNode
              badge={WAITING_COUNT}
              state={stateOf('you')}
              onSelect={() => {
                interact()
                select('you')
              }}
            />
          </div>
        </div>

        <div className="d14-overlay">
          <div
            ref={headRef}
            className="d14-anchor d14-anchor--head"
            data-on={(!!focusDept && !!(headSlot || aboveHead)) || undefined}
          >
            {headSlot && <div className="d14-anchor__head">{headSlot}</div>}
            {aboveHead && <div className="d14-anchor__above">{aboveHead}</div>}
          </div>
          <div
            ref={youRef}
            className="d14-anchor d14-anchor--you"
            data-on={(current === 'you' && !!youSlot) || undefined}
          >
            {youSlot && <div className="d14-anchor__you">{youSlot}</div>}
          </div>
          {screen && <div className="d14-overlay__screen">{screen}</div>}
          {statusBar && <BrainStatusBar autoTour={autoTour} onAutoTourChange={onAutoTourChange} />}
          {overlay && <div className="d14-overlay__top">{overlay}</div>}
          {hint && <BrainHint className="d14-overlay__hint" />}
        </div>
      </div>
    </div>
  )
}
