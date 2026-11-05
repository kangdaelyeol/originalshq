import { Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useMemo } from 'react'
import type { TechColumn } from '@xtool-core/tech-boards'
import type { EditState } from '@xtool-core/tech-edit'
import {
  editableSubColumns,
  newRow,
  priceColumn,
  readonlySubColumns,
  relationColumn,
  type SubRow,
} from '@xtool-core/tech-subitems'
import { cx } from '@/ohq-ui/lib/cx'
import { RelationPicker } from './relation-picker'

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
                  <RelationPicker
                    key={c.id}
                    boardKey={c.linkedBoardKey!}
                    selected={row.values[c.id] as string[]}
                    fallbackText={row.texts?.[c.id] || row.name}
                    disabled={row.removed}
                    compact
                    placeholder="부품 고르기"
                    onChange={(ids, picked) => {
                      const values = { ...row.values, [c.id]: ids }
                      // 금액이 비어 있으면 부품 비용으로 채운다.
                      const cost = picked?.record.cost
                      if (price && !row.values[price.id] && typeof cost === 'number') values[price.id] = String(cost)
                      // 줄 이름은 고른 것의 이름(Monday 하위 아이템 이름)
                      update(row.key, { name: picked?.record.name ?? row.name, values })
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
