import { ChevronDown, ChevronRight, LoaderCircle, MessageCircle, MessageCirclePlus } from 'lucide-react'
import { useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import type { TechCellValue, TechColumn, TechItemDoc, TechSubitemDoc } from '../../data/tech-boards'
import {
  formatPhoneTyping,
  initialState,
  isPartialPhone,
  isPhoneColumn,
  isPhoneLike,
  isWritable,
  type EditState,
} from '../../data/tech-edit'
import { pushToast } from '../../data/tech-save-queue'
import { cx } from '../../lib/cx'
import { formatInt } from '../../lib/format'
import { labelColor } from './monday-colors'
import { CellView } from './monday-cells'
import { CellEditor, InlineInput, type CellCommit } from './monday-editors'
import { cellClass, cellStyle, HIDDEN_TYPES, INLINE_TYPES, MIN_WIDTH, previewCell, type MonSort } from './monday-values'

export interface MonGroup {
  id: string
  title: string
  color: string
  items: TechItemDoc[]
}

/** 지금 고치는 칸 — 팝오버는 그 칸 요소를 따라 뜬다. */
export interface EditingCell {
  key: string
  anchor: HTMLElement
}

export interface GroupTableProps {
  group: MonGroup
  sort: MonSort
  /** 머리글 정렬 단추 — 누를 때마다 오름차순 → 내림차순 → 해제 */
  onSort: (columnId: string) => void
  columns: TechColumn[]
  /** 칸 너비(px) — 이름 칸은 'name' */
  widthOf: (id: string) => number
  onResize: (id: string, width: number) => void
  /** 이름 칸 머리글(고객·업무 …) */
  nameTitle: string
  collapsed: boolean
  onToggle: () => void
  limit: number
  onMore: () => void
  editing: EditingCell | null
  setEditing: (editing: EditingCell | null) => void
  /** 저장 중이면 새 값을 먼저 보여 준다. */
  cellOf: (item: TechItemDoc, column: TechColumn) => TechCellValue | undefined
  nameOf: (item: TechItemDoc) => string
  commitCell: (item: TechItemDoc, column: TechColumn, commit: CellCommit) => void
  commitName: (item: TechItemDoc, name: string) => void
  /** 파일 칸 모달 열기 */
  openFiles: (item: TechItemDoc, column: TechColumn) => void
  /** 그룹 맨 아래 "+ 추가" — null이면 줄을 그리지 않는다(내 업무). */
  addItem: ((groupId: string, name: string) => void) | null
  /** 하위 아이템 "+ 추가" — 이름만 적어 만든다. */
  addSubitem: (item: TechItemDoc, name: string) => void
  /** 하위 아이템 이름 칸 머리글(품목명·부품명) */
  subNameTitle: string
  /** 업데이트(말풍선) 패널 열기 — 말풍선이 없는 보드면 null */
  openUpdates: ((item: TechItemDoc) => void) | null
  /** 지금 패널이 열린 항목 */
  updatesOpenFor: string | null
  /** 만드는 중인 새 항목 이름 */
  creating: string[]
  pending: ReadonlySet<string>
  subColumns: TechColumn[] | null
  expanded: ReadonlySet<string>
  toggleExpanded: (itemId: string) => void
}

/** 칸 머리글 오른쪽 끝을 끌어 너비를 바꾼다. */
function ResizeHandle({ id, width, onResize }: { id: string; width: number; onResize: (id: string, width: number) => void }) {
  const start = useRef<{ x: number; width: number } | null>(null)
  return (
    <span
      className="mon-resize"
      aria-hidden
      onPointerDown={(e: ReactPointerEvent) => {
        e.preventDefault()
        e.stopPropagation()
        start.current = { x: e.clientX, width }
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (!start.current) return
        onResize(id, Math.max(MIN_WIDTH, start.current.width + e.clientX - start.current.x))
      }}
      onPointerUp={() => {
        start.current = null
      }}
      // 끌다가 포인터를 놓쳐도(창 밖·취소) 다음 움직임이 너비를 바꾸지 않게
      onPointerCancel={() => {
        start.current = null
      }}
      onLostPointerCapture={() => {
        start.current = null
      }}
    />
  )
}

const ariaSort = (sort: MonSort, id: string) =>
  sort?.columnId === id ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined

/** 머리글에 올리면 위 테두리에 걸쳐 뜨는 정렬 단추(Monday) — 정렬 중이면 늘 보이고 방향 삼각형이 밝다. */
function SortButton({ id, title, sort, onSort }: { id: string; title: string; sort: MonSort; onSort: (id: string) => void }) {
  const dir = sort?.columnId === id ? sort.dir : 0
  return (
    <button
      type="button"
      className={cx('mon-sort', dir === 1 && 'is-asc', dir === -1 && 'is-desc')}
      aria-label={`${title} ${dir === 1 ? '내림차순으로' : dir === -1 ? '정렬 해제' : '오름차순으로'} 정렬`}
      title={dir === 1 ? '오름차순 — 누르면 내림차순' : dir === -1 ? '내림차순 — 누르면 정렬 해제' : '정렬'}
      onClick={() => onSort(id)}
    >
      <svg width="8" height="12" viewBox="0 0 8 12" aria-hidden>
        <path className="mon-sort__up" d="M4 0.5 7.5 5H0.5z" />
        <path className="mon-sort__down" d="M4 11.5 0.5 7h7z" />
      </svg>
    </button>
  )
}

/** 그룹 아래 요약 — 상태 칸은 라벨 비율 막대, 숫자 칸은 합계(Monday 그룹 바닥 줄). */
function SummaryCell({ column, items, cellOf }: { column: TechColumn; items: TechItemDoc[]; cellOf: GroupTableProps['cellOf'] }) {
  if (column.type === 'status') {
    const counts = new Map<string, number>()
    for (const item of items) {
      const label = cellOf(item, column)?.text ?? ''
      counts.set(label, (counts.get(label) ?? 0) + 1)
    }
    const total = items.length
    return (
      <div className="mon-cell mon-summary__cell">
        {total > 0 && (
          <span className="mon-battery" title={[...counts].map(([label, n]) => `${label || '비어 있음'} ${n}`).join(' · ')}>
            {[...counts].map(([label, n]) => (
              <span key={label} style={{ flexGrow: n, '--label': labelColor(label) } as CSSProperties} />
            ))}
          </span>
        )}
      </div>
    )
  }
  if (column.type === 'numbers') {
    const sum = items.reduce((s, item) => s + (Number((cellOf(item, column)?.text ?? '').replace(/,/g, '')) || 0), 0)
    return (
      <div className="mon-cell mon-summary__cell">
        <span className="mon-summary__sum">
          {formatInt(sum)}
          <small>합계</small>
        </span>
      </div>
    )
  }
  return <div className="mon-cell mon-summary__cell" />
}

// 하위 표에 안 그리는 칸 — 생성 로그
const SUB_HIDDEN_TYPES = new Set(['creation_log'])
const SUB_NAME_WIDTH = 340
const SUB_WIDTH = 130

/**
 * 하위 아이템(출장 설치 품목·AS 청구 부품) — Monday처럼 줄 아래로 들여 펼친다. 왼쪽 줄기에서
 * 줄마다 둥글게 꺾인 가지가 나오고, 맨 아래 "+ 품목명 추가"로 이름만 적어 새 줄을 만든다.
 * 칸 고치기는 "열기"의 편집 패널에서.
 */
function SubTable({
  columns,
  subitems,
  nameTitle,
  onAdd,
}: {
  columns: TechColumn[]
  subitems: TechSubitemDoc[]
  nameTitle: string
  onAdd: (name: string) => void
}) {
  const shown = columns.filter((c) => !HIDDEN_TYPES.has(c.type) && !SUB_HIDDEN_TYPES.has(c.type))
  const template = `${SUB_NAME_WIDTH}px ${shown.map(() => `${SUB_WIDTH}px`).join(' ')}`
  return (
    <div className="mon-sub" role="rowgroup" aria-label={`하위 아이템 ${subitems.length}개`} style={{ '--sub-cols': template } as CSSProperties}>
      <span className="mon-sub__trunk" aria-hidden />
      <div className="mon-sub__row mon-sub__row--head" role="row">
        <div className="mon-cell mon-sub__name" role="columnheader">
          <span className="mon-text">{nameTitle}</span>
        </div>
        {shown.map((c) => (
          <div key={c.id} className="mon-cell" role="columnheader" title={c.title}>
            <span className="mon-text">{c.title}</span>
          </div>
        ))}
      </div>
      {subitems.map((sub) => (
        <div key={sub.id} className="mon-sub__row mon-sub__row--item" role="row">
          <div className="mon-cell mon-sub__name" role="rowheader" title={sub.name}>
            <span className="mon-text">{sub.name}</span>
          </div>
          {shown.map((c) => (
            <div key={c.id} className={cellClass(c)} style={cellStyle(c, sub.values[c.id])} role="gridcell">
              <CellView column={c} cell={sub.values[c.id]} />
            </div>
          ))}
        </div>
      ))}
      <div className="mon-sub__row mon-sub__row--item mon-sub__row--add" role="row">
        <div className="mon-cell mon-sub__name" role="rowheader">
          <AddInput label={nameTitle} onAdd={onAdd} />
        </div>
      </div>
    </div>
  )
}

/** 그룹 하나 — 색 막대가 붙은 제목, 머리글, 줄들, "+ 추가" 줄, 요약 줄. */
export function GroupTable(props: GroupTableProps) {
  const { group, columns, widthOf, onResize, nameTitle, collapsed, onToggle, limit, onMore, sort, onSort } = props
  const style = { '--group': group.color } as CSSProperties
  const Chevron = collapsed ? ChevronRight : ChevronDown

  return (
    <section className={cx('mon-group', collapsed && 'is-collapsed')} style={style} role="table" aria-label={group.title}>
      <div className="mon-group__title">
        <button type="button" className="mon-group__toggle" aria-expanded={!collapsed} onClick={onToggle}>
          <Chevron size={18} strokeWidth={2.2} aria-hidden />
          <span className="mon-group__name">{group.title}</span>
        </button>
        <span className="mon-group__count">{group.items.length}개 항목</span>
      </div>

      {!collapsed && (
        <>
          <div className="mon-row mon-row--head" role="row">
            <div className="mon-cell mon-cell--name" role="columnheader" aria-sort={ariaSort(sort, 'name')}>
              <SortButton id="name" title={nameTitle} sort={sort} onSort={onSort} />
              <span className="mon-text">{nameTitle}</span>
              <ResizeHandle id="name" width={widthOf('name')} onResize={onResize} />
            </div>
            {columns.map((c) => (
              <div key={c.id} className="mon-cell" role="columnheader" title={c.title} aria-sort={ariaSort(sort, c.id)}>
                <SortButton id={c.id} title={c.title} sort={sort} onSort={onSort} />
                <span className="mon-text">{c.title}</span>
                <ResizeHandle id={c.id} width={widthOf(c.id)} onResize={onResize} />
              </div>
            ))}
            <div className="mon-cell mon-cell--end" aria-hidden />
          </div>

          {group.items.slice(0, limit).map((item) => (
            <ItemRow key={item.itemId} item={item} {...props} />
          ))}

          {group.items.length > limit && (
            <button type="button" className="mon-more" onClick={onMore}>
              더 보기 <span>{group.items.length - limit}개 남음</span>
            </button>
          )}

          {props.creating.map((name, i) => (
            <div key={`${name}-${i}`} className="mon-row is-creating" role="row">
              <div className="mon-cell mon-cell--name" role="rowheader">
                <LoaderCircle size={13} className="is-spinning" aria-hidden />
                <span className="mon-text">{name}</span>
              </div>
              <div className="mon-cell mon-row__fill" aria-hidden />
            </div>
          ))}

          {props.addItem && <AddRow nameTitle={nameTitle} onAdd={(name) => props.addItem?.(group.id, name)} />}

          <div className="mon-row mon-summary" role="row" aria-label="요약">
            <div className="mon-cell mon-cell--name mon-summary__lead" />
            {columns.map((c) => (
              <SummaryCell key={c.id} column={c} items={group.items} cellOf={props.cellOf} />
            ))}
          </div>
        </>
      )}
    </section>
  )
}

/**
 * "+ 고객 추가" 입력 — 이름만 적고 엔터(또는 바깥 누르기)면 만든다. Esc는 취소 — blur가 같은 차례에
 * 저장을 부르므로(아직 지우기 전 값) 취소 표시를 ref로 먼저 세운다.
 */
function AddInput({ label, onAdd }: { label: string; onAdd: (name: string) => void }) {
  const [value, setValue] = useState('')
  const cancelled = useRef(false)
  const submit = () => {
    const name = value.trim()
    if (cancelled.current) {
      cancelled.current = false
      return
    }
    if (!name) return
    onAdd(name)
    setValue('')
  }
  return (
    <input
      className="mon-add"
      placeholder={`+ ${label} 추가`}
      aria-label={`${label} 추가`}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={submit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          submit()
        } else if (e.key === 'Escape') {
          cancelled.current = true
          setValue('')
          e.currentTarget.blur()
        }
      }}
    />
  )
}

