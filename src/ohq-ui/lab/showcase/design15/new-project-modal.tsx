import { CalendarDays } from 'lucide-react'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { cssVars } from './d15-format'

interface NewProjectModalProps {
  onClose: () => void
  onCreate: (name: string, due: string) => void
  /** 미리 채운 마감일(F45 "10/23/2026") */
  defaultDue?: string
}

/**
 * New project 창(F74: 157×124px, 창 한가운데) — 막(어둡게 0.4·흐림 0.15em)은 한 프레임에 켜진다(F42).
 * 판은 0.16초에 떠오르고 안의 줄은 33ms씩 늦게(F42.5 제목 … F45.5 단추). 닫으면 한 프레임에 사라진다(F87).
 */
export function NewProjectModal({ onClose, onCreate, defaultDue = '10/23/2026' }: NewProjectModalProps) {
  const id = useId()
  const [name, setName] = useState('')
  const [due, setDue] = useState(defaultDue)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    input.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed) onCreate(trimmed, due)
  }

  return (
    <div className="d15-scrim is-modal" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="d15-modal" role="dialog" aria-modal="true" aria-labelledby={`${id}-t`} onSubmit={submit}>
        <h3 id={`${id}-t`} className="d15-modal__title d15-modal__row" style={cssVars({ '--i': 0 })}>
          New project
        </h3>
        <label className="d15-field d15-modal__row" style={cssVars({ '--i': 1 })}>
          <span className="d15-field__label">Project name</span>
          <input
            ref={input}
            className="d15-field__input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Payment Gateway"
            data-tour="project-name"
          />
        </label>
        <label className="d15-field d15-modal__row" style={cssVars({ '--i': 2 })}>
          <span className="d15-field__label">Due date</span>
          <span className="d15-field__wrap">
            <input
              className="d15-field__input"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              inputMode="numeric"
            />
            <CalendarDays className="d15-field__icon" aria-hidden strokeWidth={2} />
          </span>
        </label>
        <div className="d15-modal__actions d15-modal__row" style={cssVars({ '--i': 3 })}>
          <button type="button" className="d15-btn d15-btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="d15-btn d15-btn--solid" data-tour="project-create">
            Add project
          </button>
        </div>
      </form>
    </div>
  )
}
