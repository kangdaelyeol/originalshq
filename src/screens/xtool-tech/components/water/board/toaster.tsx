import { CircleAlert, CircleCheck, LoaderCircle, X } from 'lucide-react'
import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import {
  dismissToast,
  useToasts,
  type Toast,
} from '@xtool-core/tech-save-queue'
import { cx } from '@/ohq-ui/lib/cx'
import { usePortalRoot } from '@/ohq-ui/lib/portal-root'
import { useReducedMotion } from '@/ohq-ui/water/hooks'
import { WaterToastEngine } from './toast-engine'

const ICON = { pending: LoaderCircle, success: CircleCheck, error: CircleAlert }

interface WaterToasterProps {
  /**
   * 띄울 토스트(물 판만) — 없으면 기존 Toaster와 같은 저장소(data/tech-save-queue)를 읽는다. 디자인 화면
   * 견본은 앱의 기존 Toaster가 같은 저장소를 읽고 있어 두 번 뜨지 않게, 견본만의 목록을 넘기고 inline으로
   * 견본 상자 안에만 그린다(board-section.tsx).
   */
  toasts?: readonly Toast[]
  /** 닫기 — 없으면 저장소의 dismissToast */
  onDismiss?: (id: number) => void
  /** 화면 오른쪽 아래(포털) 대신 부모 상자 안 오른쪽 아래에 그린다 */
  inline?: boolean
}

interface Item {
  toast: Toast
  leaving: boolean
}

/** 목록이 바뀌면 — 새 것은 더하고, 없어진 것은 나가는 중으로 남긴다(사라지는 움직임이 끝나면 뺀다) */
function merge(items: readonly Item[], toasts: readonly Toast[]): Item[] {
  const next = new Map(toasts.map((t) => [t.id, t]))
  const out: Item[] = items.map((it) => {
    const t = next.get(it.toast.id)
    return t ? { toast: t, leaving: false } : { toast: it.toast, leaving: true }
  })
  const known = new Set(items.map((it) => it.toast.id))
  for (const t of toasts)
    if (!known.has(t.id)) out.push({ toast: t, leaving: false })
  return out
}

/**
 * 화면 오른쪽 아래 알림(물) — 백그라운드 저장의 진행·결과. 기존 Toaster와 같은 저장소를 읽는다. 유리 알약이
 * 동그라미에서 extend 스프링으로 뻗어 나오고, 성공하면 아이콘에서 작은 물결이 알약 안으로 퍼진다. 실패는
 * 닫을 때까지 남는다(저장소 규칙 그대로).
 */
export function WaterToaster({
  toasts: given,
  onDismiss = dismissToast,
  inline = false,
}: WaterToasterProps) {
  const store = useToasts()
  const toasts = given ?? store
  const root = usePortalRoot()
  const [items, setItems] = useState<Item[]>(() =>
    toasts.map((toast) => ({ toast, leaving: false })),
  )
  const [seen, setSeen] = useState(toasts)
  if (seen !== toasts) {
    setSeen(toasts)
    setItems((cur) => merge(cur, toasts))
  }
  const remove = (id: number) =>
    setItems((cur) => cur.filter((it) => it.toast.id !== id || !it.leaving))

  const list = (
    <ol
      className={cx('water-toaster', inline && 'water-toaster--inline')}
      aria-live="polite"
    >
      {items.map((it) => (
        <WaterToastItem
          key={it.toast.id}
          toast={it.toast}
          leaving={it.leaving}
          onGone={remove}
          onDismiss={onDismiss}
        />
      ))}
    </ol>
  )
  if (inline) return list
  return root ? createPortal(list, root) : null
}

interface WaterToastItemProps {
  toast: Toast
  leaving: boolean
  onGone: (id: number) => void
  onDismiss: (id: number) => void
}

function WaterToastItem({
  toast,
  leaving,
  onGone,
  onDismiss,
}: WaterToastItemProps) {
  const reduced = useReducedMotion()
  const li = useRef<HTMLLIElement>(null)
  const glass = useRef<HTMLDivElement>(null)
  const icon = useRef<HTMLSpanElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  const fx = useRef<SVGSVGElement>(null)
  const engine = useRef<WaterToastEngine | null>(null)
  const top = useRef<number | null>(null)
  const Icon = ICON[toast.tone]
  const gone = useEffectEvent(() => onGone(toast.id))

  // 붙을 때 엔진 — 나타나기
  useLayoutEffect(() => {
    const el = li.current
    const g = glass.current
    const svg = fx.current
    if (!el || !g || !svg) return
    const content = [icon.current, body.current, close.current].filter(
      (n): n is NonNullable<typeof n> => n !== null,
    )
    const e = new WaterToastEngine(
      { li: el, glass: g, content, fx: svg, icon: icon.current },
      reduced,
    )
    engine.current = e
    e.enter()
    return () => {
      e.destroy()
      engine.current = null
    }
    // reduced는 나타난 순간 값으로
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 위아래 자리가 바뀌면(다른 토스트가 들어오고 나감) 옛 자리에서 옮겨 간다(FLIP)
  useLayoutEffect(() => {
    const el = li.current
    if (!el) return
    const now = el.offsetTop
    if (top.current !== null && top.current !== now)
      engine.current?.moveFrom(top.current - now)
    top.current = now
  })

  useLayoutEffect(() => {
    if (leaving) engine.current?.exit(undefined, () => gone())
  }, [leaving])

  // 성공하면 물결(처음 성공일 때 한 번)
  useEffect(() => {
    if (toast.tone === 'success' && !leaving) engine.current?.splash()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.tone])

  return (
    <li
      ref={li}
      className={cx('water-toast', `water-toast--${toast.tone}`)}
      role={toast.tone === 'error' ? 'alert' : 'status'}
      aria-hidden={leaving || undefined}
      inert={leaving || undefined}
    >
      <div ref={glass} className="water-toast__glass" aria-hidden />
      <svg ref={fx} className="water-toast__fx" aria-hidden focusable="false" />
      <span ref={icon} className="water-toast__icon" aria-hidden>
        <Icon
          size={16}
          className={cx(toast.tone === 'pending' && 'is-spinning')}
        />
      </span>
      <div ref={body} className="water-toast__body">
        <p className="water-toast__title">{toast.title}</p>
        {toast.message && (
          <p className="water-toast__message">{toast.message}</p>
        )}
        {toast.action && (
          <button
            type="button"
            className="water-text-link water-text-link--accent water-toast__action"
            onClick={toast.action.run}
          >
            {toast.action.label}
          </button>
        )}
      </div>
      {toast.tone !== 'pending' ? (
        <button
          ref={close}
          type="button"
          className="water-toast__close"
          aria-label="닫기"
          onClick={() => onDismiss(toast.id)}
        >
          <X size={14} aria-hidden />
        </button>
      ) : (
        <span className="water-toast__close-space" aria-hidden />
      )}
    </li>
  )
}
