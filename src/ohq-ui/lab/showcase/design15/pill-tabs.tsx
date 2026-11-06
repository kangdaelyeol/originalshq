import { useEffect, useLayoutEffect, useRef } from 'react'
import { cx } from '../../../lib/cx'
import { stretchMove, type Span } from './d15-motion'

interface PillTabsProps<T extends string> {
  options: readonly T[]
  value: T
  onChange: (value: T) => void
  /** 둘러보기가 찾는 이름 앞부분(data-tour="team-tab-Design") */
  tourId?: string
  className?: string
  label?: string
}

/** 요소 안 글자 크기(px) — 자리는 em으로 적어서 무대 크기가 바뀌어도 그대로 맞는다 */
const emOf = (el: HTMLElement) => parseFloat(getComputedStyle(el).fontSize) || 16

/**
 * 알약 탭(할 일 거르기·팀 부서·분석 기간) — 고른 칸 뒤 알약이 늘어나며 옮겨 간다
 * (F363~F373: 앞 끝 먼저, 뒤 끝이 0.5F 늦게 — 사이드바 표시 막대와 같은 값).
 */
export function PillTabs<T extends string>({ options, value, onChange, tourId, className, label }: PillTabsProps<T>) {
  const root = useRef<HTMLDivElement>(null)
  const pill = useRef<HTMLSpanElement>(null)
  const span = useRef<Span | null>(null)

  useLayoutEffect(() => {
    const box = root.current
    const el = pill.current
    const tab = box?.querySelector<HTMLElement>(`[data-value="${CSS.escape(value)}"]`)
    if (!box || !el || !tab) return
    const em = emOf(box)
    const next = { start: tab.offsetLeft / em, size: tab.offsetWidth / em }
    if (span.current) stretchMove(el, 'x', span.current, next, 'em')
    else Object.assign(el.style, { left: `${next.start}em`, width: `${next.size}em` })
    span.current = next
  }, [value])

  // 글꼴이 늦게 오면 글자 폭이 바뀐다 — 그때 한 번 다시 맞춘다(움직임 없이)
  useEffect(() => {
    let live = true
    document.fonts?.ready.then(() => {
      const box = root.current
      const el = pill.current
      const tab = box?.querySelector<HTMLElement>('[aria-selected="true"]')
      if (!live || !box || !el || !tab) return
      const em = emOf(box)
      span.current = { start: tab.offsetLeft / em, size: tab.offsetWidth / em }
      Object.assign(el.style, { left: `${span.current.start}em`, width: `${span.current.size}em` })
    })
    return () => {
      live = false
    }
  }, [])

  return (
    <div ref={root} className={cx('d15-tabs', className)} role="tablist" aria-label={label}>
      <span ref={pill} className="d15-tabs__pill" aria-hidden />
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="tab"
          aria-selected={option === value}
          data-value={option}
          data-tour={tourId ? `${tourId}-${option}` : undefined}
          className={cx('d15-tabs__tab', option === value && 'is-active')}
          onClick={() => onChange(option)}
        >
          {option}
        </button>
      ))}
    </div>
  )
}
