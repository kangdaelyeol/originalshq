import { Plus, RotateCcw, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { TechColumn, TechItemDoc, PartRecord } from '../../data/tech-boards'
import { useTechBoard } from '../../data/tech-boards-store'
import type { EditState } from '../../data/tech-edit'
import {
  editableSubColumns,
  newRow,
  priceColumn,
  readonlySubColumns,
  relationColumn,
  type SubRow,
} from '../../data/tech-subitems'
import { cx } from '../../lib/cx'
import { formatInt } from '../../lib/format'

interface SubitemsEditorProps {
  label: string
  columns: TechColumn[]
  rows: SubRow[]
  onChange: (rows: SubRow[]) => void
}

/** 칸 너비 — 이름·부품은 넓게, 수량은 좁게. */
const widthOf = (column: TechColumn): string =>
  column.type === 'board_relation'
    ? 'minmax(0, 2fr)'
    : column.type === 'numbers'
      ? /수량/.test(column.title)
        ? '64px'
        : '96px'
      : 'minmax(0, 1.3fr)'

/**
 * 하위 줄 편집(출장 설치 품목·AS 청구 부품) — 줄을 고치고, 더하고, 지운다. 지운 줄은 저장 전까지
 * 흐리게 남아 되돌릴 수 있다. 저장은 항목 저장과 함께 나간다(편집 패널의 저장 버튼).
 */
export function SubitemsEditor({ label, columns, rows, onChange }: SubitemsEditorProps) {
  const editable = useMemo(() => editableSubColumns(columns), [columns])
  const readonly = useMemo(() => readonlySubColumns(columns), [columns])
  const relation = relationColumn(columns)
  const price = priceColumn(columns)
  // 연결 칸(부품명)이 있으면 줄 이름은 고른 부품 이름 — 이름 칸을 따로 두지 않는다.
  const showName = !relation
  const template = [
    ...(showName ? ['minmax(0, 2fr)'] : []),
    ...editable.map(widthOf),
    ...readonly.map(() => 'minmax(0, 1fr)'),
    '32px',
  ].join(' ')

  const update = (key: string, patch: Partial<SubRow>) =>
    onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  const setValue = (row: SubRow, id: string, value: EditState) =>
    update(row.key, { values: { ...row.values, [id]: value } })

  const live = rows.filter((r) => !r.removed).length
  return (
    <section className="subitems">
      <header className="subitems__head">
        <span className="field__label">
          {label} <span className="subitems__count">{live}줄</span>
        </span>
      </header>

      {rows.length > 0 && (
        <div className="subitems__grid" style={{ gridTemplateColumns: template }} role="table" aria-label={label}>
          <div className="subitems__row subitems__row--head" role="row">
            {showName && <span role="columnheader">이름</span>}
            {editable.map((c) => (
              <span key={c.id} role="columnheader">
                {c.title}
              </span>
            ))}
            {readonly.map((c) => (
              <span key={c.id} role="columnheader">
                {c.title}
              </span>
            ))}
            <span aria-hidden />
          </div>
          {rows.map((row) => (
            <div key={row.key} className={cx('subitems__row', row.removed && 'is-removed')} role="row">
              {showName && (
                <input
                  className="field__input subitems__input"
                  placeholder="품목 이름"
                  aria-label="품목 이름"
                  disabled={row.removed}
                  value={row.name}
                  onChange={(e) => update(row.key, { name: e.target.value })}
                />
              )}
              {editable.map((c) =>
                c.type === 'board_relation' ? (
                  <PartPicker
                    key={c.id}
                    selected={(row.values[c.id] as string[])[0] ?? null}
                    fallbackName={row.texts?.[c.id] || row.name}
                    disabled={row.removed}
                    onPick={(part) => {
                      const values = { ...row.values, [c.id]: [part.itemId] }
                      // 금액이 비어 있으면 부품 비용으로 채운다.
                      if (price && !row.values[price.id] && part.cost !== null) values[price.id] = String(part.cost)
                      update(row.key, { name: part.name, values })
                    }}
                  />
                ) : (
                  <input
                    key={c.id}
                    className="field__input subitems__input"
                    inputMode={c.type === 'numbers' ? 'decimal' : undefined}
                    aria-label={c.title}
                    disabled={row.removed}
                    value={row.values[c.id] as string}
                    onChange={(e) => setValue(row, c.id, e.target.value)}
                  />
                ),
              )}
              {readonly.map((c) => (
                <span
                  key={c.id}
                  className="subitems__readonly"
                  title={row.id ? 'Monday에서 계산되는 칸' : '저장하면 Monday가 계산해요'}
                >
                  {(row.id && row.texts?.[c.id]) || '—'}
                </span>
              ))}
              {row.removed ? (
                <button
                  type="button"
                  className="subitems__icon"
                  aria-label="되돌리기"
                  title="되돌리기"
                  onClick={() => update(row.key, { removed: false })}
                >
                  <RotateCcw size={14} aria-hidden />
                </button>
              ) : (
                <button
                  type="button"
                  className="subitems__icon"
                  aria-label="줄 지우기"
                  title="줄 지우기"
                  onClick={() =>
                    row.id ? update(row.key, { removed: true }) : onChange(rows.filter((r) => r.key !== row.key))
                  }
                >
                  <Trash2 size={14} aria-hidden />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <button type="button" className="subitems__add" onClick={() => onChange([...rows, newRow(editable)])}>
        <Plus size={14} aria-hidden />
        {relation ? '부품 추가' : '품목 추가'}
      </button>
    </section>
  )
}

/** 부품 고르기 — 부품 마스터 보드(우리 캐시)에서 이름·영문명·SKU·분류로 찾는다. */
function PartPicker({
  selected,
  fallbackName,
  disabled,
  onPick,
}: {
  selected: string | null
  fallbackName: string
  disabled?: boolean
  onPick: (part: PartRecord & { itemId: string }) => void
}) {
  const parts = useTechBoard('parts')
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    ref.current?.querySelector('input')?.focus()
    ref.current?.querySelector('.part-picker__list')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  const records = useMemo(
    () => (parts.items ?? []).map((item: TechItemDoc) => ({ ...(item.record as PartRecord), itemId: item.itemId })),
    [parts.items],
  )
  const current = records.find((p) => p.itemId === selected)
  const needle = query.trim().toLowerCase()
  const shown = records
    .filter((p) => !needle || [p.name, p.nameEn, p.sku, p.category].join(' ').toLowerCase().includes(needle))
    .slice(0, 60)

  return (
    <div
      ref={ref}
      className="part-picker"
      data-popover-open={open || undefined}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) setOpen(false)
      }}
    >
      <button
        type="button"
        className="field__input subitems__input part-picker__trigger"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={cx('multi-select__value', !current && !selected && 'is-empty')}>
          {current?.name ?? (selected ? fallbackName : '부품 고르기')}
        </span>
      </button>
      {open && (
        <div className="part-picker__list">
          <label className="part-picker__search">
            <Search size={13} aria-hidden />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="부품명·영문명·SKU·분류" aria-label="부품 검색" />
          </label>
          {parts.items === null ? (
            <p className="part-picker__empty">부품 목록을 불러오는 중…</p>
          ) : shown.length === 0 ? (
            <p className="part-picker__empty">맞는 부품이 없어요.</p>
          ) : (
            <ul>
              {shown.map((p) => (
                <li key={p.itemId}>
                  <button
                    type="button"
                    className={cx('part-picker__option', p.itemId === selected && 'is-on')}
                    onClick={() => {
                      onPick(p)
                      setOpen(false)
                      setQuery('')
                    }}
                  >
                    <strong>{p.name}</strong>
                    <span>{[p.sku, p.category].filter(Boolean).join(' · ') || '—'}</span>
                    <small>
                      재고 {p.stock ?? '—'}
                      {p.cost !== null && ` · ${formatInt(p.cost)}원`}
                    </small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
