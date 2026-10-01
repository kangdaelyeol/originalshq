import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  type ComponentProps,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

/**
 * Stand-in for the handoff's shadcn/@base-ui dialog: modal behaviour (escape,
 * backdrop click, scroll lock, focus return) plus the `[data-slot]` hooks the
 * landing CSS styles.
 */

type DialogContextValue = {
  open: boolean
  onOpenChange: (open: boolean) => void
  titleId: string
  descriptionId: string
}

const DialogContext = createContext<DialogContextValue | null>(null)

function useDialog() {
  const context = useContext(DialogContext)
  if (!context) throw new Error('Dialog parts must be used within <Dialog>')
  return context
}

function Dialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}) {
  const id = useId()
  const context = useMemo(
    () => ({
      open,
      onOpenChange,
      titleId: `${id}-title`,
      descriptionId: `${id}-description`,
    }),
    [open, onOpenChange, id],
  )

  return (
    <DialogContext.Provider value={context}>{children}</DialogContext.Provider>
  )
}

function DialogContent({
  className,
  children,
  ...props
}: ComponentProps<'div'>) {
  const { open, onOpenChange, titleId, descriptionId } = useDialog()
  const popup = useRef<HTMLDivElement>(null)
  const restoreFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    restoreFocus.current = document.activeElement as HTMLElement | null
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onOpenChange(false)
        return
      }
      if (event.key !== 'Tab' || !popup.current) return
      const focusable = popup.current.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])',
      )
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    popup.current?.querySelector<HTMLElement>('input,button')?.focus()

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflow
      restoreFocus.current?.focus()
    }
  }, [open, onOpenChange])

  if (!open) return null

  return createPortal(
    <div className="parke-page" data-slot="dialog-portal">
      <div data-slot="dialog-overlay" onClick={() => onOpenChange(false)} />
      <div
        ref={popup}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        data-slot="dialog-content"
        className={className}
        {...props}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}

function DialogClose({
  children,
  onClick,
  ...props
}: ComponentProps<'button'>) {
  const { onOpenChange } = useDialog()

  return (
    <button
      type="button"
      data-slot="dialog-close"
      onClick={(event) => {
        onClick?.(event)
        onOpenChange(false)
      }}
      {...props}
    >
      {children}
    </button>
  )
}

function DialogTitle({ children, ...props }: ComponentProps<'h2'>) {
  const { titleId } = useDialog()
  return (
    <h2 id={titleId} data-slot="dialog-title" {...props}>
      {children}
    </h2>
  )
}

function DialogDescription({ children, ...props }: ComponentProps<'p'>) {
  const { descriptionId } = useDialog()
  return (
    <p id={descriptionId} data-slot="dialog-description" {...props}>
      {children}
    </p>
  )
}

export { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle }
