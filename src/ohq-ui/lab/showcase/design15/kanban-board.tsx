import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { cx } from '../../../lib/cx'
import { cssVars } from './d15-format'
import { DROP_MS, EASE_OUT_CUBIC, prefersReducedMotion } from './d15-motion'
import { D15_STAGES, type D15Stage, type D15Task } from './design15-data'
import { TaskCard } from './task-card'

interface KanbanBoardProps {
  tasks: readonly D15Task[]
  /** 보이는 카드(거르기) */
  visible?: (task: D15Task) => boolean
  /** 놓은 기둥으로 옮기기 — 맨 위에 넣는다(F282 Done 맨 위) */
  onMove: (id: string, stage: D15Stage) => void
  /** 떠오름 차례 시작 번호(기둥 틀) — 카드는 기둥마다 1.8칸씩 늦게 */
  index?: number
}

interface DragState {
  id: string
  from: D15Stage
  over: D15Stage
  /** 든 카드 높이(px) — 다른 기둥 위에 오면 맨 위에 그만큼 자리가 열린다 */
  height: number
}

interface Session {
  id: string
  from: D15Stage
  over: D15Stage
  sx: number
  sy: number
  offX: number
  offY: number
  width: number
  height: number
  scale: number
  bx: number
  by: number
  x: number
  y: number
  started: boolean
}

type Rects = Map<string, { x: number; y: number }>

/**
 * 칸반(F254~F300) — 카드를 누르고 4px 넘게 움직이면 들어 올린다(1.03배·2°·그림자). 원래 자리엔 흐린 모습이 남고
 * 기둥 숫자는 끄는 동안 바로 바뀐다(F270 To do 3 · In progress 5). 놓으면 그 기둥 맨 위로 들어가고, 카드가 손끝
 * 자리에서 칸으로 0.2초에 내려앉으며(F287~F292) 다른 카드들도 새 자리로 미끄러진다(FLIP). 다른 기둥 위에 있는 동안은
 * 그 기둥 맨 위에 카드 높이만큼 자리가 0.2초에 열린다(F279 Done의 카드들이 미리 내려가 있다).
 * 매 프레임은 떠 있는 층의 transform만 직접 쓴다(React는 기둥이 바뀔 때만 다시 그린다).
 */
