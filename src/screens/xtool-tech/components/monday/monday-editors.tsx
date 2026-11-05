import { Check, Search, X } from 'lucide-react'
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import type { TechCellValue, TechColumn, TechItemDoc } from '../../data/tech-boards'
import { useMondayUsers, useTechBoard } from '../../data/tech-boards-store'
import { useTechMembers } from '../../data/tech-members'
import { usePhotoOf } from '../../data/tech-profiles'
import { initialState, sameState, type EditState, type LocationState } from '../../data/tech-edit'
import { cx } from '@/ohq-ui/lib/cx'
import { isComposing } from '../../lib/ime'
import { LocationInput } from '../board/editors/location-input'
import { labelColor } from './monday-colors'
import { PersonAvatar } from './monday-cells'
import { DatePicker } from './monday-date-picker'
import { MonPopover } from './monday-popover'
import { previewCell, splitText } from './monday-values'

export interface CellCommit {
  state: EditState
  /** 저장이 끝나기 전 칸에 보여 줄 값 */
  preview: TechCellValue
  /** 연결 칸에서 고른 항목 — 하위 아이템 부품을 고르면 줄 이름·금액을 맞춘다. */
  picked?: TechItemDoc[]
}

interface InlineInputProps {
  initial: string
  label: string
  inputMode?: 'decimal' | 'tel' | 'email'
  /** 치는 대로 모양 맞추기(연락처 하이픈) */
  format?: (value: string) => string
  /** 빈 칸을 열면 미리 적어 둘 글자(연락처 010) — 그대로 닫으면 빈 칸 그대로 */
  prefill?: string
  onCommit: (value: string) => void
  onCancel: () => void
}

/** 칸 안 입력 — 엔터·탭·바깥 누르기로 저장, Esc로 취소. */
export function InlineInput({ initial, label, inputMode, format, prefill, onCommit, onCancel }: InlineInputProps) {
  const prefilled = Boolean(prefill) && !initial
  const [value, setValue] = useState(prefilled && prefill ? prefill : initial)
  // 엔터로 저장한 뒤 blur가 한 번 더 저장하지 않게
  const [done, setDone] = useState(false)
  const finish = (commit: boolean) => {
    if (done) return
    setDone(true)
    // 미리 적은 글자만 남았으면 빈 칸 그대로
    const next = prefilled && value === prefill ? '' : value
    if (commit && next !== initial) onCommit(next)
    else onCancel()
  }
  return (
    <input
      className="mon-input"
      aria-label={label}
      value={value}
      inputMode={inputMode}
      autoFocus
      // 미리 적은 글자는 이어 치게 커서를 끝에, 아니면 전체 선택(바로 덮어쓴다)
      onFocus={(e) => {
        const input = e.currentTarget
        if (prefilled) input.setSelectionRange(input.value.length, input.value.length)
        else input.select()
      }}
      onChange={(e) => setValue(format ? format(e.target.value) : e.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !isComposing(e)) {
          e.preventDefault()
          finish(true)
        } else if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          finish(false)
        }
      }}
    />
  )
}

interface CellEditorProps {
  column: TechColumn
  cell: TechCellValue | undefined
  anchor: HTMLElement
  onCommit: (commit: CellCommit) => void
  onCancel: () => void
  /** 연결 칸에 하나만 잇는다(AS 청구 부품 줄) — 고르면 바로 저장한다. */
  single?: boolean
}

/** 팝오버로 고치는 칸 — 타입마다 Monday처럼 고르는 모양이 다르다. */
export function CellEditor(props: CellEditorProps) {
  switch (props.column.type) {
    case 'status':
      return <StatusEditor {...props} />
    case 'dropdown':
      return <DropdownEditor {...props} />
    case 'people':
      return <PeopleEditor {...props} />
    case 'assignee':
      return <AssigneeEditor {...props} />
    case 'board_relation':
      return props.column.linkedBoardKey ? <RelationEditor {...props} boardKey={props.column.linkedBoardKey} /> : null
    case 'date':
      return <DatePicker {...props} />
    case 'long_text':
    case 'link':
    case 'location':
      return <FormEditor {...props} />
    default:
      return null
  }
}

