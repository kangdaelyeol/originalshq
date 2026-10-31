import { FirebaseError } from 'firebase/app'
import { Lock, Save, X } from 'lucide-react'
import { useId, useMemo, useState, type ReactNode } from 'react'
import {
  createTechItem,
  updateTechItem,
  type TechBoardKey,
  type TechBoardMeta,
  type TechColumn,
  type TechEditValue,
  type TechItemDoc,
  type TechMondayUser,
} from '../../data/tech-boards'
import { useMondayUsers } from '../../data/tech-boards-store'
import { emptyState, initialState, sameState, toEditValue, type EditState } from '../../data/tech-edit'
import { cx } from '../../lib/cx'
import { Button } from '../ui/button'
import { DrawerShell } from './drawer-shell'

// 편집 칸에서 아예 안 보이는 타입 — 버튼·item id·하위 아이템 칸 등 값이 아닌 것.
const HIDDEN_TYPES = new Set(['button', 'item_id', 'subtasks', 'last_updated', 'creation_log', 'auto_number'])

interface ItemEditorProps {
  open: boolean
  boardKey: TechBoardKey
  meta: TechBoardMeta
  /** 고칠 항목 — null이면 새로 만들기 */
  item: TechItemDoc | null
  onClose: () => void
}

/** 항목 편집·생성 — 상세 패널 위에 겹쳐 뜬다. 저장하면 함수가 Monday에 쓰고, 화면은 실시간
 * 구독으로 바뀐 값을 받는다. */
export function ItemEditor({ open, boardKey, meta, item, onClose }: ItemEditorProps) {
  return (
    <DrawerShell open={open} onClose={onClose} labelledBy="editor-title" layer="top" contentKey={item?.itemId ?? 'new'}>
      {open && <EditorForm boardKey={boardKey} meta={meta} item={item} onClose={onClose} />}
    </DrawerShell>
  )
}

interface FormState {
  name: string
  groupId: string
  values: Record<string, EditState>
}

