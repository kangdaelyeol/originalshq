import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { cx } from '@/ohq-ui/lib/cx'
import { usePortalRoot } from '@/ohq-ui/lib/portal-root'
import { useReducedMotion } from '@/ohq-ui/water/hooks'
import { trapTab } from '@/ohq-ui/water/focus'
import { WaterDrawerEngine } from './drawer-engine'

interface WaterDrawerShellProps {
  open: boolean
  onClose: () => void
  labelledBy: string
  /** top: 다른 패널 위에 겹쳐 뜨는 패널(편집) — Esc가 이 패널만 닫는다. */
  layer?: 'base' | 'top'
  /** 바뀌면 내용을 다시 차례로 보인다(다른 항목을 열 때). */
  contentKey?: string
  /** center: 화면 가운데 뜨는 모달(상세 보기) — 아래에서 떠오른다. 기본은 오른쪽 서랍. */
  placement?: 'side' | 'center'
  children: ReactNode
}

/** 차례로 나타날 내용 — 자식 중 [data-water-reveal] */
const revealNodes = (panel: HTMLElement) =>
  Array.from(panel.querySelectorAll('[data-water-reveal]'))

/**
 * 오른쪽 유리 서랍 껍데기(물, center면 가운데 모달) — 기존 DrawerShell과 같은 props. 화면 루트(usePortalRoot)로 포털해서 띄우고,
 * 들어올 때 D7 move 스프링(3.8% 넘침), 나갈 때 trail(임계 감쇠)로 움직인다(WaterDrawerEngine — rAF가
 * transform·opacity만 쓴다). 막은 서랍이 들어온 만큼 짙어진다.
 *
 * 열면 서랍으로 초점을 옮기고 Tab은 서랍 안에서 돈다. 닫으면 연 단추로 초점을 돌려준다. Esc는 서랍 안의
 * 펼친 목록([data-popover-open])이 있으면 그것만 닫히게 양보하고, 위에 겹친 패널(top)은 먼저 받아 아래 패널까지
 * 닫히지 않게 막는다. 닫히는 동안에는 마지막 내용을 그대로 그린다.
 */
export function WaterDrawerShell({
  open,
  onClose,
  labelledBy,
  layer = 'base',
  contentKey,
  placement = 'side',
  children,
}: WaterDrawerShellProps) {
  const root = usePortalRoot()
  const reduced = useReducedMotion()
  // 그리고 있는지 — 나가는 움직임이 끝날 때까지 남긴다
  const [present, setPresent] = useState(open)
  if (open && !present) setPresent(true)
  // 닫히는 동안 그릴 마지막 내용
  const [kept, setKept] = useState<ReactNode>(children)
  if (open && kept !== children) setKept(children)

  const panel = useRef<HTMLElement>(null)
  const scrim = useRef<HTMLDivElement>(null)
  const engine = useRef<WaterDrawerEngine | null>(null)
  const opener = useRef<HTMLElement | null>(null)
  const lastKey = useRef(contentKey)

  // 그리는 동안 엔진을 붙인다
  useLayoutEffect(() => {
    const p = panel.current
    if (!present || !p) return
    const e = new WaterDrawerEngine(p, scrim.current, reduced, placement === 'center')
    engine.current = e
    return () => {
      e.destroy()
      engine.current = null
    }
    // reduced는 연 순간 값으로
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [present])

  // 열고 닫기 — 초점을 옮기고 돌려준다
  useLayoutEffect(() => {
    const e = engine.current
    const p = panel.current
    if (!e || !p) return
    if (open) {
      // 이번에 연 내용 — 아래 "다른 항목" 효과가 같은 커밋에서 다시 차례를 걸지 않게
      lastKey.current = contentKey
      const active = document.activeElement
      // 마우스로 줄을 눌러 열었으면 초점이 body에 있다 — 그때는 되돌릴 곳이 없다
      if (
        active instanceof HTMLElement &&
        active !== document.body &&
        !p.contains(active)
      )
        opener.current = active
      e.enter(undefined, revealNodes(p))
      p.focus({ preventScroll: true })
    } else {
      const active = document.activeElement
      const back = opener.current
      opener.current = null
      if (
        back?.isConnected &&
        (!active || active === document.body || p.contains(active))
      )
        back.focus({ preventScroll: true })
      e.exit(undefined, () => setPresent(false))
    }
    // contentKey는 열 때 기억만 한다(바뀌는 건 아래 효과가 본다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, present])

  // 열린 채 다른 항목 — 내용을 다시 차례로, 맨 위로
  useLayoutEffect(() => {
    if (lastKey.current === contentKey) return
    lastKey.current = contentKey
    const p = panel.current
    if (!open || !p) return
    for (const body of p.querySelectorAll('.water-drawer__body'))
      body.scrollTop = 0
    engine.current?.refresh(undefined, revealNodes(p))
  }, [contentKey, open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // 패널 안의 펼친 목록(드롭다운)이 있으면 그것만 닫히게 양보한다.
      if (panel.current?.querySelector('[data-popover-open]')) return
      // 위에 겹친 패널은 먼저(capture) 받아서 아래 패널까지 닫히지 않게 막는다.
      if (layer === 'top') e.stopImmediatePropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, layer === 'top')
    return () => window.removeEventListener('keydown', onKey, layer === 'top')
  }, [open, layer, onClose])

  if (!root || !present) return null
  return createPortal(
    <>
      <div
        ref={scrim}
        className={cx(
          'water-drawer-scrim',
          layer === 'top' && 'water-drawer-scrim--top',
        )}
        onClick={open ? onClose : undefined}
        aria-hidden
      />
      <aside
        ref={panel}
        tabIndex={-1}
        className={cx(
          'water-drawer',
          layer === 'top' && 'water-drawer--top',
          placement === 'center' && 'water-drawer--center',
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        inert={!open || undefined}
        onKeyDown={(e) => {
          // 포털로 띄운 펼친 목록의 키는 React 트리를 따라 여기까지 올라온다 — 서랍 DOM 안의 것만 가둔다
          const p = panel.current
          if (p && p.contains(e.target as Node)) trapTab(e, p)
        }}
      >
        {open ? children : kept}
      </aside>
    </>,
    root,
  )
}
