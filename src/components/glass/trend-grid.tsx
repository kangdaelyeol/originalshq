import './trend-grid.scss'
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type AnimationEvent,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { TrendDetailBody, type TrendDetailInfo } from './trend-detail'

/** 칸 하나 — 칸 안에 그릴 것(이름·값·작은 추이)과 펼쳤을 때 보여 줄 추이. */
export interface TrendTile {
  key: string
  /** 칸 안의 내용 — 부르는 쪽의 모양 그대로. */
  content: ReactNode
  /** 펼친 추이 — 이름·값 표기와 보기들(일별·주별·월별). */
  detail: TrendDetailInfo
  /** 칸 요소의 클래스·스타일·data 속성(부르는 쪽 CSS가 모양을 정한다). */
  className?: string
  style?: CSSProperties
  data?: Record<`data-${string}`, string>
  /** 칸에 건 애니메이션이 끝날 때(반짝임 등). */
  onAnimationEnd?: (event: AnimationEvent<HTMLDivElement>) => void
}

type Rect = { top: number; left: number; width: number; height: number }
type Phase = 'enter' | 'open' | 'leave'
interface OpenState {
  key: string
  phase: Phase
  rect: Rect
  /** 칸 묶음 상자의 높이(px) — 펼친 내용 높이로 자라고 되돌아간다. */
  height: number
}

const DURATION = 520
// 닫을 때 내용이 먼저 사라지는 시간.
const FADE_OUT = 120

/**
 * 작은 추이가 있는 칸 묶음 — 칸을 누르면(칸 전체가 버튼) 그 칸이 이 묶음(섹션)
 * 크기로 커지며 큰 추이(TrendDetailBody)를 보여 주고, 나머지 칸은 흐려져
 * 사라진다. 묶음 높이도 펼친 내용 높이로 부드럽게 늘고 줄어든다. 닫으면(닫기
 * 버튼·Esc) 내용이 먼저 사라지고 칸이 원래 자리로 줄어들며 나머지 칸이 다시
 * 나타난다.
 *
 * 칸 배치(grid)는 부르는 쪽 클래스(className)가 정한다. 다른 칸은 펼친 동안에도
 * 자리를 지킨 채 투명해져서, 접을 때 누른 칸이 정확히 제자리로 돌아간다.
 */