export function KanbanBoard({ tasks, visible = () => true, onMove, index = 1 }: KanbanBoardProps) {
  const board = useRef<HTMLDivElement>(null)
  const layer = useRef<HTMLDivElement>(null)
  const session = useRef<Session | null>(null)
  const flip = useRef<{ rects: Rects; id: string; x: number; y: number } | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [dropTick, setDropTick] = useState(0)

  /** 카드 자리(보드 안 좌표, 카메라 배율을 뺀 값) */
  const measure = useCallback((): Rects => {
    const out: Rects = new Map()
    const b = board.current
    if (!b) return out
    const br = b.getBoundingClientRect()
    const scale = br.width / b.offsetWidth || 1
    b.querySelectorAll<HTMLElement>('.d15-board__col [data-task]').forEach((el) => {
      const r = el.getBoundingClientRect()
      out.set(el.dataset.task ?? '', { x: (r.left - br.left) / scale, y: (r.top - br.top) / scale })
    })
    return out
  }, [])

  const columnAt = (clientX: number): D15Stage | null => {
    const cols = board.current?.querySelectorAll<HTMLElement>('[data-stage]')
    if (!cols?.length) return null
    let best: { stage: D15Stage; d: number } | null = null
    cols.forEach((col) => {
      const r = col.getBoundingClientRect()
      const d = clientX < r.left ? r.left - clientX : clientX > r.right ? clientX - r.right : 0
      if (!best || d < best.d) best = { stage: col.dataset.stage as D15Stage, d }
    })
    return (best as { stage: D15Stage } | null)?.stage ?? null
  }

  const place = () => {
    const s = session.current
    if (s && layer.current) layer.current.style.transform = `translate(${s.x}px, ${s.y}px)`
  }

  const onMoveWin = (e: PointerEvent) => {
    const s = session.current
    if (!s) return
    if (!s.started) {
      if (Math.hypot(e.clientX - s.sx, e.clientY - s.sy) < 4) return
      s.started = true
      setDrag({ id: s.id, from: s.from, over: s.from, height: s.height })
    }
    s.x = (e.clientX - s.bx) / s.scale - s.offX
    s.y = (e.clientY - s.by) / s.scale - s.offY
    place()
    const over = columnAt(e.clientX)
    if (over && over !== s.over) {
      s.over = over
      setDrag((d) => (d ? { ...d, over } : d))
    }
  }

  const onUpWin = () => {
    window.removeEventListener('pointermove', onMoveWin)
    window.removeEventListener('pointerup', onUpWin)
    window.removeEventListener('pointercancel', onUpWin)
    const s = session.current
    session.current = null
    if (!s?.started) return
    flip.current = { rects: measure(), id: s.id, x: s.x, y: s.y }
    setDrag(null)
    setDropTick((n) => n + 1)
    if (s.over !== s.from) onMove(s.id, s.over)
  }

  const onCardDown = (task: D15Task) => (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0 || session.current) return
    const b = board.current
    if (!b) return
    e.preventDefault()
    const br = b.getBoundingClientRect()
    const scale = br.width / b.offsetWidth || 1
    const r = e.currentTarget.getBoundingClientRect()
    session.current = {
      id: task.id,
      from: task.stage,
      over: task.stage,
      sx: e.clientX,
      sy: e.clientY,
      offX: (e.clientX - r.left) / scale,
      offY: (e.clientY - r.top) / scale,
      width: r.width / scale,
      height: r.height / scale,
      scale,
      bx: br.left,
      by: br.top,
      x: (r.left - br.left) / scale,
      y: (r.top - br.top) / scale,
      started: false,
    }
    window.addEventListener('pointermove', onMoveWin)
    window.addEventListener('pointerup', onUpWin)
    window.addEventListener('pointercancel', onUpWin)
  }

  // 들어 올린 층이 붙자마자 손끝 자리에 놓는다
  useLayoutEffect(() => {
    if (!drag || !layer.current || !session.current) return
    layer.current.style.width = `${session.current.width}px`
    place()
  }, [drag?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // 놓은 뒤 — 카드들이 옛 자리에서 새 자리로(FLIP), 놓은 카드는 손끝 자리·기운 모습에서 칸으로
  useLayoutEffect(() => {
    const f = flip.current
    if (!f) return
    flip.current = null
    if (prefersReducedMotion()) return
    const after = measure()
    after.forEach((pos, id) => {
      const el = board.current?.querySelector<HTMLElement>(`.d15-board__col [data-task="${id}"]`)
      if (!el) return
      if (id === f.id) {
        el.style.zIndex = '5'
        const a = el.animate(
          [
            {
              transform: `translate(${f.x - pos.x}px, ${f.y - pos.y}px) rotate(2deg) scale(1.03)`,
              boxShadow: '0 1.2em 2.4em -0.6em rgba(16, 24, 40, 0.28)',
            },
            { transform: 'none', boxShadow: '0 0.1em 0.25em rgba(16, 24, 40, 0.05)' },
          ],
          { duration: DROP_MS, easing: EASE_OUT_CUBIC },
        )
        a.onfinish = () => {
          el.style.zIndex = ''
        }
        return
      }
      const old = f.rects.get(id)
      if (!old || (Math.abs(old.x - pos.x) < 0.5 && Math.abs(old.y - pos.y) < 0.5)) return
      el.animate([{ transform: `translate(${old.x - pos.x}px, ${old.y - pos.y}px)` }, { transform: 'none' }], {
        duration: DROP_MS,
        easing: EASE_OUT_CUBIC,
      })
    })
  }, [dropTick, measure])

  // 떨어질 때 창 듣기를 걷는다
  useEffect(
    () => () => {
      session.current = null
    },
    [],
  )

  const dragged = drag ? tasks.find((t) => t.id === drag.id) : undefined

  return (
    <div ref={board} className={cx('d15-board', drag && 'is-dragging')}>
      {D15_STAGES.map((stage, k) => {
        const cards = tasks.filter((t) => t.stage === stage.id && visible(t))
        const count = cards.length - (drag?.from === stage.id ? 1 : 0) + (drag?.over === stage.id ? 1 : 0)
        return (
          <section
            key={stage.id}
            data-stage={stage.id}
            data-tour={`col-${stage.id}`}
            className={cx('d15-board__col d15-rise', drag?.over === stage.id && 'is-over')}
            style={cssVars({ '--i': index })}
          >
            <header className="d15-board__head">
              <i className={cx('d15-board__dot', `is-${stage.id}`)} />
              <h3>{stage.name}</h3>
              <span className="d15-board__count">{Math.max(0, count)}</span>
            </header>
            {/* 기둥 틀은 알약과 같이(F236), 카드는 기둥마다 약 0.09초씩 늦게(F238 To do · F241 · F244 · F246.5) */}
            <div className="d15-board__cards d15-rise" style={cssVars({ '--i': index + 0.9 + k * 1.8 })}>
              {drag && drag.over === stage.id && drag.over !== drag.from && (
                <div className="d15-board__slot" style={{ height: drag.height }} aria-hidden />
              )}
              {cards.map((task) => (
                <TaskCard key={task.id} task={task} ghost={drag?.id === task.id} onPointerDown={onCardDown(task)} />
              ))}
            </div>
          </section>
        )
      })}
      {dragged && (
        <div ref={layer} className="d15-board__float" aria-hidden>
          <TaskCard task={dragged} lifted />
        </div>
      )}
    </div>
  )
}
