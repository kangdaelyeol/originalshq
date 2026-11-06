import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { cx } from '../../../lib/cx'
import { D16Tour } from './d16-tour'
import { D16_T } from './d16-motion'
import { DashboardPage } from './dashboard-page'
import {
  D16_BOARD_START,
  D16_BRAND,
  D16_GREETING,
  D16_LANE_TITLE,
  D16_NAV,
  D16_ORDER_BY_ID,
  D16_TODAY,
  D16_USER,
  type OrderStatus,
  type OrdersTab,
  type PageKey,
  type RangeKey,
} from './design16-data'
import { OrbBackdrop } from './orb-backdrop'
import { OrdersPage } from './orders-page'
import { SideNav } from './side-nav'
import { Toast } from './toast'
import { TopBar } from './top-bar'
import { TourCursor } from './tour-cursor'
import { useExitSwap } from './use-exit-swap'

const TAB_LABEL: Record<OrdersTab, string> = { all: 'All orders', board: 'Packing board', returns: 'Returns' }

interface ToastState {
  key: number
  message: string
  undo: { id: string; from: OrderStatus; to: OrderStatus }
}

interface CirrelAppProps {
  /** 둘러보기 — 영상 순서대로 저절로 누르고 끈다 */
  tour?: boolean
  /** 둘러보기가 끝까지 갔다(처음부터 다시 돌리려면 key를 바꾼다) */
  onTourEnd?: () => void
  /** 사람이 직접 눌렀다 — 둘러보기를 멈출 때 */
  onUserInteract?: () => void
  className?: string
}

/**
 * Cirrel 관리 앱(창 650×366 영상 px) — 공 배경 위에 사이드바·위 줄·페이지(대시보드 / Orders).
 * 페이지 넘김: 사이드바 표시가 늘어나며 옮겨 가고, 지금 페이지가 0.1초에 빠진 뒤 새 페이지가 붙는다.
 * 상태(포장 줄·칸반)는 두 페이지가 같이 쓴다 — 대시보드 "Packed"도 칸반 끌어 놓기와 같은 일을 한다.
 */
export function CirrelApp({ tour = false, onTourEnd, onUserInteract, className }: CirrelAppProps) {
  const appRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  const floatRef = useRef<HTMLDivElement>(null)
  const cursorRef = useRef<HTMLDivElement>(null)
  const toastTimer = useRef(0)

  const [page, setPage] = useState<PageKey>('dashboard')
  const [tab, setTab] = useState<OrdersTab>('all')
  const [range, setRange] = useState<RangeKey>('12M')
  const [compare, setCompare] = useState(true)
  const [dark, setDark] = useState(true)
  const [columns, setColumns] = useState<Record<OrderStatus, string[]>>(D16_BOARD_START)
  const [toast, setToast] = useState<ToastState | null>(null)
  const shownPage = useExitSwap(page, mainRef, '.d16-page')

  const toPack = columns['to-pack']

  const move = (id: string, from: OrderStatus, to: OrderStatus) => {
    setColumns((cols) => ({
      ...cols,
      [from]: cols[from].filter((x) => x !== id),
      [to]: [id, ...cols[to].filter((x) => x !== id)],
    }))
    window.clearTimeout(toastTimer.current)
    setToast((t) => ({ key: (t?.key ?? 0) + 1, message: `${id} · ${D16_LANE_TITLE[to]}`, undo: { id, from, to } }))
    toastTimer.current = window.setTimeout(() => setToast(null), (D16_T.toastStay + D16_T.toastRise) * 1000)
  }

  const undo = () => {
    if (!toast) return
    const { id, from, to } = toast.undo
    setColumns((cols) => ({ ...cols, [to]: cols[to].filter((x) => x !== id), [from]: [id, ...cols[from]] }))
    window.clearTimeout(toastTimer.current)
    setToast(null)
  }

  const navigate = (key: string) => {
    if (key === 'dashboard' || key === 'orders') setPage(key)
  }

  // 둘러보기 — 켜지면 앱을 연 순간부터 영상 시간표대로
  const tourEnded = useEffectEvent(() => onTourEnd?.())
  useEffect(() => {
    const app = appRef.current
    const cursor = cursorRef.current
    if (!tour || !app || !cursor) return
    const engine = new D16Tour({ app, cursor }, () => tourEnded())
    engine.start()
    return () => engine.stop()
  }, [tour])

  // 사람이 누르거나 키를 쓰면 알린다(둘러보기가 보낸 사건은 isTrusted가 아니다)
  const interacted = useEffectEvent(() => onUserInteract?.())
  useEffect(() => {
    const app = appRef.current
    if (!app) return
    const onInput = (e: Event) => {
      if (e.isTrusted) interacted()
    }
    app.addEventListener('pointerdown', onInput)
    app.addEventListener('keydown', onInput)
    return () => {
      app.removeEventListener('pointerdown', onInput)
      app.removeEventListener('keydown', onInput)
    }
  }, [])

  // 화면 밖이면 CSS 숨쉬기(점 빛)도 멈춘다
  useEffect(() => {
    const app = appRef.current
    if (!app) return
    const io = new IntersectionObserver(([entry]) => app.classList.toggle('is-offscreen', !entry.isIntersecting))
    io.observe(app)
    return () => {
      io.disconnect()
      window.clearTimeout(toastTimer.current)
    }
  }, [])

  const crumbs = page === 'dashboard' ? ['Dashboard'] : ['Orders', TAB_LABEL[tab]]

  return (
    <div className={cx('d16-app', className)} ref={appRef} lang="en">
      <OrbBackdrop />
      <SideNav
        brand={D16_BRAND}
        user={D16_USER}
        sections={D16_NAV}
        active={page}
        toPack={toPack.length}
        dark={dark}
        onDarkChange={setDark}
        onNavigate={navigate}
        intro
      />
      <main className="d16-main" ref={mainRef}>
        <TopBar greeting={D16_GREETING} date={D16_TODAY} crumbs={crumbs} notifications={3} />
        <div className="d16-page" key={shownPage}>
          {shownPage === 'dashboard' ? (
            <DashboardPage
              toPack={toPack.map((id) => D16_ORDER_BY_ID[id])}
              onPacked={(id) => move(id, 'to-pack', 'packed')}
              onOpenBoard={() => {
                setTab('board')
                setPage('orders')
              }}
              range={range}
              onRangeChange={setRange}
              compare={compare}
              onCompareToggle={() => setCompare((c) => !c)}
            />
          ) : (
            <OrdersPage tab={tab} onTabChange={setTab} columns={columns} onMove={move} floatLayer={floatRef} />
          )}
        </div>
      </main>
      <div className="d16-float" ref={floatRef} />
      {toast && (
        <Toast key={toast.key} className="d16-app__toast" message={toast.message} action="Undo" onAction={undo} />
      )}
      <TourCursor ref={cursorRef} />
    </div>
  )
}
