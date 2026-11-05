import { Lock, Save, X } from 'lucide-react'
import { useId, useMemo, useState, type ReactNode } from 'react'
import type { TechBoardKey, TechBoardMeta, TechColumn, TechItemDoc, TechMondayUser } from '@xtool-core/tech-boards'
import { useMondayUsers } from '@xtool-core/tech-boards-store'
import { createItem, editItem, type CellEdit } from '@xtool-core/tech-outbox'
import { editableSubColumns, initialRows, SUBITEM_LABEL, subitemEdits, type SubRow } from '@xtool-core/tech-subitems'
import {
  columnLabel,
  emptyState,
  formatPhoneTyping,
  initialState,
  isAssigneeColumn,
  isPhoneColumn,
  isPhoneLike,
  isPhonePrefixOnly,
  PHONE_PREFIX,
  isWritable,
  sameState,
  toEditValue,
  withoutLegacyAssignee,
  type EditState,
  type LocationState,
} from '@xtool-core/tech-edit'
import { cx } from '@/ohq-ui/lib/cx'
import { koreaNow } from '@xtool-core/dates'
import { useWaterLayout } from '../../water-layout/load'
import { Button } from '../layout-parts'
import { DrawerShell } from './drawer-shell'
import { AssigneePicker } from './editors/assignee-picker'
import { DateTimeInput } from './editors/date-time-input'
import { LocationInput } from './editors/location-input'
import { MultiSelect } from './editors/multi-select'
import { PeoplePicker } from './editors/people-picker'
import { FileField } from './item-files'
import { RelationPicker } from './relation-picker'
import { SubitemsEditor } from './subitems-editor'

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
  // 설정 > 레이아웃 "물"이면 물 서랍(같은 props) — 편집 칸도 물 부품으로 바꿔 끼운다(ColumnInput)
  const Shell = useWaterLayout()?.WaterDrawerShell ?? DrawerShell
  return (
    <Shell open={open} onClose={onClose} labelledBy="editor-title" layer="top" contentKey={item?.itemId ?? 'new'}>
      {open && <EditorForm boardKey={boardKey} meta={meta} item={item} onClose={onClose} />}
    </Shell>
  )
}

interface FormState {
  name: string
  groupId: string
  values: Record<string, EditState>
}

function EditorForm({ boardKey, meta, item, onClose }: Omit<ItemEditorProps, 'open'>) {
  const users = useMondayUsers()
  // 담당자(엑스툴) 칸이 있으면 원래 Monday 사람 칸("담당자")은 뺀다.
  const columns = useMemo(() => withoutLegacyAssignee(meta.columns.filter(isWritable)), [meta.columns])
  // 하위 줄을 여기서 고치면, 그걸 끌어와 보여 주는 미러 칸("설치 품목")은 잠금 안내에서 뺀다.
  const subLabelForLock = meta.subitems ? SUBITEM_LABEL[boardKey] : undefined
  const lockedTitles = meta.columns
    .filter((c) => !isWritable(c) && !HIDDEN_TYPES.has(c.type))
    .filter((c) => !(c.type === 'mirror' && c.title === subLabelForLock))
    // 파일 칸은 아래 "파일 올리기"로 따로 다룬다.
    .filter((c) => c.type !== 'file')
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
    <Field key={column.id} label={columnLabel(column)} changed={!!item && changedColumns.includes(column)}>
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
    const columnsInput: Record<string, CellEdit> = Object.fromEntries(
      changedColumns.map((c) => [c.id, { value: toEditValue(c, form.values[c.id]) }]),
    )
    // 저장 대기열 — 패널은 바로 닫고 Monday에는 뒤에서 쓴다(실패만 토스트).
    if (item) {
      editItem(
        boardKey,
        item.itemId,
        {
          ...(nameChanged ? { name } : {}),
          ...(groupChanged ? { groupId: form.groupId } : {}),
          columns: columnsInput,
          ...(subEdits ? { subitems: subEdits } : {}),
        },
        name,
      )
    } else {
      createItem(boardKey, {
        name,
        groupId: form.groupId || undefined,
        columns: columnsInput,
        ...(subEdits?.create?.length ? { subitems: { create: subEdits.create } } : {}),
      })
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

        {/* 파일 칸 — 저장 버튼과 따로, 고르면 바로 뒤에서 올라간다. */}
        {meta.columns
          .filter((c) => c.type === 'file')
          .map((c) => (
            <Field key={c.id} label={c.title}>
              {(id) => (
                <FileField
                  id={id}
                  boardKey={boardKey}
                  itemId={item?.itemId ?? null}
                  columnId={c.id}
                  label={c.title}
                  current={item?.values[c.id]?.value}
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
  // 물 레이아웃이면 같은 props의 물 부품(components/water/board)
  const water = useWaterLayout()
  const Multi = water?.WaterMultiSelect ?? MultiSelect
  const DateTime = water?.WaterDateTimeInput ?? DateTimeInput
  const Location = water?.WaterLocationInput ?? LocationInput
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
      return <Multi id={id} options={options} selected={selected} onChange={onChange} />
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
      return <DateTime id={id} title={column.title} value={value as { date: string; time: string }} onChange={onChange} />
    case 'location':
      return <Location id={id} value={value as LocationState} onChange={onChange} />
    case 'board_relation':
      // 가리키는 보드가 우리 캐시에 있는 연결 칸만 여기 온다(그 밖은 잠금).
      return column.linkedBoardKey ? (
        <RelationPicker
          boardKey={column.linkedBoardKey}
          selected={value as string[]}
          multiple
          fallbackText={currentText}
          onChange={(ids) => onChange(ids)}
        />
      ) : null
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
      if (isAssigneeColumn(column)) return <AssigneePicker id={id} value={value as string} onChange={onChange} />
      return (
        <input
          id={id}
          className="field__input"
          type={column.type === 'email' ? 'email' : isPhoneColumn(column) ? 'tel' : 'text'}
          value={value as string}
          // 연락처는 치는 대로 010-1234-5678 모양으로(저장은 숫자만 — toEditValue)
          onChange={(e) =>
            onChange(isPhoneColumn(column) && isPhoneLike(value as string) ? formatPhoneTyping(e.target.value) : e.target.value)
          }
          // 빈 연락처 칸에 들어오면 010을 미리 적고, 그대로 나가면 다시 비운다(손대지 않은 칸은 바뀐 것이 아니다)
          onFocus={() => {
            if (isPhoneColumn(column) && !(value as string)) onChange(PHONE_PREFIX)
          }}
          onBlur={() => {
            if (isPhoneColumn(column) && isPhonePrefixOnly(value as string)) onChange('')
          }}
        />
      )
  }
}