/** 맨 아래 "+ 고객 추가" 줄 — 이 그룹에 새 항목을 만든다. */
function AddRow({ nameTitle, onAdd }: { nameTitle: string; onAdd: (name: string) => void }) {
  return (
    <div className="mon-row mon-row--add" role="row">
      <div className="mon-cell mon-cell--name" role="rowheader">
        <AddInput label={nameTitle} onAdd={onAdd} />
      </div>
      <div className="mon-cell mon-row__fill" aria-hidden />
    </div>
  )
}

// 서버가 업데이트를 이 수까지만 센다(functions-xtool monday-api.ts UPDATE_COUNT_LIMIT)
const UPDATE_COUNT_LIMIT = 20

/** 이름 칸 오른쪽 말풍선 — 업데이트가 있으면 개수 배지, 없으면 +가 붙은 말풍선(Monday). */
function UpdatesButton({ count, active, label, onClick }: { count: number; active: boolean; label: string; onClick: () => void }) {
  const Icon = count > 0 ? MessageCircle : MessageCirclePlus
  return (
    <button
      type="button"
      className={cx('mon-updates', count > 0 && 'has-updates', active && 'is-active')}
      aria-label={`${label} 업데이트 ${count}개`}
      title={count > 0 ? `업데이트 ${count}개` : '업데이트 쓰기'}
      onClick={onClick}
    >
      <Icon size={19} strokeWidth={1.6} aria-hidden />
      {count > 0 && <span className="mon-updates__count">{count >= UPDATE_COUNT_LIMIT ? `${UPDATE_COUNT_LIMIT}+` : count}</span>}
    </button>
  )
}