function EditorForm({ boardKey, meta, item, onClose }: Omit<ItemEditorProps, 'open'>) {
  const users = useMondayUsers()
  const columns = useMemo(() => meta.columns.filter((c) => c.writable), [meta.columns])
  const lockedTitles = meta.columns.filter((c) => !c.writable && !HIDDEN_TYPES.has(c.type)).map((c) => c.title)
  // 처음 값은 패널을 열 때 한 번만 — 저장 중에 실시간으로 값이 바뀌어도 입력이 흔들리지 않게.
  const [initial] = useState<FormState>(() => ({
    name: item?.name ?? '',
    groupId: item?.groupId ?? meta.groups[0]?.id ?? '',
    values: Object.fromEntries(
      columns.map((c) => [c.id, item ? initialState(c, item.values[c.id]) : emptyState(c)]),
    ),
  }))
  const [form, setForm] = useState<FormState>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const changedColumns = columns.filter((c) => !sameState(form.values[c.id], initial.values[c.id]))
  const nameChanged = form.name.trim() !== initial.name
  const groupChanged = form.groupId !== initial.groupId
  const dirty = !item || nameChanged || groupChanged || changedColumns.length > 0

  const setValue = (id: string, value: EditState) =>
    setForm((f) => ({ ...f, values: { ...f.values, [id]: value } }))

  const save = async () => {
    if (!form.name.trim()) {
      setError('이름을 적어 주세요.')
      return
    }
    setSaving(true)
    setError(null)
    const columnsInput: Record<string, TechEditValue> = Object.fromEntries(
      changedColumns.map((c) => [c.id, toEditValue(c, form.values[c.id])]),
    )
    try {
      if (item) {
        await updateTechItem({
          boardKey,
          itemId: item.itemId,
          ...(nameChanged ? { name: form.name.trim() } : {}),
          ...(groupChanged ? { groupId: form.groupId } : {}),
          columns: columnsInput,
        })
      } else {
        await createTechItem({ boardKey, name: form.name.trim(), groupId: form.groupId || undefined, columns: columnsInput })
      }
      onClose()
    } catch (e) {
      setError(e instanceof FirebaseError || e instanceof Error ? e.message : '저장하지 못했어요.')
      setSaving(false)
    }
  }

  return (
    <>
      <header className="drawer__header">
        <div className="drawer__heading">
          <p className="drawer__eyebrow">{meta.name}</p>
          <h2 id="editor-title" className="drawer__title">
            {item ? '항목 수정' : '새 항목'}
          </h2>
          {item && <p className="editor__sub">{item.name}</p>}
        </div>
        <button type="button" className="icon-button" aria-label="닫기" onClick={onClose}>
          <X size={16} aria-hidden />
        </button>
      </header>

      <form
        className="drawer__body editor"
        inert={saving}
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <Field label="이름" required changed={!!item && nameChanged}>
          {(id) => (
            <input
              id={id}
              className="field__input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          )}
        </Field>
        {meta.groups.length > 0 && (
          <Field label="진행 단계" changed={!!item && groupChanged}>
            {(id) => (
              <select
                id={id}
                className="field__input"
                value={form.groupId}
                onChange={(e) => setForm((f) => ({ ...f, groupId: e.target.value }))}
              >
                {meta.groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}

        {columns.map((column) => (
          <Field key={column.id} label={column.title} changed={changedColumns.includes(column)}>
            {(id) => (
              <ColumnInput
                id={id}
                column={column}
                value={form.values[column.id]}
                onChange={(value) => setValue(column.id, value)}
                users={users}
                currentText={item?.values[column.id]?.text ?? ''}
              />
            )}
          </Field>
        ))}

        {lockedTitles.length > 0 && (
          <p className="editor__locked">
            <Lock size={12} aria-hidden />
            Monday에서만 고칠 수 있는 칸: {lockedTitles.join(', ')}
          </p>
        )}
        {/* 엔터로 저장되게 — 실제 버튼은 아래 고정 줄에 있다. */}
        <button type="submit" hidden />
      </form>

      <footer className="drawer__footer editor__footer">
        {error && (
          <p className="editor__error" role="alert">
            {error}
          </p>
        )}
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          취소
        </Button>
        <Button icon={Save} onClick={() => void save()} disabled={saving || !dirty}>
          {saving ? 'Monday에 저장하는 중…' : item ? '저장' : '만들기'}
        </Button>
      </footer>
    </>
  )
}

function Field({
  label,
  required,
  changed,
  children,
}: {
  label: string
  required?: boolean
  changed?: boolean
  children: (id: string) => ReactNode
}) {
  const id = useId()
  return (
    <div className={cx('field', changed && 'field--changed')}>
      <label className="field__label" htmlFor={id}>
        {label}
        {required && <span className="field__required"> *</span>}
        {changed && <span className="field__badge">바뀜</span>}
      </label>
      {children(id)}
    </div>
  )
}

interface ColumnInputProps {
  id: string
  column: TechColumn
  value: EditState
  onChange: (value: EditState) => void
  users: TechMondayUser[] | null
  /** Monday 화면 글자 — 목록에 없는 사람 이름을 보여 줄 때 */
  currentText: string
}

function ColumnInput({ id, column, value, onChange, users, currentText }: ColumnInputProps) {
  switch (column.type) {
    case 'long_text':
      return (
        <textarea id={id} className="field__input field__textarea" rows={4} value={value as string} onChange={(e) => onChange(e.target.value)} />
      )
    case 'numbers':
      return (
        <input id={id} className="field__input" inputMode="decimal" value={value as string} onChange={(e) => onChange(e.target.value)} />
      )
    case 'status': {
      const options = column.options ?? []
      const current = value as string
      return (
        <select id={id} className="field__input" value={current} onChange={(e) => onChange(e.target.value)}>
          <option value="">(비어 있음)</option>
          {[...options, ...(current && !options.includes(current) ? [current] : [])].map((label) => (
            <option key={label} value={label}>
              {label}
            </option>
          ))}
        </select>
      )
    }
    case 'dropdown': {
      const selected = value as string[]
      const options = [...(column.options ?? []), ...selected.filter((v) => !column.options?.includes(v))]
      return (
        <ChipPicker
          id={id}
          options={options.map((label) => ({ value: label, label }))}
          selected={selected}
          onChange={onChange}
        />
      )
    }
    case 'people': {
      const selected = value as string[]
      const known = new Map((users ?? []).map((u) => [u.id, u.name]))
      // 목록에 없는 사람(비활성 등) — Monday 글자에서 이름을 빌려 온다.
      const fallbackNames = currentText.split(', ')
      const extra = selected
        .filter((uid) => !known.has(uid))
        .map((uid, i) => ({ value: uid, label: fallbackNames[i] ?? `#${uid}` }))
      return (
        <ChipPicker
          id={id}
          options={[...extra, ...(users ?? []).map((u) => ({ value: u.id, label: u.name }))]}
          selected={selected}
          onChange={onChange}
          searchable
          empty={users === null ? '사람 목록을 불러오는 중…' : '고를 수 있는 사람이 없어요'}
        />
      )
    }
    case 'checkbox':
      return (
        <label className="check editor__check">
          <input id={id} type="checkbox" checked={value as boolean} onChange={(e) => onChange(e.target.checked)} />
          {(value as boolean) ? '체크됨' : '체크 안 됨'}
        </label>
      )
    case 'date': {
      const { date, time } = value as { date: string; time: string }
      return (
        <div className="editor__date">
          <input id={id} type="date" className="field__input" value={date} onChange={(e) => onChange({ date: e.target.value, time })} />
          <input
            type="time"
            className="field__input"
            value={time}
            aria-label={`${column.title} 시각(선택)`}
            onChange={(e) => onChange({ date, time: e.target.value })}
            disabled={!date}
          />
          {date && (
            <button type="button" className="text-link" onClick={() => onChange({ date: '', time: '' })}>
              지우기
            </button>
          )}
        </div>
      )
    }
    case 'link': {
      const link = value as { url: string; text: string }
      return (
        <div className="editor__pair">
          <input id={id} className="field__input" placeholder="https://" value={link.url} onChange={(e) => onChange({ ...link, url: e.target.value })} />
          <input className="field__input" placeholder="보일 글자(선택)" aria-label={`${column.title} 글자`} value={link.text} onChange={(e) => onChange({ ...link, text: e.target.value })} />
        </div>
      )
    }
    default:
      return (
        <input
          id={id}
          className="field__input"
          type={column.type === 'email' ? 'email' : column.type === 'phone' ? 'tel' : 'text'}
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
        />
      )
  }
}

interface ChipPickerProps {
  id: string
  options: { value: string; label: string }[]
  selected: string[]
  onChange: (value: string[]) => void
  searchable?: boolean
  empty?: string
}

/** 여러 개 고르기 — 알약을 눌러 켜고 끈다. 사람처럼 많으면 검색 칸이 붙는다. */
function ChipPicker({ id, options, selected, onChange, searchable, empty = '고를 값이 없어요' }: ChipPickerProps) {
  const [query, setQuery] = useState('')
  const needle = query.trim().toLowerCase()
  const shown = options.filter((o) => selected.includes(o.value) || !needle || o.label.toLowerCase().includes(needle))
  const toggle = (value: string) =>
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value])

  return (
    <div className="chip-picker" id={id} role="group">
      {searchable && options.length > 10 && (
        <input
          className="field__input chip-picker__search"
          placeholder="이름 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="검색"
        />
      )}
      {shown.length === 0 ? (
        <p className="chip-picker__empty">{empty}</p>
      ) : (
        <div className="chip-picker__chips">
          {shown.map((o) => {
            const on = selected.includes(o.value)
            return (
              <button
                key={o.value}
                type="button"
                className={cx('chip-toggle', on && 'is-on')}
                aria-pressed={on}
                onClick={() => toggle(o.value)}
              >
                {o.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
