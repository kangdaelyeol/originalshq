import { AlertTriangle, Info } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cx } from '../../lib/cx'
import { usePortalRoot } from '../../lib/portal-root'
import { trapTab } from '../focus'
import { useReducedMotion, useWaterDpx } from '../hooks'
import { WaterButton } from './button'
import { DIALOG_RADIUS, WaterDialogEngine } from './dialog-motion'

interface WaterDialogProps {
  /** 띄울지 */
  open: boolean
  title: string
  /** 무엇이 어떻게 되는지 — 되돌릴 수 없으면 그렇다고 적는다 */
  message?: ReactNode
  /** 확인 단추 글자(예: "지우기") */
  confirmLabel: string
  /** 그만두기 단추 글자 — 기본 "취소" */
  cancelLabel?: string
  /** danger면 확인 단추가 붉다(지우기·삭제) */
  tone?: 'danger' | 'primary'
  onConfirm: () => void
  onCancel: () => void
}

/**
 * 물 확인 대화상자 — ConfirmDialog와 같은 props. 유리 판이 D7 펼침처럼 물방울에서 가로로 뻗고(16% 넘침) 세로로
 * 떨어져 나가듯 펼쳐지며, 닫을 때는 접힘처럼 세로가 모이고 가로가 끌려와 사라진다(dialog-motion.ts). 초점은
 * 판 안에서만 돌고(Tab), Esc·바깥 누르기·취소는 그만두기, 확인 단추에 처음 초점이 간다. usePortalRoot 안에 띄운다.
 */
export function WaterDialog(props: WaterDialogProps) {
  const root = usePortalRoot()
  const [prevOpen, setPrevOpen] = useState(props.open)
  // 닫히는 동안에도 그린다 — 다 접히면(onClosed) 내린다
  const [closing, setClosing] = useState(false)
  if (props.open !== prevOpen) {
    setPrevOpen(props.open)
    setClosing(!props.open)
  }
  if ((!props.open && !closing) || !root) return null
  return createPortal(<DialogLayer {...props} onClosed={() => setClosing(false)} />, root)
}

function DialogLayer({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = '취소',
  tone = 'danger',
  onConfirm,
  onCancel,
  onClosed,
}: WaterDialogProps & { onClosed: () => void }) {
  const reduced = useReducedMotion()
  // 포털은 무대(WaterStage) 밖이라 층 뿌리에서 따로 장치 화소를 맞춘다(유리 테두리 화소 맞춤)
  const layerRef = useWaterDpx<HTMLDivElement>()
  const panelRef = useRef<HTMLElement>(null)
  const glassRef = useRef<HTMLSpanElement>(null)
  const scrimRef = useRef<HTMLSpanElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const engine = useRef<WaterDialogEngine | null>(null)
  const titleId = useId()
  const messageId = useId()
  const latest = useRef({ onCancel, onClosed, reduced })

  useLayoutEffect(() => {
    latest.current = { onCancel, onClosed, reduced }
  })

  // 엔진 — 판 크기를 재 두고, 내용이 바뀌어 판이 커지면 따라 고친다
  useLayoutEffect(() => {
    const panel = panelRef.current
    const glass = glassRef.current
    const scrim = scrimRef.current
    if (!panel || !glass || !scrim) return
    const items = Array.from(panel.querySelectorAll<HTMLElement>('[data-reveal]'))
    const box = () => ({ w: panel.offsetWidth, h: panel.offsetHeight, r: DIALOG_RADIUS })
    const e = new WaterDialogEngine({ glass, scrim, items }, box())
    engine.current = e
    const ro = new ResizeObserver(() => e.resize(box()))
    ro.observe(panel)
    return () => {
      ro.disconnect()
      e.destroy()
      engine.current = null
    }
  }, [])

  // 열고 닫기 — 첫 모양(물방울)은 그리기 전에 놓인다
  useLayoutEffect(() => {
    engine.current?.set(open, { reduced: latest.current.reduced, onClosed: () => latest.current.onClosed() })
  }, [open])

  // 초점 — 열면 확인 단추로, 닫으면 연 자리로 돌려준다. Esc는 잡기 단계에서 멈춰 밑의 모달이 같이 닫히지 않게
  useEffect(() => {
    if (!open) return
    const back = document.activeElement instanceof HTMLElement ? document.activeElement : null
    confirmRef.current?.focus({ preventScroll: true })
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopImmediatePropagation()
      latest.current.onCancel()
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      if (back?.isConnected) back.focus({ preventScroll: true })
    }
  }, [open])

  // 초점 가두기 — 처음·끝에서 Tab이 판 안으로 돈다(water/focus.ts)
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (panelRef.current) trapTab(e, panelRef.current)
  }

  const Icon = tone === 'danger' ? AlertTriangle : Info
  return (
    <div
      ref={layerRef}
      className={cx('water-dialog', !open && 'is-closing')}
      role="presentation"
      onClick={(e) => {
        // 포털이어도 React 이벤트는 부른 쪽으로 올라간다 — 밑의 모달이 닫히지 않게
        e.stopPropagation()
        if (open) onCancel()
      }}
    >
      <span ref={scrimRef} className="water-dialog__scrim" aria-hidden />
      <section
        ref={panelRef}
        className="water-dialog__panel"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={message ? messageId : undefined}
        inert={!open}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <span ref={glassRef} className="water-dialog__glass" aria-hidden />
        <span className={cx('water-dialog__icon', `water-dialog__icon--${tone}`)} data-reveal aria-hidden>
          <Icon className="water-dialog__icon-svg" />
        </span>
        <div className="water-dialog__body" data-reveal>
          <h2 id={titleId} className="water-dialog__title">
            {title}
          </h2>
          {message && (
            <div id={messageId} className="water-dialog__message">
              {message}
            </div>
          )}
        </div>
        <div className="water-dialog__actions" data-reveal>
          <WaterButton variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </WaterButton>
          <WaterButton ref={confirmRef} variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </WaterButton>
        </div>
      </section>
    </div>
  )
}