/** 상태 — 라벨 색 판을 눌러 바로 고른다. */
function StatusEditor({ column, cell, anchor, onCommit, onCancel }: CellEditorProps) {
  const current = cell?.text ?? ''
  const options = [...(column.options ?? []), ...(current && !column.options?.includes(current) ? [current] : [])]
  const pick = (label: string) => {
    if (label === current) onCancel()
    else onCommit({ state: label, preview: previewCell(column, label) })
  }
  return (
    <MonPopover anchor={anchor} width={220} onClose={() => onCancel()}>
      <ul className="mon-status-list" aria-label={column.title}>
        {options.map((label) => (
          <li key={label}>
            <button
              type="button"
              className={cx('mon-status-option', label === current && 'is-current')}
              style={{ '--label': labelColor(label) } as CSSProperties}
              onClick={() => pick(label)}
            >
              {label}
            </button>
          </li>
        ))}
        <li>
          <button type="button" className="mon-status-option mon-status-option--empty" onClick={() => pick('')}>
            비우기
          </button>
        </li>
      </ul>
    </MonPopover>
  )
}

/** 여러 개 고르기(드롭다운·사람·연결) 공통 — 위에 고른 것, 아래에 검색과 목록. 닫을 때 저장. */
function PickList({
  title,
  options,
  selected,
  onChange,
  renderOption,
  searchPlaceholder,
  empty,
}: {
  title: string
  options: { value: string; label: string; sub?: string }[]
  selected: string[]
  onChange: (next: string[]) => void
  renderOption?: (option: { value: string; label: string }) => ReactNode
  searchPlaceholder: string
  empty: string
}) {
  const [query, setQuery] = useState('')
  const needle = query.trim().toLowerCase()
  const byValue = new Map(options.map((o) => [o.value, o]))
  const shown = options.filter((o) => !selected.includes(o.value) && (!needle || `${o.label} ${o.sub ?? ''}`.toLowerCase().includes(needle)))
  return (
    <div className="mon-pick" aria-label={title}>
      {selected.length > 0 && (
        <div className="mon-pick__selected">
          {selected.map((value) => (
            <span key={value} className="mon-pick__token">
              {byValue.get(value)?.label ?? `#${value}`}
              <button type="button" aria-label={`${byValue.get(value)?.label ?? value} 빼기`} onClick={() => onChange(selected.filter((v) => v !== value))}>
                <X size={11} aria-hidden />
              </button>
            </span>
          ))}
        </div>
      )}
      <label className="mon-pick__search">
        <Search size={13} aria-hidden />
        <input value={query} placeholder={searchPlaceholder} aria-label="검색" onChange={(e) => setQuery(e.target.value)} />
      </label>
      <ul className="mon-pick__list">
        {shown.length === 0 && <li className="mon-pick__empty">{empty}</li>}
        {shown.slice(0, 80).map((o) => (
          <li key={o.value}>
            <button type="button" className="mon-pick__option" onClick={() => onChange([...selected, o.value])}>
              {renderOption ? renderOption(o) : o.label}
              {o.sub && <small>{o.sub}</small>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function DropdownEditor({ column, cell, anchor, onCommit, onCancel }: CellEditorProps) {
  const [initial] = useState(() => initialState(column, cell) as string[])
  const [selected, setSelected] = useState(initial)
  const options = [...(column.options ?? []), ...initial.filter((v) => !column.options?.includes(v))].map((label) => ({
    value: label,
    label,
  }))
  return (
    <MonPopover
      anchor={anchor}
      width={260}
      onClose={(commit) =>
        commit && !sameState(initial, selected) ? onCommit({ state: selected, preview: previewCell(column, selected) }) : onCancel()
      }
    >
      <PickList
        title={column.title}
        options={options}
        selected={selected}
        onChange={setSelected}
        searchPlaceholder="라벨 찾기"
        empty="고를 라벨이 없어요"
      />
    </MonPopover>
  )
}

/**
 * Monday 사람 칸(담당자가 아닌 칸 — 담당자는 우리 명단에서 고르는 AssigneeEditor) — Monday 사람 칸은
 * Monday 사용자만 받아서 Monday 사용자 목록에서 고른다. 처음부터 지정돼 있던 사람(목록 밖·비활성)도
 * 이름을 지킨다.
 */
function PeopleEditor({ column, cell, anchor, onCommit, onCancel }: CellEditorProps) {
  const users = useMondayUsers()
  const photoOf = usePhotoOf()
  const [initial] = useState(() => initialState(column, cell) as string[])
  const [selected, setSelected] = useState(initial)
  const options = useMemo(() => {
    const names = (cell?.text ?? '').split(', ')
    // Monday가 지운 계정은 "삭제된 팀원"으로 남는다 — 새로 고를 사람에서는 뺀다.
    const fromUsers = (users ?? []).filter((u) => !/^삭제된 팀원$/.test(u.name)).map((u) => ({ value: u.id, label: u.name }))
    const known = new Set(fromUsers.map((o) => o.value))
    const remembered = initial.map((id, i) => ({ value: id, label: names[i] ?? `#${id}` })).filter((o) => !known.has(o.value))
    return [...remembered, ...fromUsers]
  }, [users, cell, initial])
  const nameOf = (id: string) => options.find((o) => o.value === id)?.label ?? `#${id}`
  return (
    <MonPopover
      anchor={anchor}
      width={260}
      onClose={(commit) =>
        commit && !sameState(initial, selected)
          ? onCommit({ state: selected, preview: previewCell(column, selected, selected.map(nameOf)) })
          : onCancel()
      }
    >
      <PickList
        title={column.title}
        options={options}
        selected={selected}
        onChange={setSelected}
        renderOption={(o) => (
          <>
            <PersonAvatar name={o.label} photo={photoOf(o.label)} />
            {o.label}
          </>
        )}
        searchPlaceholder="이름 찾기"
        empty={users === null ? '사람 목록을 불러오는 중…' : '고를 사람이 없어요'}
      />
    </MonPopover>
  )
}

/**
 * 담당자(엑스툴) — 관리자 화면에 등록한 기술팀원 중에서 고른다(Monday 계정과 상관없다). 값은 이름을
 * ", "로 이은 글자. 명단에 없는 이름(예전 담당자)도 처음 적혀 있던 것은 지킨다.
 */
function AssigneeEditor({ column, cell, anchor, onCommit, onCancel }: CellEditorProps) {
  const members = useTechMembers()
  const photoOf = usePhotoOf()
  const [initial] = useState(() => splitText(cell?.text ?? ''))
  const [selected, setSelected] = useState(initial)
  const options = useMemo(() => {
    const team = (members ?? [])
      .map((m) => m.name.trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'ko'))
    return [...new Set([...initial, ...team])].map((name) => ({ value: name, label: name }))
  }, [members, initial])
  return (
    <MonPopover
      anchor={anchor}
      width={260}
      onClose={(commit) => {
        if (!commit || sameState(initial, selected)) return onCancel()
        const text = selected.join(', ')
        onCommit({ state: text, preview: previewCell(column, text) })
      }}
    >
      <PickList
        title={column.title}
        options={options}
        selected={selected}
        onChange={setSelected}
        renderOption={(o) => (
          <>
            <PersonAvatar name={o.label} photo={photoOf(o.label)} />
            {o.label}
          </>
        )}
        searchPlaceholder="이름 찾기"
        empty={members === null ? '기술팀 명단을 불러오는 중…' : '고를 사람이 없어요'}
      />
    </MonPopover>
  )
}

/** 연결 칸 — 가리키는 보드(우리 캐시)의 항목을 이름으로 찾아 잇는다. */
function RelationEditor({ column, cell, anchor, onCommit, onCancel, single, boardKey }: CellEditorProps & { boardKey: NonNullable<TechColumn['linkedBoardKey']> }) {
  const board = useTechBoard(boardKey)
  const [initial] = useState(() => initialState(column, cell) as string[])
  const [selected, setSelected] = useState(initial)
  const options = useMemo(() => {
    const fallback = (cell?.text ?? '').split(', ')
    // 만드는 중인 항목은 아직 Monday에 없어 이을 수 없다.
    const fromBoard = (board.items ?? [])
      .filter((item) => !item.draft)
      .map((item) => ({ value: item.itemId, label: item.name, sub: item.record.stage ?? undefined }))
    const known = new Set(fromBoard.map((o) => o.value))
    const missing = initial.map((id, i) => ({ value: id, label: fallback[i] ?? `#${id}` })).filter((o) => !known.has(o.value))
    return [...missing, ...fromBoard]
  }, [board.items, cell, initial])
  const nameOf = (id: string) => options.find((o) => o.value === id)?.label ?? `#${id}`
  const save = (ids: string[]) =>
    sameState(initial, ids)
      ? onCancel()
      : onCommit({
          state: ids,
          preview: previewCell(column, ids, ids.map(nameOf)),
          picked: (board.items ?? []).filter((item) => ids.includes(item.itemId)),
        })
  return (
    <MonPopover anchor={anchor} width={300} onClose={(commit) => (commit ? save(selected) : onCancel())}>
      <PickList
        title={column.title}
        options={options}
        selected={selected}
        // 하나만 잇는 칸은 고르면(빼면) 바로 저장하고 닫는다.
        onChange={single ? (next) => save(next.filter((id) => !selected.includes(id))) : setSelected}
        searchPlaceholder="항목 찾기"
        empty={board.items === null ? '불러오는 중…' : '찾는 항목이 없어요'}
      />
    </MonPopover>
  )
}

/** 긴 글·링크·주소 — 작은 입력 판. 바깥을 누르거나 "적용"으로 저장, Esc는 취소. */
function FormEditor({ column, cell, anchor, onCommit, onCancel }: CellEditorProps) {
  const [initial] = useState(() => initialState(column, cell))
  const [value, setValue] = useState<EditState>(initial)
  const finish = (commit: boolean) => {
    // 주소는 좌표가 있어야 저장된다 — 검색해 고르지 않은 채 닫으면 그대로 둔다.
    const location = column.type === 'location' ? (value as LocationState) : null
    const savable = !location || !location.address || (location.lat && location.lng)
    if (commit && savable && !sameState(initial, value)) onCommit({ state: value, preview: previewCell(column, value) })
    else onCancel()
  }
  const width = column.type === 'location' ? 380 : column.type === 'long_text' ? 340 : 300

  return (
    <MonPopover anchor={anchor} width={width} escapeCommits={false} onClose={finish} className="mon-form">
      <p className="mon-form__title">{column.title}</p>
      {column.type === 'long_text' && (
        <textarea
          className="field__input field__textarea"
          rows={6}
          aria-label={column.title}
          value={value as string}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            // ⌘/Ctrl+엔터로 저장(엔터는 줄바꿈)
            if (e.key === 'Enter' && !isComposing(e) && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              finish(true)
            }
          }}
        />
      )}
      {column.type === 'link' && (
        <div className="editor__pair">
          <input
            className="field__input"
            placeholder="https://"
            aria-label={`${column.title} 주소`}
            value={(value as { url: string }).url}
            onChange={(e) => setValue({ ...(value as { url: string; text: string }), url: e.target.value })}
          />
          <input
            className="field__input"
            placeholder="보일 글자(선택)"
            aria-label={`${column.title} 글자`}
            value={(value as { text: string }).text}
            onChange={(e) => setValue({ ...(value as { url: string; text: string }), text: e.target.value })}
          />
        </div>
      )}
      {column.type === 'location' && (
        <LocationInput id={`${column.id}-edit`} value={value as LocationState} onChange={setValue} />
      )}
      <div className="mon-form__actions">
        <button type="button" className="mon-form__cancel" onClick={() => finish(false)}>
          취소
        </button>
        <button type="button" className="mon-form__apply" onClick={() => finish(true)} disabled={sameState(initial, value)}>
          <Check size={13} strokeWidth={2.6} aria-hidden />
          적용
        </button>
      </div>
    </MonPopover>
  )
}
