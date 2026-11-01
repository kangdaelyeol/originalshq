import { Check, Lock, MapPin, Save, Search, X } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  searchAddress,
  type AddressResult,
  type TechBoardKey,
  type TechBoardMeta,
  type TechColumn,
  type TechEditValue,
  type TechItemDoc,
  type TechMondayUser,
} from '../../data/tech-boards'
import { useMondayUsers } from '../../data/tech-boards-store'
import { saveInBackground } from '../../data/tech-save-queue'
import { editableSubColumns, initialRows, SUBITEM_LABEL, subitemEdits, type SubRow } from '../../data/tech-subitems'
import {
  emptyState,
  initialState,
  sameState,
  toEditValue,
  type EditState,
  type LocationState,
} from '../../data/tech-edit'
import { cx } from '../../lib/cx'
import { Button } from '../ui/button'
import { DrawerShell } from './drawer-shell'
import { SubitemsEditor } from './subitems-editor'

// 고칠 수 있는 타입 — functions-xtool/src/tech-boards/columns.ts의 WRITABLE_TYPES와 같게.
// 보드 정보의 writable 표시는 동기화 때 정해져서, 타입을 늘린 직후엔 옛값일 수 있다.
const WRITABLE_TYPES = new Set([
  'text',
  'long_text',
  'numbers',
  'status',
  'dropdown',
  'date',
  'people',
  'checkbox',
  'phone',
  'email',
  'link',
  'location',
])
const isWritable = (c: TechColumn) => c.writable || WRITABLE_TYPES.has(c.type)

// 편집 칸에서 아예 안 보이는 타입 — 버튼·item id·하위 아이템 칸 등 값이 아닌 것.
const HIDDEN_TYPES = new Set(['button', 'item_id', 'subtasks', 'last_updated', 'creation_log', 'auto_number'])

/**
 * 편집 칸 배치 — 보드마다 따로 정하지 않고 칸 종류로 정한다(다른 보드에도 같은 규칙).
 *   · 날짜 칸은 처음 나오는 날짜 자리에 모아 Monday 순서대로(접수일 → 방문 일정 → 최신 연락 일자)
 *   · 드롭다운 칸은 둘씩 한 줄(출장 종류 · 출장 지역)
 *   · 나머지는 한 줄에 하나. 따로 그리는 칸(skip — 진행 단계 옆 상태, 이름 밑 비고)은 뺀다.
 */
function layoutRows(columns: TechColumn[], skip: TechColumn[]): TechColumn[][] {
  const rest = columns.filter((c) => !skip.includes(c))
  const dates = rest.filter((c) => c.type === 'date')
  const dropdowns = rest.filter((c) => c.type === 'dropdown')
  const rows: TechColumn[][] = []
  let datesPlaced = false
  let dropdownsPlaced = false
  for (const column of rest) {
    if (column.type === 'date') {
      if (!datesPlaced) rows.push(...dates.map((d) => [d]))
      datesPlaced = true
    } else if (column.type === 'dropdown') {
      if (!dropdownsPlaced) {
        for (let i = 0; i < dropdowns.length; i += 2) rows.push(dropdowns.slice(i, i + 2))
      }
      dropdownsPlaced = true
    } else {
      rows.push([column])
    }
  }
  return rows
}

/** 한국 지금 시각 — 날짜(YYYY-MM-DD)와 시각(HH:MM) */
const koreaNow = () => {
  const iso = new Date(Date.now() + 9 * 3600_000).toISOString()
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) }
}

/** 새로 만들 때의 처음 값 — 접수일(접수일자)은 지금 날짜·시각으로 채워 둔다. */
const newItemState = (column: TechColumn): EditState =>
  column.type === 'date' && /^접수일/.test(column.title.replace(/\s/g, '')) ? koreaNow() : emptyState(column)

interface ItemEditorProps {
  open: boolean
  boardKey: TechBoardKey
  meta: TechBoardMeta
  /** 고칠 항목 — null이면 새로 만들기 */
  item: TechItemDoc | null
  onClose: () => void
}

