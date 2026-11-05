import { Check, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { TechBoardKey, TechItemDoc } from '@xtool-core/tech-boards'
import { useTechBoard } from '@xtool-core/tech-boards-store'
import { stageLabel } from '@xtool-core/tech-stage'
import { cx } from '@/ohq-ui/lib/cx'
import { formatInt } from '@/ohq-ui/lib/format'

export interface PickedItem {
  itemId: string
  record: Record<string, unknown> & { name: string }
}

interface RelationPickerProps {
  /** 연결 칸이 가리키는 우리 보드 */
  boardKey: TechBoardKey
  selected: string[]
  /** 여러 개 이을 수 있는지 — SN의 출장·AS·대여 기록은 여럿, AS 부품은 하나 */
  multiple?: boolean
  /** 캐시에 없는 연결(다른 해 보드 등)의 이름 — Monday 화면 글자("a, b") */
  fallbackText?: string
  disabled?: boolean
  /** 표 안의 작은 칸(하위 줄) */
  compact?: boolean
  placeholder?: string
  onChange: (ids: string[], picked?: PickedItem) => void
}

/** 목록에서 한 줄 설명 — 보드마다 고를 때 알아보기 쉬운 값 */
function describe(boardKey: TechBoardKey, r: Record<string, unknown>): { sub: string; meta?: string } {
  const s = (v: unknown) => (typeof v === 'string' && v ? v : null)
  switch (boardKey) {
    case 'parts':
      return {
        sub: [s(r.sku), s(r.category)].filter(Boolean).join(' · ') || '—',
        meta: `재고 ${r.stock ?? '—'}${typeof r.cost === 'number' ? ` · ${formatInt(r.cost)}원` : ''}`,
      }
    case 'repair':
      return { sub: [s(r.device), stageLabel(s(r.stage))].filter(Boolean).join(' · '), meta: s(r.receivedAt) ?? undefined }
    case 'fieldService':
      return { sub: [s(r.region), stageLabel(s(r.stage))].filter(Boolean).join(' · '), meta: s(r.visitAt) ?? s(r.receivedAt) ?? undefined }
    case 'rentals':
      return { sub: [s(r.serialNumber), s(r.status)].filter(Boolean).join(' · ') || '—' }
    default:
      return { sub: stageLabel(s(r.stage)) }
  }
}

/**
 * 연결 칸 고르기 — 가리키는 보드의 우리 캐시에서 이름·설명으로 찾아 고른다(AS 청구 부품 →
 * 부품 마스터, SN → 출장·AS·대여품 등). 보드 이름이 아닌 Monday id로 잇는다.
 */
export function RelationPicker({
  boardKey,
  selected,
  multiple = false,
  fallbackText = '',
  disabled,
  compact,
  placeholder = '고르기',
  onChange,
}: RelationPickerProps) {
  const board = useTechBoard(boardKey)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    ref.current?.querySelector<HTMLInputElement>('.relation-picker__search input')?.focus()
    ref.current?.querySelector('.relation-picker__list')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  const options = useMemo(
    () =>
      // 만드는 중인 항목(record가 비어 있다)은 아직 이을 수 없다.
      (board.items ?? []).filter((item) => !item.draft).map((item: TechItemDoc) => {
        const record = item.record as unknown as PickedItem['record']
        return { itemId: item.itemId, record, ...describe(boardKey, record) }
      }),
    [board.items, boardKey],
  )
  const byId = new Map(options.map((o) => [o.itemId, o]))
  const fallback = fallbackText.split(', ').filter(Boolean)
  const names = selected.map((id, i) => byId.get(id)?.record.name || fallback[i] || `#${id}`)

  const needle = query.trim().toLowerCase()
  const shown = options
    .filter((o) => !needle || `${o.record.name} ${o.sub} ${o.meta ?? ''}`.toLowerCase().includes(needle))
    .slice(0, 60)

  const pick = (option: (typeof options)[number]) => {
    if (multiple) {
      const next = selected.includes(option.itemId)
        ? selected.filter((id) => id !== option.itemId)
        : [...selected, option.itemId]
      onChange(next, option)
      return
    }
    onChange([option.itemId], option)
    setOpen(false)
    setQuery('')
  }

  return (
    <div
      ref={ref}
      className="relation-picker"
      // 열려 있으면 Esc는 목록만 닫는다 — DrawerShell이 이 표시를 본다.
      data-popover-open={open || undefined}
      onKeyDown={(e) => {
        // 아래 판(편집 판 밑의 상세 판 — 이 목록이 자기 안에 없어 양보하지 않는다)까지 가서 같이 닫히지 않게 막는다.
        if (e.key === 'Escape' && open) {
          e.stopPropagation()
          setOpen(false)
        }
      }}
    >
      <button
        type="button"
        className={cx('field__input', 'relation-picker__trigger', compact && 'subitems__input')}
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={cx('multi-select__value', names.length === 0 && 'is-empty')}>
          {names.length ? names.join(', ') : placeholder}
        </span>
      </button>
      {open && (
        <div className="relation-picker__list">
          <label className="relation-picker__search">
            <Search size={13} aria-hidden />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="이름·설명으로 찾기" aria-label="검색" />
          </label>
          {board.items === null ? (
            <p className="relation-picker__empty">목록을 불러오는 중…</p>
          ) : shown.length === 0 ? (
            <p className="relation-picker__empty">맞는 항목이 없어요.</p>
          ) : (
            <ul>
              {shown.map((o) => {
                const on = selected.includes(o.itemId)
                return (
                  <li key={o.itemId}>
                    <button
                      type="button"
                      className={cx('relation-picker__option', on && 'is-on')}
                      aria-pressed={on}
                      onClick={() => pick(o)}
                    >
                      {multiple && (
                        <span className="multi-select__check" aria-hidden>
                          {on && <Check size={12} strokeWidth={3} />}
                        </span>
                      )}
                      <span className="relation-picker__text">
                        <strong>{o.record.name || '(이름 없음)'}</strong>
                        <span>{o.sub}</span>
                        {o.meta && <small>{o.meta}</small>}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          {multiple && selected.length > 0 && (
            <button type="button" className="multi-select__clear" onClick={() => onChange([])}>
              모두 해제
            </button>
          )}
        </div>
      )}
    </div>
  )
}