function ItemRow({ item, ...props }: GroupTableProps & { item: TechItemDoc }) {
  const { columns, editing, setEditing, nameOf, commitName, pending, subColumns, expanded } = props
  const nameKey = `${item.itemId}:name`
  const subCount = item.subitems?.length ?? 0
  const open = expanded.has(item.itemId)
  const Chevron = open ? ChevronDown : ChevronRight

  return (
    <>
      <div className={cx('mon-row', pending.has(item.itemId) && 'is-saving')} role="row">
        <div className="mon-cell mon-cell--name" role="rowheader">
          {subColumns && (
            <button
              type="button"
              className={cx('mon-expand', subCount === 0 && !open && 'is-empty')}
              aria-expanded={open}
              aria-label={`하위 아이템 ${subCount}개 ${open ? '접기' : '펼치기'}`}
              onClick={() => props.toggleExpanded(item.itemId)}
            >
              <Chevron size={14} strokeWidth={2.2} aria-hidden />
            </button>
          )}
          {editing?.key === nameKey ? (
            <InlineInput
              initial={nameOf(item)}
              label="이름"
              onCommit={(name) => {
                setEditing(null)
                if (name.trim()) commitName(item, name.trim())
              }}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <button
              type="button"
              className="mon-name"
              title={nameOf(item)}
              onClick={(e) => setEditing({ key: nameKey, anchor: e.currentTarget })}
            >
              {nameOf(item)}
            </button>
          )}
          {subCount > 0 && <span className="mon-subcount">{subCount}</span>}
          {pending.has(item.itemId) && <LoaderCircle size={12} className="is-spinning mon-saving" aria-label="저장 중" />}
          {props.openUpdates && (
            <UpdatesButton
              count={item.updateCount ?? 0}
              active={props.updatesOpenFor === item.itemId}
              label={nameOf(item)}
              onClick={() => props.openUpdates?.(item)}
            />
          )}
        </div>
        {columns.map((column) => (
          <ItemCell key={column.id} item={item} column={column} {...props} />
        ))}
        <div className="mon-cell mon-cell--end" aria-hidden />
      </div>
      {open && subColumns && (
        <SubTable
          columns={subColumns}
          subitems={item.subitems ?? []}
          nameTitle={props.subNameTitle}
          onAdd={(name) => props.addSubitem(item, name)}
        />
      )}
    </>
  )
}