/** 항목 편집·생성 — 상세 패널 위에 겹쳐 뜬다. 저장을 누르면 바로 닫히고 요청은 뒤에서 간다
 * (tech-save-queue — 진행·실패는 토스트). 바뀐 값은 실시간 구독으로 들어온다. */
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
  const columns = useMemo(() => meta.columns.filter(isWritable), [meta.columns])
  // 하위 줄을 여기서 고치면, 그걸 끌어와 보여 주는 미러 칸("설치 품목")은 잠금 안내에서 뺀다.
  const subLabelForLock = meta.subitems ? SUBITEM_LABEL[boardKey] : undefined
  const lockedTitles = meta.columns
    .filter((c) => !isWritable(c) && !HIDDEN_TYPES.has(c.type))
    .filter((c) => !(c.type === 'mirror' && c.title === subLabelForLock))
    .map((c) => c.title)
  // 처음 값은 패널을 열 때 한 번만 — 저장 중에 실시간으로 값이 바뀌어도 입력이 흔들리지 않게.
  const [initial] = useState<FormState>(() => ({
    name: item?.name ?? '',
    groupId: item?.groupId ?? meta.groups[0]?.id ?? '',
    values: Object.fromEntries(
      columns.map((c) => [c.id, item ? initialState(c, item.values[c.id]) : newItemState(c)]),
    ),
  }))
  const [form, setForm] = useState<FormState>(initial)
  // 하위 줄(출장 설치 품목·AS 청구 부품) — 하위 아이템 보드 정보가 있는 보드만.
  const subLabel = meta.subitems ? SUBITEM_LABEL[boardKey] : undefined
  const subColumns = meta.subitems?.columns ?? []
  const [initialSubRows] = useState<SubRow[]>(() => initialRows(subColumns, item?.subitems ?? []))
  const [subRows, setSubRows] = useState<SubRow[]>(initialSubRows)
  const subEdits = subLabel ? subitemEdits(editableSubColumns(subColumns), initialSubRows, subRows) : null
  const [error, setError] = useState<string | null>(null)

  // 바뀐 칸 — 고칠 때는 처음 값과, 새로 만들 때는 빈 값과 비교한다(미리 채운 접수일도 보내게).
  const changedColumns = columns.filter(
    (c) => !sameState(form.values[c.id], item ? initial.values[c.id] : emptyState(c)),
  )
  const nameChanged = form.name.trim() !== initial.name
  const groupChanged = form.groupId !== initial.groupId
  const dirty = !item || nameChanged || groupChanged || changedColumns.length > 0 || subEdits !== null

  const setValue = (id: string, value: EditState) =>
    setForm((f) => ({ ...f, values: { ...f.values, [id]: value } }))

  // 진행 단계 옆에 둘 상태 칸 — 보드의 첫 상태 칸(출장 "상태", AS "수리 진행 상태" 등).
  const statusColumn = meta.groups.length > 0 ? columns.find((c) => c.type === 'status') : undefined
  // 이름 바로 밑에 둘 메모 칸(출장·AS "비고")
  const noteColumns = columns.filter((c) => c.title.replace(/\s/g, '') === '비고')
  const rows = layoutRows(columns, [...noteColumns, ...(statusColumn ? [statusColumn] : [])])

  const renderColumn = (column: TechColumn) => (
    <Field key={column.id} label={column.title} changed={!!item && changedColumns.includes(column)}>
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
  )

  const save = () => {
    const name = form.name.trim()
    if (!name) {
      setError('이름을 적어 주세요.')
      return
    }
    if (subEdits?.create?.some((row) => !row.name)) {
      setError(`${subLabel}의 새 줄에 이름(부품)을 넣어 주세요.`)
      return
    }
    const columnsInput: Record<string, TechEditValue> = Object.fromEntries(
      changedColumns.map((c) => [c.id, toEditValue(c, form.values[c.id])]),
    )
    if (item) {
      saveInBackground(
        'update',
        {
          boardKey,
          itemId: item.itemId,
          ...(nameChanged ? { name } : {}),
          ...(groupChanged ? { groupId: form.groupId } : {}),
          columns: columnsInput,
          ...(subEdits ? { subitems: subEdits } : {}),
        },
        name,
      )
    } else {
      saveInBackground(
        'create',
        {
          boardKey,
          name,
          groupId: form.groupId || undefined,
          columns: columnsInput,
          ...(subEdits?.create?.length ? { subitems: { create: subEdits.create } } : {}),
        },
        name,
      )
    }
    onClose()
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
        onSubmit={(e) => {
          e.preventDefault()
          save()
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
        {noteColumns.map(renderColumn)}
        {meta.groups.length > 0 && (
          <div className={cx('editor__row', !statusColumn && 'editor__row--single')}>
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
            {statusColumn && renderColumn(statusColumn)}
          </div>
        )}

        {rows.map((row) =>
          row.length > 1 ? (
            <div key={row.map((c) => c.id).join('+')} className="editor__row">
              {row.map(renderColumn)}
            </div>
          ) : (
            renderColumn(row[0])
          ),
        )}

        {subLabel && (
          <SubitemsEditor label={subLabel} columns={subColumns} rows={subRows} onChange={setSubRows} />
        )}

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
        <Button variant="ghost" onClick={onClose}>
          취소
        </Button>
        <Button icon={Save} onClick={save} disabled={!dirty}>
          {item ? '저장' : '만들기'}
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
      return <MultiSelect id={id} options={options} selected={selected} onChange={onChange} />
    }
    case 'people':
      return <PeoplePicker id={id} selected={value as string[]} onChange={onChange} users={users} currentText={currentText} />
    case 'checkbox':
      return (
        <label className="check editor__check">
          <input id={id} type="checkbox" checked={value as boolean} onChange={(e) => onChange(e.target.checked)} />
          {(value as boolean) ? '체크됨' : '체크 안 됨'}
        </label>
      )
    case 'date':
      return <DateTimeInput id={id} title={column.title} value={value as { date: string; time: string }} onChange={onChange} />
    case 'location':
      return <LocationInput id={id} value={value as LocationState} onChange={onChange} />
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

/** 주소 칸 — 검색해서 고르면 좌표까지 들어간다(Monday 주소 칸은 좌표가 있어야 써진다).
 * 상세 주소(동·호수 등)는 고른 주소 뒤에 붙어 "{주소}, {상세주소}"로 저장된다. */
function LocationInput({ id, value, onChange }: { id: string; value: LocationState; onChange: (value: LocationState) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<AddressResult[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasCoords = Boolean(value.lat && value.lng)

  const search = async () => {
    if (query.trim().length < 2) {
      setError('두 글자 이상 적어 주세요.')
      return
    }
    setSearching(true)
    setError(null)
    try {
      setResults(await searchAddress(query))
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/\s*\[\d+\]$/, '') : '주소를 찾지 못했어요.')
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="address-input">
      {value.address ? (
        <p className="address-input__current">
          <MapPin size={14} aria-hidden />
          <span>{value.address}</span>
          {!hasCoords && <small>(좌표 없음 — 다시 검색해 고르면 저장할 수 있어요)</small>}
          <button type="button" className="text-link" onClick={() => onChange({ address: '', detail: '', lat: '', lng: '' })}>
            지우기
          </button>
        </p>
      ) : (
        <p className="address-input__current address-input__current--empty">주소 없음 — 아래에서 검색해 골라 주세요</p>
      )}
      {value.address && (
        <input
          className="field__input"
          placeholder="상세 주소(동·호수, 층 등)"
          aria-label="상세 주소"
          value={value.detail}
          disabled={!hasCoords}
          onChange={(e) => onChange({ ...value, detail: e.target.value })}
        />
      )}
      <div className="address-input__search">
        <input
          id={id}
          className="field__input"
          placeholder={value.address ? '다른 주소로 바꾸기 — 도로명·지번이나 장소 이름' : '도로명·지번 주소나 장소 이름'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            // 편집 폼 전체가 저장되지 않게 — 엔터는 주소 검색.
            if (e.key === 'Enter') {
              e.preventDefault()
              void search()
            }
          }}
        />
        <Button variant="ghost" icon={Search} onClick={() => void search()} disabled={searching}>
          {searching ? '찾는 중…' : '검색'}
        </Button>
      </div>
      {error && <p className="editor__error">{error}</p>}
      {results && (
        <ul className="address-input__results">
          {results.length === 0 && <li className="address-input__none">검색 결과가 없어요.</li>}
          {results.map((r) => (
            <li key={`${r.lat},${r.lng},${r.label}`}>
              <button
                type="button"
                onClick={() => {
                  // 주소를 바꿔도 적어 둔 상세 주소는 남긴다.
                  onChange({ address: r.address, detail: value.detail, lat: r.lat, lng: r.lng })
                  setResults(null)
                  setQuery('')
                }}
              >
                <strong>{r.label}</strong>
                {r.label !== r.address && <span>{r.address}</span>}
                {r.jibun && <small>지번 {r.jibun}</small>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * 날짜·시각 — 달력 하나에서 날짜와 시각을 같이 고른다. "시각 없음"을 체크하면 날짜만 고르는
 * 칸이 되고 Monday에도 날짜만 저장된다. 시각이 없는 기존 값은 체크된 채로 열린다.
 */
function DateTimeInput({
  id,
  title,
  value,
  onChange,
}: {
  id: string
  title: string
  value: { date: string; time: string }
  onChange: (value: { date: string; time: string }) => void
}) {
  const { date, time } = value
  // 날짜만 있는 값이면 "시각 없음"으로 연다. 비어 있으면 시각까지 넣는 쪽이 기본.
  const [noTime, setNoTime] = useState(Boolean(date && !time))

  const toggleNoTime = (checked: boolean) => {
    setNoTime(checked)
    if (checked) onChange({ date, time: '' })
    // 시각을 다시 켜면 지금 시각을 넣어 둔다(시각까지 있어야 칸에 값이 보인다).
    else if (date && !time) onChange({ date, time: koreaNow().time })
  }

  return (
    <div className="dt-field">
      <div className="field__input dt-input">
        {noTime ? (
          <input id={id} type="date" value={date} onChange={(e) => onChange({ date: e.target.value, time: '' })} />
        ) : (
          <input
            id={id}
            type="datetime-local"
            value={date && time ? `${date}T${time}` : ''}
            onChange={(e) => {
              const [d = '', t = ''] = e.target.value.split('T')
              onChange({ date: d, time: t.slice(0, 5) })
            }}
          />
        )}
        {date && (
          <button type="button" className="dt-input__clear" aria-label={`${title} 지우기`} onClick={() => onChange({ date: '', time: '' })}>
            <X size={13} aria-hidden />
          </button>
        )}
      </div>
      <label className="check dt-field__notime">
        <input type="checkbox" checked={noTime} onChange={(e) => toggleNoTime(e.target.checked)} />
        시각 없음
      </label>
    </div>
  )
}

/** 여러 개 고르는 드롭다운 — 겉모습은 다른 선택 칸(select)과 같고, 누르면 체크 목록이 열린다. */
function MultiSelect({
  id,
  options,
  selected,
  onChange,
}: {
  id: string
  options: string[]
  selected: string[]
  onChange: (value: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // 바깥을 누르면 닫는다. 열 때 목록이 패널 아래로 잘리지 않게 보이는 곳까지 내린다.
  useEffect(() => {
    if (!open) return
    ref.current?.querySelector('.multi-select__list')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  const toggle = (option: string) =>
    onChange(selected.includes(option) ? selected.filter((v) => v !== option) : [...selected, option])

  return (
    <div
      ref={ref}
      className="multi-select"
      // 열려 있으면 Esc는 목록만 닫는다(편집 패널은 그대로) — DrawerShell이 이 표시를 본다.
      data-popover-open={open || undefined}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) setOpen(false)
      }}
    >
      <button
        id={id}
        type="button"
        className="field__input multi-select__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={cx('multi-select__value', selected.length === 0 && 'is-empty')}>
          {selected.length ? selected.join(', ') : '선택 안 함'}
        </span>
      </button>
      {open && (
        <ul className="multi-select__list" role="listbox" aria-multiselectable="true">
          {options.map((option) => {
            const on = selected.includes(option)
            return (
              <li key={option}>
                <button
                  type="button"
                  role="option"
                  aria-selected={on}
                  className={cx('multi-select__option', on && 'is-on')}
                  onClick={() => toggle(option)}
                >
                  <span className="multi-select__check" aria-hidden>
                    {on && <Check size={12} strokeWidth={3} />}
                  </span>
                  {option}
                </button>
              </li>
            )
          })}
          {selected.length > 0 && (
            <li>
              <button type="button" className="multi-select__clear" onClick={() => onChange([])}>
                모두 해제
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

/**
 * 담당자 고르기 — Monday 사용자 목록(techMeta/mondayUsers) + 처음 열 때 이미 지정돼 있던 사람.
 * 목록 밖 사람(비활성 등)도 처음 본 것을 기억해 두어, 해제해도 사라지지 않고 다시 켤 수 있다.
 *
 * TODO(예정): 관리자 화면(/admin/xtool)에서 기술팀으로 등록한 구성원은 이 목록에 항상 보이게
 * 한다 — xtoolMembers(이메일)와 Monday 사용자(email)를 이어 붙여 Monday id를 찾는다.
 */
function PeoplePicker({
  id,
  selected,
  onChange,
  users,
  currentText,
}: {
  id: string
  selected: string[]
  onChange: (value: string[]) => void
  users: TechMondayUser[] | null
  currentText: string
}) {
  // 처음 열 때 지정돼 있던 사람 — 이름은 Monday 화면 글자에서 빌려 온다(적힌 순서가 같다).
  const [remembered] = useState(() => {
    const names = currentText.split(', ')
    return selected.map((uid, i) => ({ value: uid, label: names[i] ?? `#${uid}` }))
  })
  const fromUsers = (users ?? []).map((u) => ({ value: u.id, label: u.name }))
  const known = new Set(fromUsers.map((o) => o.value))
  const options = [...remembered.filter((o) => !known.has(o.value)), ...fromUsers]
  return (
    <ChipPicker
      id={id}
      options={options}
      selected={selected}
      onChange={onChange}
      searchable
      empty={users === null ? '사람 목록을 불러오는 중…' : '고를 수 있는 사람이 없어요'}
    />
  )
}