export const TrendGrid = ({
  tiles,
  className,
  style,
  detailHeight = 560,
}: {
  tiles: readonly TrendTile[]
  className?: string
  style?: CSSProperties
  /** 펼친 추이의 높이(px). */
  detailHeight?: number
}) => {
  const boxRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const tileRefs = useRef(new Map<string, HTMLDivElement>())
  const closeRef = useRef<HTMLButtonElement>(null)
  const timers = useRef<number[]>([])
  const [open, setOpen] = useState<OpenState | null>(null)

  const later = (ms: number, run: () => void) => {
    timers.current.push(window.setTimeout(run, ms))
  }
  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach((timer) => window.clearTimeout(timer))
  }, [])

  /** 누른 칸의 자리, 펼친 자리(묶음의 안쪽 여백 안), 접힌·펼친 묶음 높이. */
  const measure = (key: string) => {
    const box = boxRef.current
    const grid = gridRef.current
    const tile = tileRefs.current.get(key)
    if (!box || !grid || !tile) return null
    const b = box.getBoundingClientRect()
    const t = tile.getBoundingClientRect()
    const cs = getComputedStyle(grid)
    const pad = {
      top: parseFloat(cs.paddingTop) || 0,
      right: parseFloat(cs.paddingRight) || 0,
      bottom: parseFloat(cs.paddingBottom) || 0,
      left: parseFloat(cs.paddingLeft) || 0,
    }
    return {
      tile: {
        top: t.top - b.top,
        left: t.left - b.left,
        width: t.width,
        height: t.height,
      },
      target: {
        top: pad.top,
        left: pad.left,
        width: b.width - pad.left - pad.right,
        height: detailHeight,
      },
      closedHeight: grid.offsetHeight,
      openHeight: detailHeight + pad.top + pad.bottom,
    }
  }

  const reduced = () =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const expand = (key: string) => {
    if (open) return
    const m = measure(key)
    if (!m) return
    if (reduced()) {
      setOpen({ key, phase: 'open', rect: m.target, height: m.openHeight })
      return
    }
    // 누른 칸 자리·지금 높이에서 시작 → 다음 프레임에 펼친 자리·높이로.
    setOpen({ key, phase: 'enter', rect: m.tile, height: m.closedHeight })
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        setOpen(
          (prev) => prev && { ...prev, rect: m.target, height: m.openHeight },
        ),
      ),
    )
    later(DURATION, () => {
      setOpen((prev) => prev && { ...prev, phase: 'open' })
      // 펼친 추이가 화면 밖(위 고정 줄 밑 등)이면 보이게 끌어온다.
      const box = boxRef.current
      if (!box) return
      const r = box.getBoundingClientRect()
      if (r.top < 120 || r.top + m.openHeight > window.innerHeight)
        window.scrollTo({
          top: window.scrollY + r.top - 140,
          behavior: 'smooth',
        })
    })
  }

  const collapse = () => {
    if (!open || open.phase === 'leave') return
    const key = open.key
    const m = measure(key)
    if (!m || reduced()) {
      setOpen(null)
      return
    }
    // 내용이 먼저 사라지고 → 칸이 제자리로 줄고 묶음 높이도 돌아간다.
    setOpen({ ...open, phase: 'leave' })
    later(FADE_OUT, () =>
      setOpen(
        (prev) => prev && { ...prev, rect: m.tile, height: m.closedHeight },
      ),
    )
    later(FADE_OUT + DURATION, () => {
      setOpen(null)
      tileRefs.current.get(key)?.focus({ preventScroll: true })
    })
  }
  const collapseLatest = useRef(collapse)
  useEffect(() => {
    collapseLatest.current = collapse
  })

  // 펼친 동안 — Esc로 닫고, 묶음 폭이 바뀌면(창 크기) 펼친 자리를 다시 맞춘다.
  const openKey = open?.key ?? null
  useLayoutEffect(() => {
    if (openKey === null) return
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') collapseLatest.current()
    }
    document.addEventListener('keydown', onKey)
    const box = boxRef.current
    const observer = new ResizeObserver(() => {
      setOpen((prev) => {
        if (!prev || prev.phase !== 'open') return prev
        const m = measure(prev.key)
        return m ? { ...prev, rect: m.target } : prev
      })
    })
    if (box) observer.observe(box)
    return () => {
      document.removeEventListener('keydown', onKey)
      observer.disconnect()
    }
    // measure는 매 렌더 새로 만들어지지만 ref만 읽는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openKey])

  // 다 펼쳐지면 닫기 버튼으로 초점을 옮긴다(키보드로 바로 닫을 수 있게).
  useEffect(() => {
    if (open?.phase === 'open') closeRef.current?.focus({ preventScroll: true })
  }, [open?.phase])

  const openTile = open ? tiles.find((tile) => tile.key === open.key) : null

  return (
    <div
      ref={boxRef}
      className={`glass_tgrid${open ? ` is-expanded is-${open.phase}` : ''}`}
      style={open ? { height: open.height } : undefined}
    >
      <div ref={gridRef} className={className} style={style}>
        {tiles.map((tile) => (
          <div
            key={tile.key}
            ref={(element) => {
              if (element) tileRefs.current.set(tile.key, element)
              else tileRefs.current.delete(tile.key)
            }}
            role="button"
            tabIndex={open ? -1 : 0}
            aria-expanded={open?.key === tile.key}
            aria-label={`${tile.detail.title} 추이 자세히 보기`}
            className={[
              'glass_tgrid_tile',
              tile.className ?? '',
              open?.key === tile.key ? 'is-source' : '',
            ]
              .join(' ')
              .trim()}
            style={tile.style}
            {...tile.data}
            onAnimationEnd={tile.onAnimationEnd}
            onClick={() => expand(tile.key)}
            onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
              if (event.target !== event.currentTarget) return
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                expand(tile.key)
              }
            }}
          >
            {tile.content}
          </div>
        ))}
      </div>

      {open && openTile && (
        <div
          className="glass_tgrid_expander"
          role="region"
          aria-label={`${openTile.detail.title} 추이`}
          style={{
            top: open.rect.top,
            left: open.rect.left,
            width: open.rect.width,
            height: open.rect.height,
          }}
        >
          {open.phase !== 'enter' && (
            <TrendDetailBody
              info={openTile.detail}
              onClose={collapse}
              closeRef={closeRef}
            />
          )}
        </div>
      )}
    </div>
  )
}