function ItemCell({
  item,
  column,
  editing,
  setEditing,
  cellOf,
  commitCell,
  openFiles,
  pending,
}: GroupTableProps & { item: TechItemDoc; column: TechColumn }) {
  const key = `${item.itemId}:${column.id}`
  const cell = cellOf(item, column)
  const writable = isWritable(column)
  const active = editing?.key === key
  const commit = (c: CellCommit) => {
    setEditing(null)
    commitCell(item, column, c)
  }

  const start = (target: HTMLElement) => {
    if (column.type === 'file') {
      openFiles(item, column)
      return
    }
    if (!writable) return
    if (column.type === 'checkbox') {
      // 저장 중에 또 누르면 순서가 뒤바뀔 수 있어 끝날 때까지 기다린다.
      if (pending.has(item.itemId)) return
      const next = !(initialState(column, cell) as boolean)
      commitCell(item, column, { state: next, preview: previewCell(column, next) })
      return
    }
    setEditing({ key, anchor: target })
  }

  if (active && INLINE_TYPES.has(column.type)) {
    const initial = initialState(column, cell) as string
    return (
      <div className={cx(cellClass(column), 'is-editing')} role="gridcell">
        <InlineInput
          initial={initial}
          label={column.title}
          inputMode={column.type === 'numbers' ? 'decimal' : isPhoneColumn(column) ? 'tel' : column.type === 'email' ? 'email' : undefined}
          // 번호 하나로 적힌 값만 치는 대로 하이픈을 넣는다(번호 두 개 등은 적힌 그대로).
          format={isPhoneColumn(column) && isPhoneLike(initial) ? formatPhoneTyping : undefined}
          onCommit={(value) => {
            if (isPhoneColumn(column) && isPhoneLike(value) && isPartialPhone(value)) {
              setEditing(null)
              pushToast({ tone: 'error', title: `${column.title}: 번호를 끝까지 적어 주세요`, message: '9자리가 안 되는 번호는 저장하지 않았어요.' })
              return
            }
            commit({ state: value as EditState, preview: previewCell(column, value) })
          }}
          onCancel={() => setEditing(null)}
        />
      </div>
    )
  }

  return (
    <div
      className={cx(cellClass(column), writable && 'is-writable', active && 'is-active')}
      style={cellStyle(column, cell)}
      role="gridcell"
      tabIndex={writable || column.type === 'file' ? 0 : -1}
      title={writable || column.type === 'file' ? undefined : `${column.title} — Monday에서만 고칠 수 있어요`}
      onClick={(e) => start(e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === 'F2') {
          e.preventDefault()
          start(e.currentTarget)
        }
      }}
    >
      <CellView column={column} cell={cell} />
      {active && editing && (
        <CellEditor column={column} cell={cell} anchor={editing.anchor} onCommit={commit} onCancel={() => setEditing(null)} />
      )}
    </div>
  )
}
